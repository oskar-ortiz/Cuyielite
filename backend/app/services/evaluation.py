"""Evaluación persistente de reproductoras y alertas de descarte.

Reglas de dominio confirmadas por Diery (2026-11-16):

* Si faltan datos, la función devuelve NORMAL + estado REVISAR. Eso es
  informativo y **no** se persiste como categoría definitiva.
* Solo una evaluación definitiva escribe ``cuyes.categoria_ml``.
* El apoyo del Random Forest nunca modifica la clase de reglas.
* Una recomendación de descarte no ejecuta el descarte del animal.

Las causas de alerta no se inventan: se derivan de los motivos que emiten las
reglas de ``ml/rules`` y se mapean a identificadores estables. Si un DESCARTE no
trae un motivo conocido, no se crea alerta y se informa la causa no identificada.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
import json
from typing import Any
from uuid import UUID

from backend.app.repositories import evaluation as repo
from backend.app.repositories import publication as publication_repo
from backend.app.services import ml as ml_service
from backend.app.services.publication import (
    PUBLISHABLE_FIELDS,
    PublicacionError,
    RegistroPublicacion,
    publicar_cambios,
)

REGLAS_VERSION = "adr0004+reglas-2026-11-16"
TIPO_ALERTA = "DESCARTE_REPRODUCTORA"

# Motivo emitido por ml/rules -> (regla_id estable, tipo de causa).
# Ambos motivos están en ml/rules/clasificar.py; no se agregan umbrales nuevos.
RULE_BY_MOTIVO: dict[str, tuple[str, str]] = {
    "ciclo completo": ("partos_reproductora_descarte", "PARTO"),
    "problema repetido (se dejo un parto mas)": (
        "abortos_repetidos_descarte",
        "HISTORIA_REPRODUCTIVA",
    ),
}

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
class EvaluationOutcome:
    payload: dict[str, Any]


def _normalize(text: str) -> str:
    replacements = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n"}
    folded = text.strip().casefold()
    for accent, plain in replacements.items():
        folded = folded.replace(accent, plain)
    return folded


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _stable(value: Any) -> str:
    """Serialización estable para comparar contenido sin datos volátiles."""
    if isinstance(value, dict):
        value = {key: item for key, item in value.items() if key != "evaluada_at"}
        procedencia = value.get("procedencia")
        if isinstance(procedencia, dict):
            value["procedencia"] = {
                key: item
                for key, item in procedencia.items()
                if key != "cuy_server_version"
            }
    return _json(value)


def _missing_fields(motivos: list[str]) -> list[str]:
    fields: list[str] = []
    for motivo in motivos:
        normalized = _normalize(motivo)
        for prefix in MISSING_PREFIXES:
            if normalized.startswith(prefix):
                field = normalized[len(prefix) :].strip()
                if field and field not in fields:
                    fields.append(field)
    return fields


def _quality_tokens(estado: str | None) -> set[str]:
    return {token.strip().upper() for token in (estado or "").split("|") if token.strip()}


def _category_snapshot(
    *,
    cuy_id: UUID,
    version: int,
    clase: str | None,
    estado_evaluacion: str,
    categoria_estado: str | None,
    motivos: list[str],
    faltantes: list[str],
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
            "categoria_estado": categoria_estado,
            "motivos": motivos,
            "faltantes": faltantes,
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


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "date") and not isinstance(value, date):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _procedencia(
    *,
    animal: dict[str, Any],
    partos: dict[str, Any],
    abortos: int | None,
    peso_monta_g: Decimal | None,
) -> dict[str, Any]:
    return {
        "fuente": "CENTRAL",
        "cuy_server_version": int(animal.get("server_version") or 0),
        "partos": {
            "total": partos["total"],
            "max_server_version": partos["max_version"],
            "ultimo_parto_id": str(partos["ultimo_parto_id"]) if partos["ultimo_parto_id"] else None,
            "ultima_fecha": _iso(partos["ultima_fecha"]),
        },
        "declarados": {
            "abortos": abortos,
            "peso_monta_g": format(peso_monta_g, "f") if peso_monta_g is not None else None,
        },
        "reglas_version": REGLAS_VERSION,
    }


def _causes(
    *,
    motivos: list[str],
    partos: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Traduce motivos de DESCARTE a causas con identidad estable."""
    causes: list[dict[str, Any]] = []
    unknown: list[str] = []
    days = _days_until_exit()
    for motivo in motivos:
        mapped = RULE_BY_MOTIVO.get(_normalize(motivo))
        if mapped is None:
            unknown.append(motivo)
            continue
        regla_id, causa_tipo = mapped
        causa_id = None
        causa_fecha: date | None = None
        fecha_limite: date | None = None
        if causa_tipo == "PARTO":
            cuarto = partos.get("cuarto")
            if cuarto is not None:
                causa_id = cuarto["id"]
                causa_fecha = cuarto.get("fecha_parto")
                if causa_fecha is not None:
                    fecha_limite = causa_fecha + timedelta(days=days)
            elif not partos.get("cuarto_ambiguo"):
                # Sin parto identificable no se inventa un evento causal.
                causa_tipo = "HISTORIA_REPRODUCTIVA"
        causes.append(
            {
                "regla_id": regla_id,
                "causa_tipo": causa_tipo,
                "causa_id": causa_id,
                "causa_fecha": causa_fecha,
                "fecha_limite": fecha_limite,
                "motivo": motivo,
            }
        )
    return causes, unknown


