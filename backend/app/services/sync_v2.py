"""Push v2 de dominio: escritura, publicación, versión y recibo en una transacción."""

from datetime import datetime, timezone
import json
from uuid import UUID

import psycopg

from backend.app.database import get_connection
from backend.app.repositories import sync as repo
from backend.app.services import sync as sync_v1
from backend.app.services.publication import (
    PUBLISHABLE_FIELDS,
    PublicacionError,
    RegistroPublicacion,
    _canonical,
    publicar_cambios,
)

TABLES = {
    'cuyes': 'cuyes',
    'partos': 'partos',
    'pesajes': 'pesajes',
    'eventos': 'eventos',
    'parto_crias': 'parto_crias',
}

# Campos que el cliente puede escribir. Es la allowlist de
# docs/integracion/plan-incremental-cliente-sync-ui.md §3: excluye campos
# derivados del servidor (categoria_ml, ultimo_peso_g) y el tombstone.
CLIENT_FIELDS: dict[str, tuple[str, ...]] = {
    'cuyes': (
        'poza_id',
        'galpon_origen_id',
        'codigo_identificacion',
        'sexo',
        'fecha_nacimiento',
        'color_codigo',
        'ojos_codigo',
        'pelaje_original',
        'padre_id',
        'madre_id',
        'estado',
    ),
    'partos': (
        'madre_id',
        'fecha_parto',
        'numero_parto',
        'nacidos_vivos',
        'nacidos_muertos',
        'tamano_camada_nacida',
    ),
    'pesajes': ('cuy_id', 'fecha_pesaje', 'peso_gramos', 'etapa', 'parto_id', 'evento_id'),
    'eventos': ('cuy_id', 'tipo', 'fecha', 'macho_id', 'poza_origen_id', 'poza_destino_id', 'detalle'),
    'parto_crias': ('parto_id', 'cuy_id', 'rol'),
}

REFERENCES: dict[str, dict[str, str]] = {
    'cuyes': {
        'poza_id': 'pozas',
        'galpon_origen_id': 'galpones',
        'padre_id': 'cuyes',
        'madre_id': 'cuyes',
    },
    'partos': {'madre_id': 'cuyes'},
    'pesajes': {'cuy_id': 'cuyes', 'parto_id': 'partos', 'evento_id': 'eventos'},
    'eventos': {
        'cuy_id': 'cuyes',
        'macho_id': 'cuyes',
        'poza_origen_id': 'pozas',
        'poza_destino_id': 'pozas',
    },
    'parto_crias': {'parto_id': 'partos', 'cuy_id': 'cuyes'},
}


