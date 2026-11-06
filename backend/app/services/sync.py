"""Servicio de sincronizacion de laboratorio."""

import hashlib
import json
from uuid import UUID

from fastapi import HTTPException

from backend.app.database import get_connection
from backend.app.repositories import sync as repo
from backend.app.schemas.sync import SyncOperationResult


def _lab_scope_id() -> UUID:
    return repo.get_or_create_lab_scope()


def _lab_device_id(scope_id: UUID) -> UUID:
    return repo.get_or_create_lab_device(scope_id)


def get_context() -> dict:
    scope_id = _lab_scope_id()
    device_id = _lab_device_id(scope_id)
    return {
        "protocol_version": 1,
        "scope_id": str(scope_id),
        "device_id": str(device_id),
        "limits": {"push_operations": 100, "push_bytes": 1048576, "pull_default": 50, "pull_max": 100},
    }


def process_push(device_id, operations: list[dict]) -> list[dict]:
    scope_id = _lab_scope_id()
    # Device identity resolved from lab identity, never from request body.
    dev_id = _lab_device_id(scope_id)

    # Batch-level validation
    op_ids = []
    record_keys = []
    for op in operations:
        oid = op["operation_id"] if isinstance(op["operation_id"], UUID) else UUID(op["operation_id"])
        op_ids.append(str(oid))
        record_keys.append((op["entity"], str(op["record_id"])))
    if len(set(op_ids)) != len(op_ids):
        raise HTTPException(status_code=422, detail="duplicate operation_id in batch")
    if len(set(record_keys)) != len(record_keys):
        raise HTTPException(status_code=422, detail="duplicate record in batch")

    results = []
    for op in operations:
        result = _process_one(scope_id, dev_id, op)
        results.append(result)
    return results