def _days_until_exit() -> int:
    from ml.rules import criterios

    return int(criterios.CRITERIOS["dias_hasta_salida_despues_parto"].valor)


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


def _category_view(animal: dict[str, Any]) -> dict[str, Any]:
    return {
        "clase": animal.get("categoria_ml"),
        "categoria_estado": animal.get("categoria_estado"),
        "motivos": animal.get("categoria_motivos") or [],
        "faltantes": animal.get("categoria_faltantes") or [],
        "reglas_version": animal.get("categoria_reglas_version"),
        "evaluada_at": _iso(animal.get("categoria_evaluada_at")),
        "procedencia": animal.get("categoria_procedencia") or {},
        "server_version": int(animal.get("categoria_server_version") or 0),
    }


def _inputs(partos: dict[str, Any], abortos: int | None, peso: Decimal | None) -> dict[str, Any]:
    return {
        "partos_acumulados": partos["total"],
        "abortos": abortos,
        "peso_monta_g": peso,
        "fecha_ultimo_parto": partos["ultima_fecha"],
        "hembra_muerta": False,
    }


def context(scope_id: UUID, cuy_id: UUID) -> dict[str, Any]:
    """Estado actual sin escribir nada: base para decidir si evaluar."""
    from psycopg.rows import dict_row

    from backend.app.database import get_connection

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT id, sexo, estado, deleted_at, server_version, "
                + ", ".join(repo.CATEGORY_COLUMNS)
                + " FROM cuyes WHERE id = %s AND scope_id = %s AND deleted_at IS NULL",
                (cuy_id, scope_id),
            )
            animal = cur.fetchone()
        if animal is None:
            raise EvaluationNotFound()
        animal = dict(animal)
        partos = repo.partos_summary(conn, scope_id, cuy_id)
        alerts = repo.list_alerts(conn, scope_id, cuy_id)
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
        "cuarto_parto_identificado": partos["cuarto"] is not None,
        "categoria": _category_view(animal),
        "alertas": [_alert_view(item) for item in alerts],
        "reglas_version": REGLAS_VERSION,
    }