class PushV2Error(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _result(operation: dict, status: str, changed: bool, code: str | None = None, record: dict | None = None) -> dict:
    return {
        'operation_id': str(operation['operation_id']),
        'entity': operation['entity'],
        'record_id': str(operation['record_id']),
        'status': status,
        'changed': changed,
        'code': code,
        'record': record,
    }


def _validate_data(entity: str, data: object) -> dict:
    if entity not in CLIENT_FIELDS:
        raise PushV2Error('ENTIDAD_NO_PERMITIDA', 'entidad no permitida en v2')
    if not isinstance(data, dict):
        raise PushV2Error('DATOS_INVALIDOS', 'data debe ser un objeto')
    allowed = set(CLIENT_FIELDS[entity])
    if set(data) != allowed:
        missing = sorted(allowed - set(data))
        extra = sorted(set(data) - allowed)
        raise PushV2Error('CAMPOS_INVALIDOS', f'faltan={missing}, sobran={extra}')
    return {key: data[key] for key in CLIENT_FIELDS[entity]}


def _check_references(conn, scope_id, entity: str, data: dict, rejected: set[tuple[str, str]]) -> str | None:
    for field, table in REFERENCES[entity].items():
        value = data.get(field)
        if value is None:
            continue
        if (table, str(value)) in rejected:
            return 'DEPENDENCY_REJECTED'
        deleted = '' if table == 'parto_crias' else ' AND deleted_at IS NULL'
        row = conn.execute(
            f'SELECT 1 FROM {table} WHERE id = %s AND scope_id = %s{deleted}', (value, scope_id)
        ).fetchone()
        if row is None:
            # Mismo resultado para una referencia inexistente y para una que
            # pertenece a otro ámbito: no se revela la propiedad.
            return 'DEPENDENCY_PENDING'
    return None


def _read_row(conn, entity: str, record_id, scope_id) -> dict | None:
    fields = PUBLISHABLE_FIELDS[entity]
    extra = (
        'created_at, created_at AS updated_at, NULL::timestamptz AS deleted_at, last_client_edited_at'
        if entity == 'parto_crias'
        else 'created_at, updated_at, deleted_at, last_client_edited_at'
    )
    row = conn.execute(
        f'SELECT server_version, {extra}, {", ".join(fields)} FROM {TABLES[entity]} WHERE id = %s AND scope_id = %s',
        (record_id, scope_id),
    ).fetchone()
    if row is None:
        return None
    values = {
        'server_version': row[0],
        'created_at': row[1],
        'updated_at': row[2],
        'deleted_at': row[3],
        'last_client_edited_at': row[4],
    }
    for index, field in enumerate(fields, start=5):
        values[field] = row[index]
    return values


def _before_snapshot(conn, scope_id, entity, record_id, version) -> dict | None:
    row = conn.execute(
        'SELECT snapshot FROM sync_changes WHERE scope_id=%s AND entity=%s AND record_id=%s AND record_version=%s '
        'ORDER BY sequence DESC LIMIT 1',
        (scope_id, entity, record_id, version),
    ).fetchone()
    if row is None:
        return None
    snapshot = row[0]
    if isinstance(snapshot, str):
        snapshot = json.loads(snapshot)
    data = snapshot.get('data') if isinstance(snapshot, dict) else None
    if not isinstance(data, dict):
        return None
    fields = PUBLISHABLE_FIELDS[entity]
    result = {field: data.get(field) for field in fields if field != 'deleted_at'}
    if 'deleted_at' in fields:
        result['deleted_at'] = snapshot.get('deleted_at')
    return {field: result.get(field) for field in fields}


def _json(value):
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, UUID):
        return str(value)
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    if value.__class__.__module__ == 'decimal':
        return format(value, 'f')
    return value


def _serialize_record(entity: str, row: dict, version: int) -> dict:
    return {
        'id': str(row['id']),
        'version': str(version),
        'created_at': _json(row['created_at']),
        'updated_at': _json(row['updated_at']),
        'deleted_at': _json(row['deleted_at']),
        'last_client_edited_at': _json(row.get('last_client_edited_at')),
        'data': {field: _json(row[field]) for field in CLIENT_FIELDS[entity]},
    }


def _same_client_data(entity: str, data: dict, before: dict) -> bool:
    return all(_canonical(data[field], field) == _canonical(before.get(field), field) for field in CLIENT_FIELDS[entity])


def _apply_sql(conn, entity: str, operation: dict, data: dict, scope_id):
    table = TABLES[entity]
    fields = CLIENT_FIELDS[entity]
    record_id = operation['record_id']
    now = _now()
    if operation['action'] == 'create':
        # Se comprueba sin filtrar por ámbito para no distinguir una colisión
        # local de una ajena; en ambos casos la respuesta es la misma.
        exists = conn.execute(f'SELECT 1 FROM {table} WHERE id=%s', (record_id,)).fetchone()
        if exists:
            raise PushV2Error('ALREADY_EXISTS', 'el UUID ya existe')
        columns = ['id', 'scope_id', *fields, 'created_at']
        values = [record_id, scope_id, *[data[f] for f in fields], now]
        if entity != 'parto_crias':
            columns.append('updated_at')
            values.append(now)
        placeholders = ','.join(['%s'] * len(columns))
        conn.execute(f'INSERT INTO {table} ({",".join(columns)}) VALUES ({placeholders})', values)
        return None, True

    row = conn.execute(
        f'SELECT server_version FROM {table} WHERE id=%s AND scope_id=%s FOR UPDATE', (record_id, scope_id)
    ).fetchone()
    if row is None:
        raise PushV2Error('REGISTRO_NO_ENCONTRADO', 'registro inexistente en el ámbito')
    current = int(row[0])
    expected = int(operation['base_version'])
    if current != expected:
        return ('conflict', f'versión esperada {expected}, actual {current}'), False
    before = _before_snapshot(conn, scope_id, entity, record_id, expected)
    if before is None:
        raise PushV2Error('HISTORIAL_INCONSISTENTE', 'no hay snapshot de la versión actual')
    if _same_client_data(entity, data, before):
        return before, False
    assignments = [f'{f}=%s' for f in fields]
    values = [data[f] for f in fields]
    if entity != 'parto_crias':
        assignments.append('updated_at=%s')
        values.append(now)
    values.extend([record_id, scope_id])
    conn.execute(f'UPDATE {table} SET {", ".join(assignments)} WHERE id=%s AND scope_id=%s', values)
    return before, True