def _fingerprint(op: dict) -> str:
    def _convert(obj):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, dict):
            return {k: _convert(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_convert(i) for i in obj]
        return obj
    canonical = json.dumps(_convert(op), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _validate(entity, action, data, base_version):
    if entity == "galpon":
        if action == "create":
            if not isinstance(data, dict):
                return "INVALID_DATA"
            nombre = data.get("nombre")
            if not isinstance(nombre, str) or not (1 <= len(nombre) <= 120):
                return "INVALID_DATA"
            ubicacion = data.get("ubicacion")
            if ubicacion is not None and (not isinstance(ubicacion, str) or len(ubicacion) > 255):
                return "INVALID_DATA"
        elif action == "update":
            if base_version is None:
                return "VERSION_CONFLICT"
            if not isinstance(data, dict):
                return "INVALID_DATA"
            nombre = data.get("nombre")
            if not isinstance(nombre, str) or not (1 <= len(nombre) <= 120):
                return "INVALID_DATA"
            ubicacion = data.get("ubicacion")
            if ubicacion is not None and (not isinstance(ubicacion, str) or len(ubicacion) > 255):
                return "INVALID_DATA"
    elif entity == "poza":
        if action == "create":
            if not isinstance(data, dict):
                return "INVALID_DATA"
            galpon_id = data.get("galpon_id")
            try:
                UUID(galpon_id)
            except (ValueError, TypeError):
                return "INVALID_DATA"
            codigo = data.get("codigo")
            if not isinstance(codigo, str) or not (1 <= len(codigo) <= 50):
                return "INVALID_DATA"
            tipo = data.get("tipo")
            if not isinstance(tipo, str) or not (1 <= len(tipo) <= 50):
                return "INVALID_DATA"
            cap = data.get("capacidad_maxima")
            if not isinstance(cap, int) or isinstance(cap, bool) or not (0 <= cap <= 2147483647):
                return "INVALID_DATA"
        elif action == "update":
            if base_version is None:
                return "VERSION_CONFLICT"
            if not isinstance(data, dict):
                return "INVALID_DATA"
            galpon_id = data.get("galpon_id")
            try:
                UUID(galpon_id)
            except (ValueError, TypeError):
                return "INVALID_DATA"
            codigo = data.get("codigo")
            if not isinstance(codigo, str) or not (1 <= len(codigo) <= 50):
                return "INVALID_DATA"
            tipo = data.get("tipo")
            if not isinstance(tipo, str) or not (1 <= len(tipo) <= 50):
                return "INVALID_DATA"
            cap = data.get("capacidad_maxima")
            if not isinstance(cap, int) or isinstance(cap, bool) or not (0 <= cap <= 2147483647):
                return "INVALID_DATA"
    else:
        return "INVALID_ENTITY"
    if action not in ("create", "update"):
        return "INVALID_ACTION"
    return None


def _process_one(scope_id, device_id, op) -> dict:
    op_id = op["operation_id"] if isinstance(op["operation_id"], UUID) else UUID(op["operation_id"])
    entity = op["entity"]
    record_id = op["record_id"] if isinstance(op["record_id"], UUID) else UUID(op["record_id"])
    action = op["action"]
    base_version = op.get("base_version")
    data = op.get("data")

    req_hash = _fingerprint(op)

    # Early validation
    if entity not in ("galpon", "poza"):
        result = _rejected(op_id, entity, record_id, "INVALID_ENTITY", None)
        repo.save_receipt(scope_id, device_id, op_id, req_hash, result)
        return result
    if action not in ("create", "update"):
        result = _rejected(op_id, entity, record_id, "INVALID_ACTION", None)
        repo.save_receipt(scope_id, device_id, op_id, req_hash, result)
        return result
    verror = _validate(entity, action, data, base_version)
    if verror:
        result = _rejected(op_id, entity, record_id, verror, None)
        repo.save_receipt(scope_id, device_id, op_id, req_hash, result)
        return result

    with get_connection() as conn:
        conn.autocommit = False
        try:
            repo.lock_scope(conn, scope_id)

            # Check receipt inside transaction
            receipt = repo.get_receipt_conn(conn, scope_id, device_id, op_id)
            if receipt is not None:
                if receipt["request_hash"] == req_hash:
                    conn.commit()
                    return receipt["response"]
                else:
                    result = _rejected(op_id, entity, record_id, "OPERATION_ID_REUSED", None)
                    conn.commit()
                    return result

            if entity == "galpon":
                current = repo.get_galpon_conn(conn, scope_id, record_id)
            else:
                current = repo.get_poza_conn(conn, scope_id, record_id)

            if action == "create":
                if current is not None:
                    result = _rejected(op_id, entity, record_id, "RECORD_EXISTS",
                                       _record_from_row(current, entity))
                    repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                    conn.commit()
                    return result
                version = 1
                if entity == "galpon":
                    repo.upsert_galpon_conn(conn, scope_id, record_id, data["nombre"], data.get("ubicacion"), version)
                else:
                    gid = UUID(data["galpon_id"])
                    if not repo.galpon_exists_conn(conn, scope_id, gid):
                        result = _rejected(op_id, entity, record_id, "RELATION_INACTIVE", None)
                        repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                        conn.commit()
                        return result
                    repo.upsert_poza_conn(conn, scope_id, record_id, gid, data["codigo"], data["tipo"], data["capacidad_maxima"], version)
                new_record = _build_record(record_id, version, data, entity)
                result = _accepted(op_id, entity, record_id, new_record, True)
            else:  # update
                if current is None:
                    result = _rejected(op_id, entity, record_id, "RECORD_UNAVAILABLE", None)
                    repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                    conn.commit()
                    return result
                if current.get("deleted_at") is not None:
                    result = _conflict(op_id, entity, record_id, "RECORD_DELETED",
                                       _record_from_row(current, entity))
                    repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                    conn.commit()
                    return result
                current_version = current.get("version", 0)
                if str(current_version) != str(base_version):
                    result = _conflict(op_id, entity, record_id, "VERSION_CONFLICT",
                                       _record_from_row(current, entity))
                    repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                    conn.commit()
                    return result

                if entity == "poza":
                    if str(current["galpon_id"]) != str(data["galpon_id"]):
                        result = _rejected(op_id, entity, record_id, "RELATION_INACTIVE",
                                           _record_from_row(current, entity))
                        repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                        conn.commit()
                        return result
                    gid = UUID(data["galpon_id"])
                    if not repo.galpon_exists_conn(conn, scope_id, gid):
                        result = _rejected(op_id, entity, record_id, "RELATION_INACTIVE",
                                           _record_from_row(current, entity))
                        repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                        conn.commit()
                        return result

                # Idempotent update: same effective data → accepted/changed=false
                current_data = _extract_data(current, entity)
                if _effective_equal(current_data, data, entity):
                    result = _accepted(op_id, entity, record_id, _record_from_row(current, entity), False)
                    repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
                    conn.commit()
                    return result

                version = current_version + 1
                if entity == "galpon":
                    repo.upsert_galpon_conn(conn, scope_id, record_id, data["nombre"], data.get("ubicacion"), version)
                else:
                    repo.upsert_poza_conn(conn, scope_id, record_id, UUID(data["galpon_id"]), data["codigo"], data["tipo"], data["capacidad_maxima"], version)
                new_record = _build_record(record_id, version, data, entity)
                result = _accepted(op_id, entity, record_id, new_record, True)

            # Atomic: increment sequence + change + receipt (only if changed)
            if result.get("changed"):
                seq = repo.increment_scope(conn, scope_id)
                snapshot = data if data else {}
                repo.insert_change(conn, scope_id, seq, entity, record_id, int(result["record"]["version"]), snapshot)
            repo.save_receipt_conn(conn, scope_id, device_id, op_id, req_hash, result)
            conn.commit()
            return result
        except Exception:
            conn.rollback()
            raise


def _extract_data(row, entity):
    if entity == "galpon":
        return {"nombre": row.get("nombre"), "ubicacion": row.get("ubicacion")}
    return {"galpon_id": str(row.get("galpon_id")), "codigo": row.get("codigo"),
            "tipo": row.get("tipo"), "capacidad_maxima": row.get("capacidad")}


def _effective_equal(current_data, new_data, entity):
    if entity == "galpon":
        return (current_data.get("nombre") == new_data.get("nombre") and
                current_data.get("ubicacion") == new_data.get("ubicacion"))
    return (str(current_data.get("galpon_id")) == str(new_data.get("galpon_id")) and
            current_data.get("codigo") == new_data.get("codigo") and
            current_data.get("tipo") == new_data.get("tipo") and
            current_data.get("capacidad_maxima") == new_data.get("capacidad_maxima"))


def _record_from_row(row, entity):
    now = row.get("updated_at")
    if hasattr(now, "isoformat"):
        now = now.isoformat().replace("+00:00", "Z")
    if not now:
        now = "2026-11-05T00:00:00.000000Z"
    if not str(now).endswith("Z"):
        now = str(now) + "Z"
    deleted = row.get("deleted_at")
    if deleted is not None and hasattr(deleted, "isoformat"):
        deleted = deleted.isoformat().replace("+00:00", "Z")
        if not str(deleted).endswith("Z"):
            deleted = str(deleted) + "Z"
    if deleted is None:
        deleted = None
    if entity == "galpon":
        return {
            "id": str(row["id"]),
            "version": str(row["version"]),
            "created_at": _fmt(row.get("created_at")),
            "updated_at": _fmt(row.get("updated_at")),
            "deleted_at": deleted,
            "last_client_edited_at": _fmt(row.get("last_client_edited_at")),
            "data": {"nombre": row["nombre"], "ubicacion": row.get("ubicacion")},
        }
    return {
        "id": str(row["id"]),
        "version": str(row["version"]),
        "created_at": _fmt(row.get("created_at")),
        "updated_at": _fmt(row.get("updated_at")),
        "deleted_at": deleted,
        "last_client_edited_at": _fmt(row.get("last_client_edited_at")),
        "data": {"galpon_id": str(row["galpon_id"]), "codigo": row["codigo"],
                 "tipo": row["tipo"], "capacidad_maxima": row["capacidad"]},
    }


def _fmt(v):
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        s = v.isoformat().replace("+00:00", "Z")
        if not s.endswith("Z"):
            s = s + "Z"
        return s
    return str(v)


def _build_record(record_id, version, data, entity) -> dict:
    now = "2026-11-05T00:00:00.000000Z"
    if entity == "galpon":
        return {
            "id": str(record_id),
            "version": str(version),
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
            "last_client_edited_at": now,
            "data": {"nombre": data["nombre"], "ubicacion": data.get("ubicacion")},
        }
    return {
        "id": str(record_id),
        "version": str(version),
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
        "last_client_edited_at": now,
        "data": {"galpon_id": data["galpon_id"], "codigo": data["codigo"],
                 "tipo": data["tipo"], "capacidad_maxima": data["capacidad_maxima"]},
    }


def _accepted(op_id, entity, record_id, record, changed) -> dict:
    return {
        "operation_id": str(op_id),
        "entity": entity,
        "record_id": str(record_id),
        "status": "accepted",
        "changed": changed,
        "code": None,
        "record": record,
    }


def _rejected(op_id, entity, record_id, code, record) -> dict:
    return {
        "operation_id": str(op_id),
        "entity": entity,
        "record_id": str(record_id),
        "status": "rejected",
        "changed": False,
        "code": code,
        "record": record,
    }


def _conflict(op_id, entity, record_id, code, record) -> dict:
    return {
        "operation_id": str(op_id),
        "entity": entity,
        "record_id": str(record_id),
        "status": "conflict",
        "changed": False,
        "code": code,
        "record": record,
    }