def evaluate_and_persist(
    scope_id: UUID,
    cuy_id: UUID,
    *,
    abortos: int | None,
    peso_monta_g: Decimal | None,
    base_version: int | None,
    base_partos_version: int | None,
) -> dict[str, Any]:
    """Ejecuta las reglas con datos centrales y persiste solo lo definitivo.

    La transacción es única: categoría, alertas, publicación de dominio y feed
    derivado se confirman juntos o se revierten juntos.
    """
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

            datos = _inputs(partos, abortos, peso_monta_g)
            try:
                result = ml_service.predecir_hembra_para(animal, datos)
            except ml_service.MlNoAplica as error:
                raise EvaluationError(error.codigo, error.mensaje, 422) from None
            except ml_service.MlDatosInsuficientes as error:
                raise EvaluationError(error.codigo, error.mensaje, 422) from None

            motivos = list(result["motivos"])
            faltantes = _missing_fields(motivos)
            tokens = _quality_tokens(result["estado_calidad"])
            definitiva = "REVISAR" not in tokens and result["clase"] in {"NORMAL", "DESCARTE"}
            procedencia = _procedencia(
                animal=animal, partos=partos, abortos=abortos, peso_monta_g=peso_monta_g
            )

            if not definitiva:
                payload = _handle_insufficient(
                    conn, scope_id, animal, result, motivos, faltantes, procedencia
                )
            else:
                payload = _handle_definitive(
                    conn,
                    scope_id,
                    animal,
                    result,
                    partos,
                    motivos,
                    faltantes,
                    procedencia,
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


def _handle_insufficient(
    conn,
    scope_id: UUID,
    animal: dict[str, Any],
    result: dict[str, Any],
    motivos: list[str],
    faltantes: list[str],
    procedencia: dict[str, Any],
) -> dict[str, Any]:
    """NORMAL+REVISAR no se persiste; la categoría previa queda histórica."""
    version = repo.mark_category_historical(conn, scope_id, animal["id"]) if animal.get("categoria_ml") else 0
    evaluated_at = _now_iso()
    if version:
        snapshot = _category_snapshot(
            cuy_id=animal["id"],
            version=version,
            clase=animal.get("categoria_ml"),
            estado_evaluacion="DATOS_INSUFICIENTES",
            categoria_estado="HISTORICA",
            motivos=list(animal.get("categoria_motivos") or []),
            faltantes=faltantes,
            reglas_version=str(animal.get("categoria_reglas_version") or REGLAS_VERSION),
            evaluada_at=evaluated_at,
            procedencia=animal.get("categoria_procedencia") or {},
        )
        repo.insert_derived(conn, scope_id, "categoria", animal["id"], version, snapshot)

    return {
        "cuy_id": str(animal["id"]),
        "estado_evaluacion": "DATOS_INSUFICIENTES",
        "clase": None,
        "clase_informativa": result["clase"],
        "motivos": motivos,
        "campos_faltantes": faltantes,
        "estado_calidad": result["estado_calidad"],
        "categoria_persistida": False,
        "categoria_historica": bool(version),
        "categoria": {
            "clase": animal.get("categoria_ml"),
            "categoria_estado": "HISTORICA" if version else animal.get("categoria_estado"),
        },
        "alertas": [_alert_view(item) for item in repo.active_alerts(conn, scope_id, animal["id"])],
        "reglas_version": REGLAS_VERSION,
        "procedencia": procedencia,
        "categoria_cambiada": False,
    }


def _handle_definitive(
    conn,
    scope_id: UUID,
    animal: dict[str, Any],
    result: dict[str, Any],
    partos: dict[str, Any],
    motivos: list[str],
    faltantes: list[str],
    procedencia: dict[str, Any],
) -> dict[str, Any]:
    clase = result["clase"]
    causes, desconocidas = _causes(motivos=motivos, partos=partos) if clase == "DESCARTE" else ([], [])

    category_changed = animal.get("categoria_ml") != clase
    content = {
        "cuy_id": str(animal["id"]),
        "clase": clase,
        "estado_evaluacion": "DEFINITIVA",
        "categoria_estado": "DEFINITIVA",
        "motivos": motivos,
        "faltantes": faltantes,
        "reglas_version": REGLAS_VERSION,
        "procedencia": procedencia,
        "apoyo_modelo": None,
    }
    previous = repo.latest_derived(conn, scope_id, "categoria", animal["id"])
    changed = previous is None or _stable(previous["snapshot"].get("data")) != _stable(content)

    version = repo.update_category(
        conn,
        scope_id,
        animal["id"],
        clase=clase,
        estado="DEFINITIVA",
        motivos=motivos,
        faltantes=faltantes,
        reglas_version=REGLAS_VERSION,
        procedencia=_json(procedencia),
        bump_version=changed,
    )

    if changed:
        snapshot = _category_snapshot(
            cuy_id=animal["id"],
            version=version,
            clase=clase,
            estado_evaluacion="DEFINITIVA",
            categoria_estado="DEFINITIVA",
            motivos=motivos,
            faltantes=faltantes,
            reglas_version=REGLAS_VERSION,
            evaluada_at=_now_iso(),
            procedencia=procedencia,
        )
        repo.insert_derived(conn, scope_id, "categoria", animal["id"], version, snapshot)

    published = False
    if category_changed:
        _publish_category(conn, scope_id, animal, clase)
        published = True

    alertas, cerradas = _sync_alerts(conn, scope_id, animal["id"], causes)

    return {
        "cuy_id": str(animal["id"]),
        "estado_evaluacion": "DEFINITIVA",
        "clase": clase,
        "clase_informativa": clase,
        "motivos": motivos,
        "campos_faltantes": faltantes,
        "estado_calidad": result["estado_calidad"],
        "categoria_persistida": True,
        "categoria_historica": False,
        "categoria": {
            "clase": clase,
            "categoria_estado": "DEFINITIVA",
            "reglas_version": REGLAS_VERSION,
        },
        "alertas": [_alert_view(item) for item in alertas],
        "alertas_cerradas": cerradas,
        "causas_no_reconocidas": desconocidas,
        "reglas_version": REGLAS_VERSION,
        "procedencia": procedencia,
        "categoria_cambiada": category_changed,
        "publicado": published,
        "derivado_actualizado": changed,
    }


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
                "HISTORIAL_INCONSISTENTE",
                "No existe snapshot de la versión actual del animal",
                409,
            )
        from backend.app.services.publication import fields_from_snapshot

        before = fields_from_snapshot(snapshot, "cuyes")
        expected = current
    publicar_cambios(
        conn,
        scope_id,
        [
            RegistroPublicacion(
                entity="cuyes",
                id=animal["id"],
                expected_version=expected,
                before=before,
                after=after,
            )
        ],
    )


