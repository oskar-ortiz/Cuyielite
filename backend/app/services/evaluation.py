"""Evaluación persistente con restricciones oficiales de plataforma.

Aclaraciones de Diery (2026-11-16) que gobiernan este módulo:

* Candidatas: ELITE exige los criterios vigentes; con faltantes la regla devuelve
  NORMAL + REVISAR, que es informativo y no se persiste.
* Reproductoras: el cuarto parto es el único criterio confirmado de DESCARTE.
  Dos abortos es una PROPUESTA: conserva DESCARTE como resultado provisional,
  normaliza la calidad a REVISAR|PROPUESTA y no genera categoría ni alerta.
* Un resultado provisional o insuficiente no reemplaza una categoría definitiva.
* La evidencia oficial se resuelve desde registros revisados por personal
  autorizado; una declaración del cliente no autoriza persistencia.

Las funciones de ``ml`` no se modifican: este módulo aplica las restricciones
oficiales sobre su salida y sobre datos estructurados.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import json
from typing import Any, Literal
from uuid import UUID

from backend.app.repositories import evaluation as repo
from backend.app.repositories import publication as publication_repo
from backend.app.services import ml as ml_service
from backend.app.services.publication import (
    PUBLISHABLE_FIELDS,
    PublicacionError,
    RegistroPublicacion,
    fields_from_snapshot,
    publicar_cambios,
)

REGLAS_VERSION = "adr0004+reglas-2026-11-16+oficial-1"
TIPO_ALERTA = "DESCARTE_REPRODUCTORA"

# Campos que puede aportar la evidencia revisable.
CAMPOS_EVIDENCIA = (
    "abortos",
    "peso_monta_g",
    "partos_acumulados",
    "nupar_madre",
    "tcnv",
    "peso_nacimiento_g",
    "peso_destete_g",
    "dias_destete",
    "ojos",
)
CAMPOS_ENTEROS = {"abortos", "partos_acumulados", "nupar_madre", "tcnv", "dias_destete"}
CAMPOS_PESO = {"peso_monta_g", "peso_nacimiento_g", "peso_destete_g"}

# Evidencia que debe estar REVISADA para sostener cada clase oficial.
EVIDENCIA_REQUERIDA_REPRODUCTORA_NORMAL = ("abortos",)
EVIDENCIA_REQUERIDA_CANDIDATA = (
    "nupar_madre",
    "tcnv",
    "peso_nacimiento_g",
    "peso_destete_g",
    "ojos",
    "dias_destete",
    "peso_monta_g",
)

MISSING_PREFIXES = ("dato faltante:", "dato faltante o invalido:")


class EvaluationError(Exception):
    def __init__(self, codigo: str, mensaje: str, status: int = 409):
        self.codigo = codigo
        self.mensaje = mensaje
        self.status = status
        super().__init__(f"{codigo}: {mensaje}")


class EvaluationNotFound(EvaluationError):
    def __init__(self):
        super().__init__("ANIMAL_NO_ENCONTRADO", "El animal no existe en el ámbito", 404)


class EvaluationStale(EvaluationError):
    def __init__(self, detalle: str):
        super().__init__("EVALUACION_OBSOLETA", detalle, 409)


@dataclass(frozen=True)
class Fundamento:
    regla_id: str
    caracter: Literal["CONFIRMADO", "PROPUESTO"]
    causa_tipo: str
    causa_id: UUID | None
    causa_fecha: date | None
    fecha_limite: date | None
    motivo: str


@dataclass(frozen=True)
class Evaluacion:
    estado: str
    clase: str | None
    caracter: str | None
    estado_calidad: str
    motivos: list[str]
    faltantes: list[str]
    evidencia_pendiente: list[str]
    fundamentos: list[Fundamento] = field(default_factory=list)


def _normalize(text: str) -> str:
    replacements = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n"}
    folded = text.strip().casefold()
    for accent, plain in replacements.items():
        folded = folded.replace(accent, plain)
    return folded


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _stable(value: Any) -> str:
    if isinstance(value, dict):
        value = {key: item for key, item in value.items() if key != "evaluada_at"}
        procedencia = value.get("procedencia")
        if isinstance(procedencia, dict):
            value["procedencia"] = {
                key: item for key, item in procedencia.items() if key != "cuy_server_version"
            }
    return _json(value)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "date") and not isinstance(value, date):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _missing_fields(motivos: list[str]) -> list[str]:
    fields: list[str] = []
    for motivo in motivos:
        normalized = _normalize(motivo)
        for prefix in MISSING_PREFIXES:
            if normalized.startswith(prefix):
                name = normalized[len(prefix) :].strip()
                if name and name not in fields:
                    fields.append(name)
    return fields


def _quality_tokens(estado: str | None) -> set[str]:
    return {token.strip().upper() for token in (estado or "").split("|") if token.strip()}


def _criterio(name: str) -> Any:
    from ml.rules import criterios

    return criterios.CRITERIOS[name].valor


def normalize_value(campo: str, value: Any) -> str | None:
    """Normaliza el valor declarado al formato que consumen las reglas."""
    if value is None:
        return None
    if campo in CAMPOS_ENTEROS:
        if isinstance(value, bool):
            raise EvaluationError("EVIDENCIA_INVALIDA", f"{campo} debe ser entero", 422)
        try:
            number = int(str(value).strip())
        except (TypeError, ValueError) as error:
            raise EvaluationError("EVIDENCIA_INVALIDA", f"{campo} debe ser entero", 422) from error
        if number < 0:
            raise EvaluationError("EVIDENCIA_INVALIDA", f"{campo} no puede ser negativo", 422)
        return str(number)
    if campo in CAMPOS_PESO:
        if isinstance(value, bool):
            raise EvaluationError("EVIDENCIA_INVALIDA", f"{campo} debe ser numérico", 422)
        try:
            number = Decimal(str(value).strip())
        except (InvalidOperation, ValueError) as error:
            raise EvaluationError("EVIDENCIA_INVALIDA", f"{campo} debe ser numérico", 422) from error
        if not number.is_finite() or number <= 0:
            raise EvaluationError("EVIDENCIA_INVALIDA", f"{campo} debe ser positivo", 422)
        return format(number, "f")
    if campo == "ojos":
        text = str(value).strip().casefold()
        if text in {"1", "negro"}:
            return "1"
        if text in {"2", "rojo"}:
            return "2"
        raise EvaluationError("EVIDENCIA_INVALIDA", "ojos debe ser 1/Negro o 2/Rojo", 422)
    if campo == "partos_acumulados":
        return normalize_value("abortos", value)
    raise EvaluationError("EVIDENCIA_INVALIDA", f"campo de evidencia desconocido: {campo}", 422)


# ---------------------------------------------------------------------------
# Decisión
# ---------------------------------------------------------------------------


def _fundamentos_reproductora(
    *,
    partos: dict[str, Any],
    abortos: int | None,
) -> list[Fundamento]:
    """Fundamentos estructurados, sin depender del texto de los motivos.

    Solo el cuarto parto es confirmado. Dos abortos es una propuesta de Diery.
    """
    fundamentos: list[Fundamento] = []
    descarte_partos = int(_criterio("partos_reproductora_descarte"))
    total = int(partos["total"])
    if total >= descarte_partos:
        cuarto = partos.get("cuarto")
        causa_id: UUID | None = None
        causa_fecha: date | None = None
        limite: date | None = None
        if cuarto is not None:
            causa_id = cuarto["id"]
            causa_fecha = cuarto.get("fecha_parto")
            if causa_fecha is not None:
                dias = int(_criterio("dias_hasta_salida_despues_parto"))
                limite = causa_fecha + timedelta(days=dias)
        fundamentos.append(
            Fundamento(
                regla_id="partos_reproductora_descarte",
                caracter="CONFIRMADO",
                causa_tipo="PARTO" if causa_id else "HISTORIA_REPRODUCTIVA",
                causa_id=causa_id,
                causa_fecha=causa_fecha,
                fecha_limite=limite,
                motivo="ciclo completo",
            )
        )
    propuesta_abortos = int(_criterio("abortos_repetidos_descarte"))
    if total < descarte_partos and abortos is not None and abortos >= propuesta_abortos:
        fundamentos.append(
            Fundamento(
                regla_id="abortos_repetidos_descarte",
                caracter="PROPUESTO",
                causa_tipo="HISTORIA_REPRODUCTIVA",
                causa_id=None,
                causa_fecha=None,
                fecha_limite=None,
                motivo="problema repetido (se dejó un parto más)",
            )
        )
    return fundamentos


def _evaluar_reproductora(
    result: dict[str, Any],
    *,
    partos: dict[str, Any],
    abortos: int | None,
    evidencia_revisada: dict[str, str],
) -> Evaluacion:
    motivos = list(result["motivos"])
    faltantes = _missing_fields(motivos)
    tokens = _quality_tokens(result["estado_calidad"])
    clase = result["clase"]
    estado_calidad = result["estado_calidad"]

    if "REVISAR" in tokens or faltantes:
        return Evaluacion(
            estado="DATOS_INSUFICIENTES",
            clase=None,
            caracter=None,
            estado_calidad=estado_calidad,
            motivos=motivos,
            faltantes=faltantes,
            evidencia_pendiente=[],
        )

    if clase == "NORMAL":
        pendiente = [c for c in EVIDENCIA_REQUERIDA_REPRODUCTORA_NORMAL if c not in evidencia_revisada]
        if pendiente:
            return Evaluacion(
                estado="EVIDENCIA_NO_VALIDADA",
                clase=None,
                caracter=None,
                estado_calidad="REVISAR|EVIDENCIA_NO_VALIDADA",
                motivos=motivos,
                faltantes=[],
                evidencia_pendiente=pendiente,
            )
        return Evaluacion(
            estado="DEFINITIVA",
            clase="NORMAL",
            caracter="CONFIRMADO",
            estado_calidad="CONFIRMADO",
            motivos=motivos,
            faltantes=[],
            evidencia_pendiente=[],
        )

    # DESCARTE: el resultado es oficial solo si existe un fundamento confirmado.
    fundamentos = _fundamentos_reproductora(partos=partos, abortos=abortos)
    confirmados = [item for item in fundamentos if item.caracter == "CONFIRMADO"]
    if confirmados:
        return Evaluacion(
            estado="DEFINITIVA",
            clase="DESCARTE",
            caracter="CONFIRMADO",
            estado_calidad="CONFIRMADO",
            motivos=motivos,
            faltantes=[],
            evidencia_pendiente=[],
            fundamentos=confirmados,
        )
    if fundamentos:
        return Evaluacion(
            estado="PROVISIONAL",
            clase="DESCARTE",
            caracter="PROPUESTO",
            estado_calidad="REVISAR|PROPUESTA",
            motivos=motivos,
            faltantes=[],
            evidencia_pendiente=[],
            fundamentos=fundamentos,
        )
    return Evaluacion(
        estado="PROVISIONAL",
        clase="DESCARTE",
        caracter="PROPUESTO",
        estado_calidad="REVISAR|PROPUESTA",
        motivos=motivos + ["causa no identificada: no se genera categoría ni alerta"],
        faltantes=[],
        evidencia_pendiente=[],
        fundamentos=[],
    )


def _evaluar_candidata(
    result: dict[str, Any],
    *,
    evidencia_revisada: dict[str, str],
) -> Evaluacion:
    motivos = list(result["motivos"])
    faltantes = _missing_fields(motivos)
    tokens = _quality_tokens(result["estado_calidad"])
    if "REVISAR" in tokens or faltantes:
        return Evaluacion(
            estado="DATOS_INSUFICIENTES",
            clase=None,
            caracter=None,
            estado_calidad=result["estado_calidad"],
            motivos=motivos,
            faltantes=faltantes,
            evidencia_pendiente=[],
        )
    pendiente = [campo for campo in EVIDENCIA_REQUERIDA_CANDIDATA if campo not in evidencia_revisada]
    if pendiente:
        return Evaluacion(
            estado="EVIDENCIA_NO_VALIDADA",
            clase=None,
            caracter=None,
            estado_calidad="REVISAR|EVIDENCIA_NO_VALIDADA",
            motivos=motivos,
            faltantes=[],
            evidencia_pendiente=pendiente,
        )
    return Evaluacion(
        estado="DEFINITIVA",
        clase=result["clase"],
        caracter="CONFIRMADO",
        estado_calidad="CONFIRMADO",
        motivos=motivos,
        faltantes=[],
        evidencia_pendiente=[],
    )


# ---------------------------------------------------------------------------
# Persistencia
# ---------------------------------------------------------------------------


def _category_snapshot(
    *,
    cuy_id: UUID,
    version: int,
    clase: str | None,
    estado_evaluacion: str,
    caracter: str | None,
    categoria_estado: str | None,
    motivos: list[str],
    faltantes: list[str],
    evidencia_pendiente: list[str],
    reglas_version: str,
    evaluada_at: str | None,
    procedencia: dict[str, Any],
) -> dict[str, Any]:
    return {
        "id": str(cuy_id),
        "version": str(version),
        "created_at": evaluada_at,
        "updated_at": evaluada_at,
        "deleted_at": None,
        "last_client_edited_at": None,
        "data": {
            "cuy_id": str(cuy_id),
            "clase": clase,
            "estado_evaluacion": estado_evaluacion,
            "caracter": caracter,
            "categoria_estado": categoria_estado,
            "motivos": motivos,
            "faltantes": faltantes,
            "evidencia_pendiente": evidencia_pendiente,
            "reglas_version": reglas_version,
            "evaluada_at": evaluada_at,
            "procedencia": procedencia,
            "apoyo_modelo": None,
        },
    }


def _alert_snapshot(alerta: dict[str, Any], committed_at: str) -> dict[str, Any]:
    return {
        "id": str(alerta["id"]),
        "version": str(int(alerta["server_version"])),
        "created_at": committed_at,
        "updated_at": committed_at,
        "deleted_at": None,
        "last_client_edited_at": None,
        "data": {
            "cuy_id": str(alerta["cuy_id"]),
            "tipo_alerta": alerta["tipo_alerta"],
            "regla_id": alerta["regla_id"],
            "motivo": alerta["motivo"],
            "estado": alerta["estado"],
            "causa_tipo": alerta["causa_tipo"],
            "causa_id": str(alerta["causa_id"]) if alerta["causa_id"] else None,
            "causa_fecha": _iso(alerta["causa_fecha"]),
            "fecha_limite": _iso(alerta["fecha_limite"]),
            "reglas_version": alerta["reglas_version"],
            "atendida": False,
        },
    }


def _procedencia(
    *,
    animal: dict[str, Any],
    partos: dict[str, Any],
    evidencia: dict[str, str],
) -> dict[str, Any]:
    return {
        "fuente": "CENTRAL+EVIDENCIA_REVISADA",
        "cuy_server_version": int(animal.get("server_version") or 0),
        "partos": {
            "total": partos["total"],
            "max_server_version": partos["max_version"],
            "ultimo_parto_id": str(partos["ultimo_parto_id"]) if partos["ultimo_parto_id"] else None,
            "ultima_fecha": _iso(partos["ultima_fecha"]),
            "cuarto_identificado": partos.get("cuarto") is not None,
        },
        "evidencia_revisada": dict(sorted(evidencia.items())),
        "reglas_version": REGLAS_VERSION,
    }


def _category_view(animal: dict[str, Any]) -> dict[str, Any]:
    return {
        "clase": animal.get("categoria_ml"),
        "caracter": animal.get("categoria_caracter"),
        "categoria_estado": animal.get("categoria_estado"),
        "motivos": animal.get("categoria_motivos") or [],
        "faltantes": animal.get("categoria_faltantes") or [],
        "reglas_version": animal.get("categoria_reglas_version"),
        "evaluada_at": _iso(animal.get("categoria_evaluada_at")),
        "procedencia": animal.get("categoria_procedencia") or {},
        "server_version": int(animal.get("categoria_server_version") or 0),
    }


def _alert_view(alerta: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(alerta["id"]),
        "tipo_alerta": alerta["tipo_alerta"],
        "regla_id": alerta["regla_id"],
        "motivo": alerta["motivo"],
        "estado": alerta["estado"],
        "causa_tipo": alerta["causa_tipo"],
        "causa_id": str(alerta["causa_id"]) if alerta.get("causa_id") else None,
        "causa_fecha": _iso(alerta.get("causa_fecha")),
        "fecha_limite": _iso(alerta.get("fecha_limite")),
        "reglas_version": alerta["reglas_version"],
    }


def _evidence_view(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "campo": item["campo"],
        "valor": item["valor"],
        "origen": item["origen"],
        "estado": item["estado"],
        "archivo_huella": item.get("archivo_huella"),
        "hoja": item.get("hoja"),
        "fila": item.get("fila"),
        "celda": item.get("celda"),
        "parser_version": item.get("parser_version"),
        "mapeo_version": item.get("mapeo_version"),
        "revisada_at": _iso(item.get("revisada_at")),
        "nota": item.get("nota"),
        "server_version": int(item.get("server_version") or 1),
    }


def _fundamento_view(item: Fundamento) -> dict[str, Any]:
    return {
        "regla_id": item.regla_id,
        "caracter": item.caracter,
        "causa_tipo": item.causa_tipo,
        "causa_id": str(item.causa_id) if item.causa_id else None,
        "causa_fecha": _iso(item.causa_fecha),
        "fecha_limite": _iso(item.fecha_limite),
        "motivo": item.motivo,
    }

# ---------------------------------------------------------------------------
# Orquestación
# ---------------------------------------------------------------------------


def _animal(conn, scope_id: UUID, cuy_id: UUID, *, lock: bool) -> dict[str, Any]:
    animal = repo.get_animal_for_update(conn, scope_id, cuy_id) if lock else repo.get_animal(conn, scope_id, cuy_id)
    if animal is None or animal.get("deleted_at") is not None:
        raise EvaluationNotFound()
    return animal


def context(scope_id: UUID, cuy_id: UUID) -> dict[str, Any]:
    """Estado actual sin escribir nada."""
    from backend.app.database import get_connection

    with get_connection() as conn:
        animal = _animal(conn, scope_id, cuy_id, lock=False)
        partos = repo.partos_summary(conn, scope_id, cuy_id)
        alerts = repo.list_alerts(conn, scope_id, cuy_id)
        evidence = repo.list_evidence(conn, scope_id, cuy_id)
        revisada = {item["campo"]: item["valor"] for item in evidence if item["estado"] == "REVISADA"}
        try:
            ml_service.ensure_applicable(animal)
            aplicable = True
            motivo_no_aplica = None
        except ml_service.MlError as error:
            aplicable = False
            motivo_no_aplica = error.codigo
        conn.rollback()
    return {
        "cuy_id": str(cuy_id),
        "aplicable": aplicable,
        "motivo_no_aplica": motivo_no_aplica,
        "base_version": int(animal.get("server_version") or 0),
        "base_partos_version": partos["max_version"],
        "partos_acumulados": partos["total"],
        "fecha_ultimo_parto": _iso(partos["ultima_fecha"]),
        "cuarto_parto_identificado": partos.get("cuarto") is not None,
        "categoria": _category_view(animal),
        "alertas": [_alert_view(item) for item in alerts],
        "evidencias": [_evidence_view(item) for item in evidence],
        "evidencia_revisada": sorted(revisada),
        "reglas_version": REGLAS_VERSION,
    }


def declare_evidence(
    scope_id: UUID,
    cuy_id: UUID,
    *,
    campo: str,
    valor: Any,
    actor: UUID | None,
    origen: str = "DECLARADA",
    archivo_huella: str | None = None,
    hoja: str | None = None,
    fila: int | None = None,
    celda: str | None = None,
    parser_version: str | None = None,
    mapeo_version: str | None = None,
) -> dict[str, Any]:
    """Registra una declaración. No la valida: queda en estado DECLARADA."""
    if campo not in CAMPOS_EVIDENCIA:
        raise EvaluationError("EVIDENCIA_INVALIDA", f"campo desconocido: {campo}", 422)
    normalized = normalize_value(campo, valor)
    from backend.app.database import get_connection

    with get_connection() as conn:
        _animal(conn, scope_id, cuy_id, lock=True)
        item = repo.upsert_evidence(
            conn,
            scope_id,
            cuy_id,
            campo,
            normalized,
            origen=origen,
            declarada_por=actor,
            archivo_huella=archivo_huella,
            hoja=hoja,
            fila=fila,
            celda=celda,
            parser_version=parser_version,
            mapeo_version=mapeo_version,
        )
        conn.commit()
    return _evidence_view(item)


def review_evidence(
    scope_id: UUID,
    cuy_id: UUID,
    *,
    campo: str,
    decision: str,
    reviewer: UUID | None,
    nota: str | None,
) -> dict[str, Any]:
    """Revisa una evidencia. El revisor siempre es la sesión autenticada."""
    if decision not in {"REVISADA", "RECHAZADA"}:
        raise EvaluationError("REVISION_INVALIDA", "decision debe ser REVISADA o RECHAZADA", 422)
    if reviewer is None:
        raise EvaluationError(
            "REVISOR_NO_IDENTIFICADO",
            "La revisión exige una cuenta autenticada de administrador",
            403,
        )
    from backend.app.database import get_connection

    with get_connection() as conn:
        _animal(conn, scope_id, cuy_id, lock=True)
        item = repo.review_evidence(conn, scope_id, cuy_id, campo, decision, reviewer, nota)
        if item is None:
            raise EvaluationError("EVIDENCIA_NO_ENCONTRADA", "No existe evidencia para ese campo", 404)
        conn.commit()
    return _evidence_view(item)


def _persist_official(
    conn,
    scope_id: UUID,
    animal: dict[str, Any],
    evaluacion: Evaluacion,
    *,
    partos: dict[str, Any],
    evidencia: dict[str, str],
) -> dict[str, Any]:
    clase = evaluacion.clase
    procedencia = _procedencia(animal=animal, partos=partos, evidencia=evidencia)
    content = {
        "cuy_id": str(animal["id"]),
        "clase": clase,
        "estado_evaluacion": "DEFINITIVA",
        "caracter": "CONFIRMADO",
        "categoria_estado": "DEFINITIVA",
        "motivos": evaluacion.motivos,
        "faltantes": [],
        "evidencia_pendiente": [],
        "reglas_version": REGLAS_VERSION,
        "procedencia": procedencia,
        "apoyo_modelo": None,
    }
    previous = repo.latest_derived(conn, scope_id, "categoria", animal["id"])
    changed = previous is None or _stable(previous["snapshot"].get("data")) != _stable(content)
    category_changed = animal.get("categoria_ml") != clase

    version = repo.update_category(
        conn,
        scope_id,
        animal["id"],
        clase=clase,
        estado="DEFINITIVA",
        caracter="CONFIRMADO",
        motivos=evaluacion.motivos,
        faltantes=[],
        reglas_version=REGLAS_VERSION,
        procedencia=_json(procedencia),
        bump_version=changed,
    )
    if changed:
        repo.insert_derived(
            conn,
            scope_id,
            "categoria",
            animal["id"],
            version,
            _category_snapshot(
                cuy_id=animal["id"],
                version=version,
                clase=clase,
                estado_evaluacion="DEFINITIVA",
                caracter="CONFIRMADO",
                categoria_estado="DEFINITIVA",
                motivos=evaluacion.motivos,
                faltantes=[],
                evidencia_pendiente=[],
                reglas_version=REGLAS_VERSION,
                evaluada_at=_now_iso(),
                procedencia=procedencia,
            ),
        )
    if category_changed:
        _publish_category(conn, scope_id, animal, clase)

    alertas, cerradas = _sync_alerts(conn, scope_id, animal["id"], evaluacion.fundamentos)
    return _payload(
        animal,
        evaluacion,
        categoria_cambiada=category_changed,
        publicado=category_changed,
        derivado_actualizado=changed,
        alertas=alertas,
        alertas_cerradas=cerradas,
        procedencia=procedencia,
    )


def _persist_partial(
    conn,
    scope_id: UUID,
    animal: dict[str, Any],
    evaluacion: Evaluacion,
    *,
    partos: dict[str, Any],
    evidencia: dict[str, str],
) -> dict[str, Any]:
    """Resultado no definitivo: no reemplaza categoría ni genera alertas."""
    procedencia = _procedencia(animal=animal, partos=partos, evidencia=evidencia)
    version = 0
    changed = False
    if animal.get("categoria_ml"):
        version = repo.mark_category_historical(conn, scope_id, animal["id"])
    else:
        version = repo.bump_category_record_version(conn, scope_id, animal["id"])
    if version:
        repo.insert_derived(
            conn,
            scope_id,
            "categoria",
            animal["id"],
            version,
            _category_snapshot(
                cuy_id=animal["id"],
                version=version,
                clase=animal.get("categoria_ml"),
                estado_evaluacion=evaluacion.estado,
                caracter=evaluacion.caracter,
                categoria_estado="HISTORICA" if animal.get("categoria_ml") else None,
                motivos=evaluacion.motivos,
                faltantes=evaluacion.faltantes or evaluacion.evidencia_pendiente,
                evidencia_pendiente=evaluacion.evidencia_pendiente,
                reglas_version=REGLAS_VERSION,
                evaluada_at=_now_iso(),
                procedencia=_procedencia(animal=animal, partos=partos, evidencia=evidencia),
            ),
        )
        changed = True
    return _payload(
        animal,
        evaluacion,
        categoria_cambiada=False,
        publicado=False,
        derivado_actualizado=changed,
        alertas=repo.active_alerts(conn, scope_id, animal["id"]),
        alertas_cerradas=0,
        procedencia=procedencia,
    )


def _payload(
    animal: dict[str, Any],
    evaluacion: Evaluacion,
    *,
    categoria_cambiada: bool,
    publicado: bool,
    derivado_actualizado: bool,
    alertas: list[dict[str, Any]],
    alertas_cerradas: int,
    procedencia: dict[str, Any],
) -> dict[str, Any]:
    return {
        "cuy_id": str(animal["id"]),
        "estado_evaluacion": evaluacion.estado,
        "caracter": evaluacion.caracter,
        "clase": evaluacion.clase,
        "clase_informativa": evaluacion.clase,
        "estado_calidad": evaluacion.estado_calidad,
        "motivos": evaluacion.motivos,
        "campos_faltantes": evaluacion.faltantes,
        "evidencia_pendiente": evaluacion.evidencia_pendiente,
        "fundamentos": [_fundamento_view(item) for item in evaluacion.fundamentos],
        "categoria_persistida": evaluacion.estado == "DEFINITIVA",
        "categoria_historica": bool(animal.get("categoria_ml")) and evaluacion.estado != "DEFINITIVA",
        "categoria": {
            "clase": animal.get("categoria_ml"),
            "caracter": animal.get("categoria_caracter"),
            "categoria_estado": (
                "HISTORICA" if bool(animal.get("categoria_ml")) and evaluacion.estado != "DEFINITIVA"
                else animal.get("categoria_estado")
            ),
        },
        "alertas": [_alert_view(item) for item in alertas],
        "alertas_cerradas": alertas_cerradas,
        "reglas_version": REGLAS_VERSION,
        "procedencia": procedencia,
        "categoria_cambiada": categoria_cambiada,
        "publicado": publicado,
        "derivado_actualizado": derivado_actualizado,
    }


def evaluate_reproductora(
    scope_id: UUID,
    cuy_id: UUID,
    *,
    abortos: int | None,
    peso_monta_g: Decimal | None,
    base_version: int | None,
    base_partos_version: int | None,
    actor: UUID | None = None,
) -> dict[str, Any]:
    from backend.app.database import get_connection

    with get_connection() as conn:
        try:
            animal = repo.get_animal_for_update(conn, scope_id, cuy_id)
            if animal is None or animal.get("deleted_at") is not None:
                raise EvaluationNotFound()
            partos = repo.partos_summary(conn, scope_id, cuy_id)
            if base_version is not None and int(animal.get("server_version") or 0) != base_version:
                raise EvaluationStale(
                    "El animal cambió después de leerlo; vuelve a cargar y evalúa de nuevo"
                )
            if base_partos_version is not None and partos["max_version"] != base_partos_version:
                raise EvaluationStale(
                    "Los partos cambiaron después de leerlos; vuelve a cargar y evalúa de nuevo"
                )
            # Los valores del cuerpo son declaraciones, nunca evidencia oficial.
            if abortos is not None:
                repo.upsert_evidence(
                    conn, scope_id, cuy_id, "abortos", normalize_value("abortos", abortos),
                    origen="DECLARADA", declarada_por=actor,
                )
            if peso_monta_g is not None:
                repo.upsert_evidence(
                    conn, scope_id, cuy_id, "peso_monta_g",
                    normalize_value("peso_monta_g", peso_monta_g),
                    origen="DECLARADA", declarada_por=actor,
                )
            evidencia = repo.reviewed_evidence(conn, scope_id, cuy_id)
            # El resultado informativo usa lo declarado; la persistencia oficial
            # exige que el campo esté REVISADO.
            declarada = {
                item["campo"]: item["valor"]
                for item in repo.list_evidence(conn, scope_id, cuy_id)
                if item["estado"] != "RECHAZADA" and item["valor"] is not None
            }
            abortos_efectivo = evidencia.get("abortos", declarada.get("abortos"))
            peso_efectivo = evidencia.get("peso_monta_g", declarada.get("peso_monta_g"))
            abortos_oficial = int(abortos_efectivo) if abortos_efectivo is not None else None
            datos = {
                "partos_acumulados": partos["total"],
                "abortos": abortos_oficial,
                "peso_monta_g": Decimal(peso_efectivo) if peso_efectivo is not None else None,
                "fecha_ultimo_parto": partos["ultima_fecha"],
                "hembra_muerta": False,
            }
            try:
                result = ml_service.predecir_hembra_para(animal, datos)
            except ml_service.MlNoAplica as error:
                raise EvaluationError(error.codigo, error.mensaje, 422) from None
            except ml_service.MlDatosInsuficientes as error:
                raise EvaluationError(error.codigo, error.mensaje, 422) from None

            evaluacion = _evaluar_reproductora(
                result, partos=partos, abortos=abortos_oficial, evidencia_revisada=evidencia
            )
            if evaluacion.estado == "DEFINITIVA":
                payload = _persist_official(
                    conn, scope_id, animal, evaluacion, partos=partos, evidencia=evidencia
                )
            else:
                payload = _persist_partial(
                    conn, scope_id, animal, evaluacion, partos=partos, evidencia=evidencia
                )
            conn.commit()
            return payload
        except EvaluationError:
            conn.rollback()
            raise
        except PublicacionError as error:
            conn.rollback()
            raise EvaluationError(error.codigo, error.mensaje, 409) from None
        except Exception:
            conn.rollback()
            raise


def evaluate_candidata(
    scope_id: UUID,
    cuy_id: UUID,
    *,
    base_version: int | None,
    actor: UUID | None = None,
) -> dict[str, Any]:
    """Persiste ELITE/NORMAL de candidata solo con criterios y evidencia revisada."""
    from backend.app.database import get_connection

    with get_connection() as conn:
        try:
            animal = repo.get_animal_for_update(conn, scope_id, cuy_id)
            if animal is None or animal.get("deleted_at") is not None:
                raise EvaluationNotFound()
            if base_version is not None and int(animal.get("server_version") or 0) != base_version:
                raise EvaluationStale(
                    "El animal cambió después de leerlo; vuelve a cargar y evalúa de nuevo"
                )
            evidencia = repo.reviewed_evidence(conn, scope_id, cuy_id)
            if not evidencia:
                evaluacion = Evaluacion(
                    estado="EVIDENCIA_NO_VALIDADA",
                    clase=None,
                    caracter=None,
                    estado_calidad="REVISAR|EVIDENCIA_NO_VALIDADA",
                    motivos=["sin evidencia revisada"],
                    faltantes=[],
                    evidencia_pendiente=list(EVIDENCIA_REQUERIDA_CANDIDATA),
                )
                payload = _persist_partial(
                    conn,
                    scope_id,
                    animal,
                    evaluacion,
                    partos=repo.partos_summary(conn, scope_id, cuy_id),
                    evidencia=evidencia,
                )
                conn.commit()
                return payload

            datos = {
                "nupar_madre": _num(evidencia.get("nupar_madre")),
                "tcnv": _num(evidencia.get("tcnv")),
                "peso_nacimiento_g": _num(evidencia.get("peso_nacimiento_g")),
                "peso_destete_g": _num(evidencia.get("peso_destete_g")),
                "dias_destete": _num(evidencia.get("dias_destete")),
                "peso_monta_g": _num(evidencia.get("peso_monta_g")),
                "ojos": evidencia.get("ojos"),
            }
            try:
                result = ml_service.predecir_candidata_para(animal, datos)
            except ml_service.MlNoAplica as error:
                raise EvaluationError(error.codigo, error.mensaje, 422) from None
            except ml_service.MlDatosInsuficientes as error:
                raise EvaluationError(error.codigo, error.mensaje, 422) from None

            evaluacion = _evaluar_candidata(result, evidencia_revisada=evidencia)
            if evaluacion.estado == "DEFINITIVA":
                payload = _persist_official(
                    conn,
                    scope_id,
                    animal,
                    evaluacion,
                    partos=repo.partos_summary(conn, scope_id, cuy_id),
                    evidencia=evidencia,
                )
            else:
                payload = _persist_partial(
                    conn,
                    scope_id,
                    animal,
                    evaluacion,
                    partos=repo.partos_summary(conn, scope_id, cuy_id),
                    evidencia=evidencia,
                )
            conn.commit()
            return payload
        except EvaluationError:
            conn.rollback()
            raise
        except PublicacionError as error:
            conn.rollback()
            raise EvaluationError(error.codigo, error.mensaje, 409) from None
        except Exception:
            conn.rollback()
            raise


def _num(value: str | None) -> Decimal | int | None:
    if value is None:
        return None
    number = Decimal(value)
    return int(number) if number == number.to_integral_value() else number


def _publish_category(conn, scope_id: UUID, animal: dict[str, Any], clase: str) -> None:
    fields = PUBLISHABLE_FIELDS["cuyes"]
    row = publication_repo.get_record(conn, "cuyes", animal["id"], fields)
    if row is None:
        raise EvaluationError("REGISTRO_INEXISTENTE", "El animal desapareció al publicar", 409)
    current = int(row["server_version"] or 0)
    after = {field: row[field] for field in fields}
    after["categoria_ml"] = clase
    if current == 0:
        before = None
        expected = None
    else:
        snapshot = publication_repo.get_latest_snapshot(conn, scope_id, "cuyes", animal["id"], current)
        if snapshot is None:
            raise EvaluationError(
                "HISTORIAL_INCONSISTENTE", "No existe snapshot de la versión actual del animal", 409
            )
        before = fields_from_snapshot(snapshot, "cuyes")
        expected = current
    publicar_cambios(
        conn,
        scope_id,
        [RegistroPublicacion("cuyes", animal["id"], expected, before, after)],
    )


def _sync_alerts(
    conn,
    scope_id: UUID,
    cuy_id: UUID,
    fundamentos: list[Fundamento],
) -> tuple[list[dict[str, Any]], int]:
    """Solo fundamentos confirmados generan alerta oficial."""
    confirmados = [item for item in fundamentos if item.caracter == "CONFIRMADO"]
    active = repo.active_alerts(conn, scope_id, cuy_id)
    key = lambda item: (
        item["regla_id"],
        item["causa_tipo"],
        str(item["causa_id"]) if item.get("causa_id") else None,
    ) if isinstance(item, dict) else (
        item.regla_id,
        item.causa_tipo,
        str(item.causa_id) if item.causa_id else None,
    )
    index = {key(item) for item in active}
    wanted = {key(item) for item in confirmados}

    for fundamento in confirmados:
        if key(fundamento) in index:
            continue
        alerta = repo.insert_alert(
            conn,
            scope_id,
            cuy_id,
            tipo_alerta=TIPO_ALERTA,
            regla_id=fundamento.regla_id,
            motivo=fundamento.motivo,
            causa_tipo=fundamento.causa_tipo,
            causa_id=fundamento.causa_id,
            causa_fecha=fundamento.causa_fecha,
            fecha_limite=fundamento.fecha_limite,
            reglas_version=REGLAS_VERSION,
        )
        sequence = repo.insert_derived(
            conn, scope_id, "alerta", alerta["id"], int(alerta["server_version"]),
            _alert_snapshot(alerta, _now_iso()),
        )
        repo.set_alert_sequence(conn, alerta["id"], sequence)

    cerradas = 0
    for existing in active:
        if key(existing) in wanted:
            continue
        cerrada = repo.close_alert(conn, existing["id"], "CAUSA_INVALIDADA")
        repo.insert_derived(
            conn, scope_id, "alerta", cerrada["id"], int(cerrada["server_version"]),
            _alert_snapshot(cerrada, _now_iso()),
        )
        cerradas += 1
    return repo.active_alerts(conn, scope_id, cuy_id), cerradas