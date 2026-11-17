"""Adaptador del manifiesto de promoción acordado (`lope_promocion/v1`).

El manifiesto acordado (`docs/integracion/contrato-dominio-etl-plataforma.md`
§9.7) trae cuatro identidades separadas: ámbito, tupla de idempotencia del
lote, origen estable e identidad de dominio. Este módulo lo traduce al formato
interno que ya consume `promote_batch` y deja persistido el lote, los orígenes y
las correspondencias aceptadas en la misma transacción que el dominio y la
publicación.

Responsabilidades que no se inventan aquí:

* el ámbito se resuelve desde el contexto autorizado y el del manifiesto solo
  se valida; nunca se confía;
* la tupla de idempotencia es la del contrato: huella + versiones de parser y
  mapeo, única y reutilizable solo en su ámbito;
* solo las correspondencias `ACEPTADO` entran en los registros de publicación;
* la escritura de dominio y la publicación siguen siendo del orquestador y de
  `publicar_cambios`; este módulo no publica ni confirma por su cuenta.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence
from uuid import UUID, uuid4

from .promote import (
    PROMOTABLE_ENTITIES,
    PromocionError,
    Publicador,
    ResultadoPromocion,
    publicar_con_d1,
    promote_batch,
)

CONTRACT_VERSION = "lope_promocion/v1"

MANIFEST_KEYS = frozenset(
    {
        "contract_version",
        "batch",
        "scope",
        "correspondencias_aceptadas",
        "registros",
    }
)
BATCH_KEYS = frozenset({"lote_id", "idempotency_key"})
IDEMPOTENCY_KEYS = frozenset({"huella_archivo", "parser_version", "mapeo_version"})
SCOPE_KEYS = frozenset({"scope_id", "config_alias"})
CORRESPONDENCE_KEYS = frozenset(
    {
        "origen_id",
        "origen",
        "estado",
        "entidad_id",
        "revisor",
        "evidencia",
    }
)
ORIGIN_KEYS = frozenset({"hoja", "celda", "fila", "rol", "entidad_tipo"})


@dataclass(frozen=True)
class CorrespondenciaAceptada:
    origen_id: UUID | None
    hoja: str
    celda: str
    fila: int
    rol: str
    entidad_tipo: str
    entidad_id: UUID
    revisor: str | None
    evidencia: str | None


@dataclass(frozen=True)
class ManifiestoPromocion:
    lote_id: UUID
    huella_archivo: str
    parser_version: str
    mapeo_version: str
    scope_id: UUID
    correspondencias: tuple[CorrespondenciaAceptada, ...]
    registros: tuple[Mapping[str, Any], ...]


def _uuid(value: Any, label: str) -> UUID:
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise PromocionError(f"{label} inválido") from error


def _texto(value: Any, label: str, *, maximo: int = 100) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PromocionError(f"{label} inválido")
    text = value.strip()
    if len(text) > maximo:
        raise PromocionError(f"{label} excede el máximo permitido")
    return text


def _publishable_fields(entity: str) -> tuple[str, ...]:
    from backend.app.services.publication import PUBLISHABLE_FIELDS

    try:
        return PUBLISHABLE_FIELDS[entity]
    except KeyError as error:
        raise PromocionError("Entidad fuera del alcance aprobado por el plan") from error


def parse_manifiesto(
    payload: Mapping[str, Any],
    *,
    authorized_scope_id: UUID | str,
) -> ManifiestoPromocion:
    """Valida el manifiesto acordado contra el ámbito autorizado."""
    if not isinstance(payload, Mapping):
        raise PromocionError("El manifiesto debe ser un objeto")
    if set(payload) != set(MANIFEST_KEYS):
        raise PromocionError("El manifiesto no coincide con el contrato acordado")
    if payload["contract_version"] != CONTRACT_VERSION:
        raise PromocionError("Versión de contrato no admitida")

    scope_autorizado = _uuid(authorized_scope_id, "scope_id")
    batch = payload["batch"]
    if not isinstance(batch, Mapping) or set(batch) != set(BATCH_KEYS):
        raise PromocionError("El lote del manifiesto no coincide con el contrato")
    lote_id = _uuid(batch["lote_id"], "lote_id")
    idempotencia = batch["idempotency_key"]
    if not isinstance(idempotencia, Mapping) or set(idempotencia) != set(IDEMPOTENCY_KEYS):
        raise PromocionError("La clave de idempotencia no coincide con el contrato")
    huella = _texto(idempotencia["huella_archivo"], "huella_archivo", maximo=64)
    parser_version = _texto(idempotencia["parser_version"], "parser_version", maximo=20)
    mapeo_version = _texto(idempotencia["mapeo_version"], "mapeo_version", maximo=20)

    scope = payload["scope"]
    if not isinstance(scope, Mapping) or set(scope) != set(SCOPE_KEYS):
        raise PromocionError("El ámbito del manifiesto no coincide con el contrato")
    scope_manifiesto = _uuid(scope["scope_id"], "scope_id")
    if scope_manifiesto != scope_autorizado:
        raise PromocionError("El ámbito del manifiesto no coincide con el ámbito autorizado")

    correspondencias = _parse_correspondencias(payload["correspondencias_aceptadas"])
    registros = _parse_registros(payload["registros"], correspondencias)
    return ManifiestoPromocion(
        lote_id=lote_id,
        huella_archivo=huella,
        parser_version=parser_version,
        mapeo_version=mapeo_version,
        scope_id=scope_autorizado,
        correspondencias=correspondencias,
        registros=registros,
    )


def _parse_correspondencias(value: Any) -> tuple[CorrespondenciaAceptada, ...]:
    if not isinstance(value, list):
        raise PromocionError("correspondencias_aceptadas debe ser una lista")
    resultado: list[CorrespondenciaAceptada] = []
    vistas_entidad: set[UUID] = set()
    vistas_origen: set[tuple[str, str, str, int, str, str]] = set()
    for item in value:
        if not isinstance(item, Mapping) or set(item) != set(CORRESPONDENCE_KEYS):
            raise PromocionError("Una correspondencia no coincide con el contrato")
        if item["estado"] != "ACEPTADO":
            raise PromocionError("Solo las correspondencias ACEPTADO pueden promoverse")
        origen = item["origen"]
        if not isinstance(origen, Mapping) or set(origen) != set(ORIGIN_KEYS):
            raise PromocionError("El origen de la correspondencia no coincide con el contrato")
        entidad_tipo = _texto(origen["entidad_tipo"], "entidad_tipo", maximo=30)
        if entidad_tipo not in PROMOTABLE_ENTITIES:
            raise PromocionError("Tipo de entidad fuera del alcance aprobado")
        hoja = _texto(origen["hoja"], "hoja")
        celda = _texto(origen["celda"], "celda", maximo=20)
        rol = _texto(origen["rol"], "rol", maximo=30)
        fila = origen["fila"]
        if isinstance(fila, bool) or not isinstance(fila, int) or fila < 0:
            raise PromocionError("fila de origen inválida")
        entidad_id = _uuid(item["entidad_id"], "entidad_id")
        if entidad_id in vistas_entidad:
            raise PromocionError("Dos correspondencias apuntan a la misma entidad")
        vistas_entidad.add(entidad_id)
        clave_origen = (huella_placeholder := "", hoja, celda, fila, rol, entidad_tipo)
        if clave_origen in vistas_origen:
            raise PromocionError("Dos correspondencias repiten el mismo origen")
        vistas_origen.add(clave_origen)
        origen_id = item["origen_id"]
        resultado.append(
            CorrespondenciaAceptada(
                origen_id=None if origen_id is None else _uuid(origen_id, "origen_id"),
                hoja=hoja,
                celda=celda,
                fila=fila,
                rol=rol,
                entidad_tipo=entidad_tipo,
                entidad_id=entidad_id,
                revisor=item["revisor"] if item["revisor"] is None else _texto(item["revisor"], "revisor", maximo=100),
                evidencia=item["evidencia"]
                if item["evidencia"] is None
                else _texto(item["evidencia"], "evidencia", maximo=500),
            )
        )
    if not resultado:
        raise PromocionError("El manifiesto no trae correspondencias aceptadas")
    return tuple(resultado)


def _parse_registros(
    value: Any,
    correspondencias: Sequence[CorrespondenciaAceptada],
) -> tuple[Mapping[str, Any], ...]:
    if not isinstance(value, list):
        raise PromocionError("registros debe ser una lista")
    por_entidad = {item.entidad_id: item for item in correspondencias}
    vistos: set[UUID] = set()
    registros: list[Mapping[str, Any]] = []
    for item in value:
        if not isinstance(item, Mapping):
            raise PromocionError("Cada registro debe ser un objeto")
        if set(item) - {"entity", "id", "expected_version", "before", "after"}:
            raise PromocionError("El registro contiene campos no admitidos")
        if not {"entity", "id", "after"} <= set(item):
            raise PromocionError("Faltan campos del registro")
        entity = item["entity"]
        if not isinstance(entity, str) or entity not in PROMOTABLE_ENTITIES:
            raise PromocionError("Entidad fuera del alcance aprobado por el plan")
        record_id = _uuid(item["id"], "id")
        if record_id in vistos:
            raise PromocionError("El lote contiene entidades duplicadas")
        vistos.add(record_id)
        campos = _publishable_fields(entity)
        after = item["after"]
        if not isinstance(after, Mapping) or set(after) != set(campos):
            raise PromocionError("after no coincide con los campos publicables")
        before = item.get("before")
        if before is not None and (
            not isinstance(before, Mapping) or set(before) != set(campos)
        ):
            raise PromocionError("before no coincide con los campos publicables")
        correspondencia = por_entidad.get(record_id)
        if correspondencia is None:
            raise PromocionError("El registro no tiene una correspondencia aceptada")
        if correspondencia.entidad_tipo != entity:
            raise PromocionError("La correspondencia no corresponde al tipo de entidad")
        registros.append(
            {
                "entity": entity,
                "id": record_id,
                "expected_version": item.get("expected_version"),
                "before": before,
                "after": dict(after),
            }
        )
    if len(registros) != len(correspondencias):
        raise PromocionError("Los registros no cubren exactamente las correspondencias aceptadas")
    return tuple(registros)


def _ensure_lote(conn, manifiesto: ManifiestoPromocion) -> None:
    fila = conn.execute(
        "SELECT id, scope_id, estado FROM importacion_lotes "
        "WHERE huella_archivo = %s AND parser_version = %s AND mapeo_version = %s FOR UPDATE",
        (
            manifiesto.huella_archivo,
            manifiesto.parser_version,
            manifiesto.mapeo_version,
        ),
    ).fetchone()
    if fila is None:
        conn.execute(
            "INSERT INTO importacion_lotes "
            "(id, huella_archivo, parser_version, mapeo_version, scope_id, estado) "
            "VALUES (%s, %s, %s, %s, %s, 'PENDIENTE')",
            (
                manifiesto.lote_id,
                manifiesto.huella_archivo,
                manifiesto.parser_version,
                manifiesto.mapeo_version,
                manifiesto.scope_id,
            ),
        )
        return
    lote_id, scope_id, estado = fila
    if lote_id != manifiesto.lote_id:
        raise PromocionError(
            "La tupla de idempotencia ya pertenece a otro lote"
        )
    if scope_id is None:
        raise PromocionError(
            "El lote existente no tiene ámbito registrado; requiere revisión humana"
        )
    if scope_id != manifiesto.scope_id:
        raise PromocionError(
            "La tupla de idempotencia ya fue usada en otro ámbito"
        )
    if estado not in {"PENDIENTE", "APLICADO"}:
        raise PromocionError("El lote no está pendiente de promoción")


def _ensure_origen(conn, manifiesto: ManifiestoPromocion, correspondencia: CorrespondenciaAceptada) -> UUID:
    fila = conn.execute(
        "SELECT id FROM importacion_origenes WHERE huella_archivo = %s AND origen_hoja = %s "
        "AND origen_celda = %s AND origen_fila = %s AND origen_rol = %s AND entidad_tipo = %s "
        "FOR UPDATE",
        (
            manifiesto.huella_archivo,
            correspondencia.hoja,
            correspondencia.celda,
            correspondencia.fila,
            correspondencia.rol,
            correspondencia.entidad_tipo,
        ),
    ).fetchone()
    if fila is not None:
        return fila[0]
    if correspondencia.origen_id is not None:
        existente = conn.execute(
            "SELECT huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, "
            "entidad_tipo FROM importacion_origenes WHERE id = %s FOR UPDATE",
            (correspondencia.origen_id,),
        ).fetchone()
        if existente is not None:
            if tuple(existente) != (
                manifiesto.huella_archivo,
                correspondencia.hoja,
                correspondencia.celda,
                correspondencia.fila,
                correspondencia.rol,
                correspondencia.entidad_tipo,
            ):
                raise PromocionError(
                    "El identificador de origen ya pertenece a otro origen"
                )
            return correspondencia.origen_id
    creado = conn.execute(
        "INSERT INTO importacion_origenes "
        "(id, huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (
            correspondencia.origen_id or uuid4(),
            manifiesto.huella_archivo,
            correspondencia.hoja,
            correspondencia.celda,
            correspondencia.fila,
            correspondencia.rol,
            correspondencia.entidad_tipo,
        ),
    ).fetchone()
    return creado[0]


def _ensure_correspondencia(
    conn,
    manifiesto: ManifiestoPromocion,
    origen_id: UUID,
    correspondencia: CorrespondenciaAceptada,
) -> UUID:
    fila = conn.execute(
        "SELECT id, entidad_id, estado FROM importacion_correspondencias "
        "WHERE origen_id = %s AND lote_id = %s FOR UPDATE",
        (origen_id, manifiesto.lote_id),
    ).fetchone()
    if fila is None:
        creado = conn.execute(
            "INSERT INTO importacion_correspondencias "
            "(origen_id, lote_id, entidad_id, estado, motivo, evidencia, revisor, accepted_at, "
            "parser_version, mapeo_version) "
            "VALUES (%s, %s, %s, 'ACEPTADO', %s, %s, %s, now(), %s, %s) RETURNING id",
            (
                origen_id,
                manifiesto.lote_id,
                correspondencia.entidad_id,
                None,
                correspondencia.evidencia,
                correspondencia.revisor,
                manifiesto.parser_version,
                manifiesto.mapeo_version,
            ),
        ).fetchone()
        return creado[0]
    correspondencia_id, entidad_id, estado = fila
    if estado != "ACEPTADO" or entidad_id != correspondencia.entidad_id:
        raise PromocionError("La correspondencia existente no coincide con la aceptada")
    return correspondencia_id


def preparar_registros(
    conn,
    manifiesto: ManifiestoPromocion,
) -> list[Mapping[str, Any]]:
    """Deja lote, orígenes y correspondencias listos y devuelve los registros."""
    _ensure_lote(conn, manifiesto)
    por_entidad = {item.entidad_id: item for item in manifiesto.correspondencias}
    registros: list[Mapping[str, Any]] = []
    for registro in manifiesto.registros:
        correspondencia = por_entidad[_uuid(registro["id"], "id")]
        origen_id = _ensure_origen(conn, manifiesto, correspondencia)
        correspondencia_id = _ensure_correspondencia(conn, manifiesto, origen_id, correspondencia)
        registros.append({**registro, "correspondencia_id": correspondencia_id})
    return registros


def promover_manifiesto(
    conn,
    authorized_scope_id: UUID | str,
    payload: Mapping[str, Any],
    publicador: Publicador = publicar_con_d1,
    *,
    dry_run: bool = True,
) -> ResultadoPromocion:
    """Promueve el manifiesto acordado con el orquestador y el publicador reales."""
    manifiesto = parse_manifiesto(payload, authorized_scope_id=authorized_scope_id)
    return promote_batch(
        conn,
        manifiesto.scope_id,
        manifiesto.lote_id,
        [],
        publicador,
        dry_run=dry_run,
        preparar=lambda conn, _scope, _lote: preparar_registros(conn, manifiesto),
    )




__all__ = [
    "CONTRACT_VERSION",
    "CorrespondenciaAceptada",
    "ManifiestoPromocion",
    "parse_manifiesto",
    "preparar_registros",
    "promover_manifiesto",
]