def _sync_alerts(
    conn,
    scope_id: UUID,
    cuy_id: UUID,
    causes: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    active = repo.active_alerts(conn, scope_id, cuy_id)
    key = lambda item: (
        item["regla_id"],
        item["causa_tipo"],
        str(item["causa_id"]) if item.get("causa_id") else None,
    )
    index = {key(item): item for item in active}
    wanted = {key(cause) for cause in causes}

    created: list[dict[str, Any]] = []
    for cause in causes:
        if key(cause) in index:
            continue
        alerta = repo.insert_alert(
            conn,
            scope_id,
            cuy_id,
            tipo_alerta=TIPO_ALERTA,
            regla_id=cause["regla_id"],
            motivo=cause["motivo"],
            causa_tipo=cause["causa_tipo"],
            causa_id=cause["causa_id"],
            causa_fecha=cause["causa_fecha"],
            fecha_limite=cause["fecha_limite"],
            reglas_version=REGLAS_VERSION,
        )
        sequence = repo.insert_derived(
            conn,
            scope_id,
            "alerta",
            alerta["id"],
            int(alerta["server_version"]),
            _alert_snapshot(alerta, _now_iso()),
        )
        repo.set_alert_sequence(conn, alerta["id"], sequence)
        created.append(alerta)

    closed = 0
    for existing in active:
        if key(existing) in wanted:
            continue
        cerrada = repo.close_alert(conn, existing["id"], "CAUSA_INVALIDADA")
        repo.insert_derived(
            conn,
            scope_id,
            "alerta",
            cerrada["id"],
            int(cerrada["server_version"]),
            _alert_snapshot(cerrada, _now_iso()),
        )
        closed += 1

    return repo.active_alerts(conn, scope_id, cuy_id), closed


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