def _process_one(scope_id, device_id, operation: dict, rejected: set[tuple[str, str]]) -> dict:
    entity = operation['entity']
    record_id = operation['record_id']
    fingerprint = sync_v1._fingerprint(operation)
    with get_connection() as conn:
        # Igual que v1: serializa por ámbito antes de leer el recibo, de modo
        # que dos reintentos concurrentes no publiquen dos veces.
        repo.lock_scope(conn, scope_id)
        receipt = repo.get_receipt_conn(conn, scope_id, device_id, operation['operation_id'])
        if receipt is not None:
            if receipt['request_hash'] != fingerprint:
                return _result(operation, 'rejected', False, 'OPERATION_ID_REUSED')
            return json.loads(receipt['response']) if isinstance(receipt['response'], str) else receipt['response']
        try:
            data = _validate_data(entity, operation['data'])
            dependency = _check_references(conn, scope_id, entity, data, rejected)
            if dependency:
                result = _result(operation, 'rejected', False, dependency)
                repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
                conn.commit()
                return result
            before, _changed = _apply_sql(conn, entity, operation, data, scope_id)
            if isinstance(before, tuple) and before[0] == 'conflict':
                conflict_row = _read_row(conn, entity, record_id, scope_id)
                conflict_record = None
                if conflict_row is not None:
                    conflict_record = _serialize_record(
                        entity, {**conflict_row, 'id': record_id}, int(conflict_row['server_version'])
                    )
                result = _result(operation, 'conflict', False, 'VERSION_CONFLICT', conflict_record)
                repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
                conn.commit()
                return result
            row = _read_row(conn, entity, record_id, scope_id)
            if row is None:
                raise PushV2Error('REGISTRO_NO_ENCONTRADO', 'la fila no quedó escrita')
            after = {field: row[field] for field in PUBLISHABLE_FIELDS[entity]}
            expected_version = None if operation['action'] == 'create' else int(operation['base_version'])
            published = publicar_cambios(
                conn,
                scope_id,
                [
                    RegistroPublicacion(
                        entity=entity,
                        id=record_id,
                        expected_version=expected_version,
                        before=before if isinstance(before, dict) else None,
                        after=after,
                    )
                ],
            )[0]
            row['id'] = record_id
            record = _serialize_record(entity, row, published.version)
            result = _result(operation, 'accepted', published.changed, None, record)
            repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
            conn.commit()
            return result
        except PushV2Error as error:
            conn.rollback()
            result = _result(operation, 'rejected', False, error.code)
            repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
            conn.commit()
            return result
        except PublicacionError as error:
            conn.rollback()
            result = _result(operation, 'rejected', False, error.codigo)
            repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
            conn.commit()
            return result
        except psycopg.errors.UniqueViolation:
            conn.rollback()
            result = _result(operation, 'conflict', False, 'UNIQUE_CONFLICT')
            repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
            conn.commit()
            return result
        except psycopg.errors.ForeignKeyViolation:
            conn.rollback()
            result = _result(operation, 'rejected', False, 'DEPENDENCY_PENDING')
            repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
            conn.commit()
            return result
        except psycopg.Error:
            conn.rollback()
            result = _result(operation, 'rejected', False, 'DATOS_INVALIDOS')
            repo.save_receipt_conn(conn, scope_id, device_id, operation['operation_id'], fingerprint, result)
            conn.commit()
            return result


def process_push_v2(token: str, device_id_body, operations: list[dict]) -> list[dict]:
    identity = sync_v1.authenticate(token)
    if identity is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail='UNAUTHORIZED')
    scope_id = identity['scope_id']
    device_id = identity['device_id']
    if UUID(str(device_id_body)) != device_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail='DEVICE_NOT_AUTHORIZED')
    results = []
    rejected: set[tuple[str, str]] = set()
    for operation in operations:
        try:
            result = _process_one(scope_id, device_id, operation, rejected)
        except PushV2Error as error:
            result = _result(operation, 'rejected', False, error.code)
        results.append(result)
        key = (operation['entity'], str(operation['record_id']))
        if result['status'] != 'accepted':
            rejected.add(key)
        else:
            rejected.discard(key)
    return results

