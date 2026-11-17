"""Integración del manifiesto acordado (`lope_promocion/v1`) con el orquestador.

El recorrido usa componentes reales: el orquestador `promote_batch`, el
publicador `publicar_cambios` sobre la misma conexión y el pull v2. Solo se usa
un publicador falso para comprobar la reversión ante fallo.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import urllib.parse
import uuid

import psycopg
import pytest

from tools.lope_import.manifest import (
    CONTRACT_VERSION,
    parse_manifiesto,
    promover_manifiesto,
)
from tools.lope_import.promote import PromocionError

REPO_ROOT = Path(__file__).resolve().parents[3]
DDL_DIR = REPO_ROOT / "db" / "ddl" / "central"
MIGRATIONS_DIR = Path(
    os.environ.get(
        "LOPE_TEST_MIGRATIONS_DIR",
        REPO_ROOT / "db" / "migrations" / "central",
    )
)


def _base_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL desechable")
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname not in {"localhost", "127.0.0.1"}:
        pytest.fail("TEST_DATABASE_URL debe apuntar a localhost")
    nombre = parsed.path.lstrip("/")
    if not nombre.startswith(("cuyelite_", "cuyielite_")) or nombre in {
        "cuyelite",
        "cuyielite",
        "cuyelite_pilot",
        "cuyielite_pilot",
    }:
        pytest.fail("TEST_DATABASE_URL debe usar una base aislada con prefijo cuyelite_")
    return url


def _admin_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    return urllib.parse.urlunparse(parsed._replace(path="/postgres"))


@pytest.fixture(scope="module")
def fresh_db():
    base_url = _base_url()
    database_name = f"cuyielite_lope_manifest_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(_admin_url(base_url), autocommit=True) as admin:
        admin.execute(f'CREATE DATABASE "{database_name}"')
    parsed = urllib.parse.urlparse(base_url)
    database_url = urllib.parse.urlunparse(parsed._replace(path=f"/{database_name}"))
    try:
        with psycopg.connect(database_url, autocommit=True) as bootstrap:
            for sql_file in sorted(DDL_DIR.glob("*.sql")):
                bootstrap.execute(sql_file.read_text(encoding="utf-8"))
        from tools.db_migrate.runner import apply_migrations

        apply_migrations(database_url, directory=MIGRATIONS_DIR)
        yield database_url
    finally:
        with psycopg.connect(_admin_url(base_url), autocommit=True) as admin:
            admin.execute(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)')


@pytest.fixture
def labio(fresh_db):
    """Ámbito sintético con galpón y poza de referencia."""
    scope_id = uuid.uuid4()
    galpon_id = uuid.uuid4()
    with psycopg.connect(fresh_db) as conn:
        conn.execute("INSERT INTO sync_scopes (id, name) VALUES (%s, %s)", (scope_id, "sintetico"))
        conn.execute(
            "INSERT INTO galpones (id, scope_id, nombre) VALUES (%s, %s, %s)",
            (galpon_id, scope_id, "Galpon sintetico"),
        )
        conn.execute(
            "INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, scope_id) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (uuid.uuid4(), galpon_id, "P-SINT", "cria", 10, scope_id),
        )
        conn.commit()
    return {"url": fresh_db, "scope": scope_id, "galpon": galpon_id}


def _ids(scope_id):
    """Identidades de dominio estables por ámbito (como las acepta el ETL)."""
    def make(name: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{scope_id}:{name}"))

    return {
        "cuy_existente": make("cuy-existente"),
        "cuy_nueva": make("cuy-nueva"),
        "parto": make("parto"),
        "evento": make("evento"),
        "pesaje": make("pesaje"),
        "vinculo": make("vinculo"),
    }


def _huella(scope_id: str, prefijo: str) -> str:
    return hashlib.sha256(f"{prefijo}-{scope_id}".encode()).hexdigest()


def _manifiesto(scope_id, lote_id, huella, parser_version="p1.0.0", mapeo_version="m1.0.0"):
    return {
        "contract_version": CONTRACT_VERSION,
        "batch": {
            "lote_id": str(lote_id),
            "idempotency_key": {
                "huella_archivo": huella,
                "parser_version": parser_version,
                "mapeo_version": mapeo_version,
            },
        },
        "scope": {"scope_id": str(scope_id), "config_alias": "SINTETICO"},
        "correspondencias_aceptadas": [],
        "registros": [],
    }


def _correspondencia(scope_id, huella, entidad_id, entidad_tipo, celda, rol, fila=1):
    """El origen es estable por (huella, hoja, celda, fila, rol, tipo)."""
    return {
        "origen_id": str(
            uuid.uuid5(uuid.NAMESPACE_URL, f"origen:{scope_id}:{huella}:{entidad_id}")
        ),
        "origen": {
            "hoja": "Sintetica",
            "celda": celda,
            "fila": fila,
            "rol": rol,
            "entidad_tipo": entidad_tipo,
        },
        "estado": "ACEPTADO",
        "entidad_id": str(entidad_id),
        "revisor": "revisor-sintetico",
        "evidencia": "Revision sintetica de la ficha.",
    }


def _cuy_101(galpon_id, ids, ultimo_peso=940.0):
    return {
        "poza_id": None,
        "galpon_origen_id": str(galpon_id),
        "codigo_identificacion": "H-007",
        "sexo": "H",
        "fecha_nacimiento": "2025-02-01",
        "color_codigo": "B",
        "ojos_codigo": "1",
        "pelaje_original": "B",
        "padre_id": None,
        "madre_id": None,
        "categoria_ml": None,
        "ultimo_peso_g": ultimo_peso,
        "estado": "ACTIVO",
        "deleted_at": None,
    }


def _manifiesto_cinco_entidades(scope_id, lote_id, galpon_id, huella=None):
    """El ejemplo acordado: corrección de una cuy publicada y filas nuevas."""
    if huella is None:
        huella = _huella(scope_id, "manifiesto")
    ids = _ids(scope_id)
    manifiesto = _manifiesto(scope_id, lote_id, huella)
    manifiesto["correspondencias_aceptadas"] = [
        _correspondencia(scope_id, huella, ids["cuy_existente"], "cuyes", "A2", "ANIMAL", 2),
        _correspondencia(scope_id, huella, ids["cuy_nueva"], "cuyes", "A3", "ANIMAL", 3),
        _correspondencia(scope_id, huella, ids["parto"], "partos", "E4", "PARTO_01", 4),
        _correspondencia(scope_id, huella, ids["evento"], "eventos", "B2", "EMPADRE", 2),
        _correspondencia(scope_id, huella, ids["pesaje"], "pesajes", "B2", "PESAJE_MONTA", 2),
        _correspondencia(scope_id, huella, ids["vinculo"], "parto_crias", "A3", "CRIA_DE_PARTO", 3),
    ]
    manifiesto["registros"] = [
        {
            "entity": "cuyes",
            "id": ids["cuy_existente"],
            "expected_version": 1,
            "before": _cuy_101(galpon_id, ids),
            "after": _cuy_101(galpon_id, ids, 950.0),
        },
        {
            "entity": "cuyes",
            "id": ids["cuy_nueva"],
            "expected_version": None,
            "before": None,
            "after": {
                "poza_id": None,
                "galpon_origen_id": str(galpon_id),
                "codigo_identificacion": "C-2026-001",
                "sexo": "H",
                "fecha_nacimiento": "2026-01-20",
                "color_codigo": None,
                "ojos_codigo": None,
                "pelaje_original": None,
                "padre_id": None,
                "madre_id": ids["cuy_existente"],
                "categoria_ml": None,
                "ultimo_peso_g": None,
                "estado": None,
                "deleted_at": None,
            },
        },
        {
            "entity": "partos",
            "id": ids["parto"],
            "expected_version": None,
            "before": None,
            "after": {
                "madre_id": ids["cuy_existente"],
                "fecha_parto": "2026-01-20",
                "numero_parto": 4,
                "nacidos_vivos": 1,
                "nacidos_muertos": 0,
                "tamano_camada_nacida": 1,
                "deleted_at": None,
            },
        },
        {
            "entity": "eventos",
            "id": ids["evento"],
            "expected_version": None,
            "before": None,
            "after": {
                "cuy_id": ids["cuy_existente"],
                "tipo": "EMPADRE",
                "fecha": "2026-01-05",
                "macho_id": None,
                "poza_origen_id": None,
                "poza_destino_id": None,
                "detalle": None,
                "deleted_at": None,
            },
        },
        {
            "entity": "pesajes",
            "id": ids["pesaje"],
            "expected_version": None,
            "before": None,
            "after": {
                "cuy_id": ids["cuy_existente"],
                "fecha_pesaje": "2026-01-05",
                "peso_gramos": 950.0,
                "etapa": "MONTA",
                "parto_id": None,
                "evento_id": ids["evento"],
                "deleted_at": None,
            },
        },
        {
            "entity": "parto_crias",
            "id": ids["vinculo"],
            "expected_version": None,
            "before": None,
            "after": {"parto_id": ids["parto"], "cuy_id": ids["cuy_nueva"], "rol": "CRIA"},
        },
    ]
    return manifiesto


def _publicar_cuy_previa(url, scope_id, lote_id, galpon_id):
    """Publica la cuy que la corrección del ejemplo viene a modificar."""
    ids = _ids(scope_id)
    manifiesto = _manifiesto(scope_id, lote_id, _huella(scope_id, "previo"))
    manifiesto["correspondencias_aceptadas"] = [
        _correspondencia(
            scope_id, manifiesto["batch"]["idempotency_key"]["huella_archivo"],
            ids["cuy_existente"], "cuyes", "A2", "ANIMAL", 2,
        )
    ]
    manifiesto["registros"] = [
        {
            "entity": "cuyes",
            "id": ids["cuy_existente"],
            "expected_version": None,
            "before": None,
            "after": _cuy_101(galpon_id, ids),
        }
    ]
    with psycopg.connect(url) as conn:
        promover_manifiesto(conn, scope_id, manifiesto, dry_run=False)
        conn.commit()


def _conteo(url, scope_id):
    with psycopg.connect(url) as conn:
        return {
            "cuyes": conn.execute(
                "SELECT count(*) FROM cuyes WHERE scope_id=%s", (scope_id,)
            ).fetchone()[0],
            "cambios": conn.execute(
                "SELECT count(*) FROM sync_changes WHERE scope_id=%s", (scope_id,)
            ).fetchone()[0],
            "secuencia": conn.execute(
                "SELECT last_sequence FROM sync_scopes WHERE id=%s", (scope_id,)
            ).fetchone()[0],
            "lotes": conn.execute(
                "SELECT count(*) FROM importacion_lotes WHERE scope_id=%s", (scope_id,)
            ).fetchone()[0],
            "correspondencias": conn.execute(
                "SELECT count(*) FROM importacion_correspondencias WHERE lote_id IN "
                "(SELECT id FROM importacion_lotes WHERE scope_id=%s)",
                (scope_id,),
            ).fetchone()[0],
        }


def test_manifiesto_acepta_las_cinco_entidades_del_contrato(labio):
    manifiesto = _manifiesto_cinco_entidades(
        labio["scope"], uuid.uuid4(), labio["galpon"]
    )
    parsed = parse_manifiesto(manifiesto, authorized_scope_id=labio["scope"])
    assert {item.entidad_tipo for item in parsed.correspondencias} == {
        "cuyes",
        "partos",
        "eventos",
        "pesajes",
        "parto_crias",
    }
    assert len(parsed.registros) == 6


def test_dry_run_no_persiste_nada(labio):
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])
    with psycopg.connect(labio["url"]) as conn:
        with pytest.raises(Exception):
            # La corrección exige una cuy previa publicada; el dry-run falla igual
            # y no debe dejar nada escrito.
            promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=True)
        conn.rollback()
    conteo = _conteo(labio["url"], labio["scope"])
    assert conteo["cuyes"] == 0
    assert conteo["cambios"] == 0
    assert conteo["secuencia"] == 0
    assert conteo["lotes"] == 0
    assert conteo["correspondencias"] == 0


def test_promocion_confirmada_publica_las_cinco_entidades(labio):
    _publicar_cuy_previa(labio["url"], labio["scope"], uuid.uuid4(), labio["galpon"])
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])
    with psycopg.connect(labio["url"]) as conn:
        resultado = promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.commit()
    assert resultado.total == 6
    assert resultado.changed_count == 6

    conteo = _conteo(labio["url"], labio["scope"])
    assert conteo["cuyes"] == 2
    assert conteo["cambios"] == 7  # 1 fila previa + 6 registros
    assert conteo["secuencia"] == 7
    assert conteo["lotes"] == 2
    assert conteo["correspondencias"] == 7

    ids = _ids(labio["scope"])
    with psycopg.connect(labio["url"]) as conn:
        versiones = {
            (entidad, registro): version
            for entidad, registro, version in conn.execute(
                "SELECT entity, record_id, record_version FROM sync_changes WHERE scope_id=%s",
                (labio["scope"],),
            ).fetchall()
        }
        assert versiones[("cuyes", uuid.UUID(ids["cuy_nueva"]))] == 1
        assert versiones[("partos", uuid.UUID(ids["parto"]))] == 1
        assert versiones[("pesajes", uuid.UUID(ids["pesaje"]))] == 1
        assert versiones[("parto_crias", uuid.UUID(ids["vinculo"]))] == 1
        assert versiones[("cuyes", uuid.UUID(ids["cuy_existente"]))] == 2
        estado_lote = conn.execute(
            "SELECT estado FROM importacion_lotes WHERE id=%s", (lote_id,)
        ).fetchone()[0]
        assert estado_lote == "APLICADO"


def test_pull_v2_entrega_lo_publicado(labio, monkeypatch):
    import secrets

    from backend.app.repositories import sync as sync_repo
    from backend.app.services.sync import pull_changes

    _publicar_cuy_previa(labio["url"], labio["scope"], uuid.uuid4(), labio["galpon"])
    manifiesto = _manifiesto_cinco_entidades(
        labio["scope"], uuid.uuid4(), labio["galpon"]
    )
    with psycopg.connect(labio["url"]) as conn:
        promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.commit()

    monkeypatch.setenv("DATABASE_URL", labio["url"])
    token = secrets.token_urlsafe(32)
    sync_repo.register_device(
        labio["scope"], hashlib.sha256(token.encode()).hexdigest()
    )
    monkeypatch.setenv("SYNC_CURSOR_SIGNING_KEY", "synthetic-test-key-never-for-production-0123456789")
    pagina = pull_changes(token, None, 50, protocol=2)
    por_entidad = {item["entity"]: item["record"] for item in pagina["items"]}
    assert set(por_entidad) >= {"cuyes", "partos", "eventos", "pesajes", "parto_crias"}
    ids = _ids(labio["scope"])
    cuyes = [
        item["record"]["data"]
        for item in pagina["items"]
        if item["entity"] == "cuyes"
    ]
    assert {
        cuy["codigo_identificacion"]: cuy["ultimo_peso_g"] for cuy in cuyes
    } == {"H-007": "950.00", "C-2026-001": None}
    assert por_entidad["partos"]["data"]["fecha_parto"] == "2026-01-20"
    assert por_entidad["pesajes"]["data"]["peso_gramos"] == "950.00"
    assert por_entidad["pesajes"]["data"]["evento_id"] == ids["evento"]
    assert por_entidad["parto_crias"]["data"]["cuy_id"] == ids["cuy_nueva"]
    assert por_entidad["parto_crias"]["data"]["parto_id"] == ids["parto"]


def test_repetir_el_mismo_lote_no_duplica_nada(labio):
    _publicar_cuy_previa(labio["url"], labio["scope"], uuid.uuid4(), labio["galpon"])
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])
    with psycopg.connect(labio["url"]) as conn:
        promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.commit()
    antes = _conteo(labio["url"], labio["scope"])

    with psycopg.connect(labio["url"]) as conn:
        resultado = promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.commit()
    assert resultado.changed_count == 0
    assert resultado.total == 6
    despues = _conteo(labio["url"], labio["scope"])
    assert despues == antes


def test_la_misma_tupla_en_otro_ambito_se_rechaza(labio):
    otro_scope = uuid.uuid4()
    with psycopg.connect(labio["url"]) as conn:
        conn.execute("INSERT INTO sync_scopes (id, name) VALUES (%s, %s)", (otro_scope, "otro"))
        conn.commit()

    _publicar_cuy_previa(labio["url"], labio["scope"], uuid.uuid4(), labio["galpon"])
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])
    with psycopg.connect(labio["url"]) as conn:
        promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.commit()
    antes = _conteo(labio["url"], labio["scope"])

    huella = _huella(labio["scope"], "manifiesto")
    manifiesto_otro = _manifiesto_cinco_entidades(
        otro_scope, lote_id, labio["galpon"], huella=huella
    )
    with psycopg.connect(labio["url"]) as conn:
        with pytest.raises(PromocionError):
            promover_manifiesto(conn, otro_scope, manifiesto_otro, dry_run=False)
        conn.rollback()
    assert _conteo(labio["url"], labio["scope"]) == antes
    with psycopg.connect(labio["url"]) as conn:
        assert conn.execute(
            "SELECT scope_id FROM importacion_lotes WHERE id=%s", (lote_id,)
        ).fetchone()[0] == labio["scope"]


def test_ambito_del_manifiesto_distinto_al_autorizado_se_rechaza(labio):
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(
        uuid.uuid4(), lote_id, labio["galpon"]
    )
    with psycopg.connect(labio["url"]) as conn:
        with pytest.raises(PromocionError):
            promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.rollback()
    assert _conteo(labio["url"], labio["scope"])["lotes"] == 0


def test_referencia_cruzada_entre_ambitos_se_rechaza(labio):
    otro_scope = uuid.uuid4()
    otro_cuy = uuid.uuid4()
    with psycopg.connect(labio["url"]) as conn:
        conn.execute("INSERT INTO sync_scopes (id, name) VALUES (%s, %s)", (otro_scope, "otro"))
        conn.execute(
            "INSERT INTO cuyes (id, codigo_identificacion, sexo, estado, scope_id) "
            "VALUES (%s, %s, 'H', 'ACTIVO', %s)",
            (otro_cuy, "OTRA-CUY", otro_scope),
        )
        conn.commit()

    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])
    for registro in manifiesto["registros"]:
        if registro["entity"] == "partos":
            registro["after"]["madre_id"] = str(otro_cuy)
    with psycopg.connect(labio["url"]) as conn:
        with pytest.raises(Exception):
            promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.rollback()
    conteo = _conteo(labio["url"], labio["scope"])
    assert conteo["cuyes"] == 0
    assert conteo["cambios"] == 0
    assert conteo["lotes"] == 0


def test_correspondencia_no_aceptada_se_rechaza(labio):
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])
    manifiesto["correspondencias_aceptadas"][0]["estado"] = "AMBIGUO"
    manifiesto["correspondencias_aceptadas"][0]["entidad_id"] = None
    with psycopg.connect(labio["url"]) as conn:
        with pytest.raises(PromocionError):
            promover_manifiesto(conn, labio["scope"], manifiesto, dry_run=False)
        conn.rollback()
    assert _conteo(labio["url"], labio["scope"])["lotes"] == 0


def test_fallo_de_publicacion_revierte_dominio_y_lote(labio):
    _publicar_cuy_previa(labio["url"], labio["scope"], uuid.uuid4(), labio["galpon"])
    antes = _conteo(labio["url"], labio["scope"])
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])

    class PublicadorQueFalla:
        def __call__(self, conn, scope_id, registros):
            raise RuntimeError("fallo inyectado")

    with psycopg.connect(labio["url"]) as conn:
        with pytest.raises(RuntimeError):
            promover_manifiesto(
                conn, labio["scope"], manifiesto, PublicadorQueFalla(), dry_run=False
            )
        conn.rollback()
    assert _conteo(labio["url"], labio["scope"]) == antes


def test_manifiesto_por_archivo_usa_el_formato_acordado(labio, tmp_path):
    _publicar_cuy_previa(labio["url"], labio["scope"], uuid.uuid4(), labio["galpon"])
    lote_id = uuid.uuid4()
    manifiesto = _manifiesto_cinco_entidades(labio["scope"], lote_id, labio["galpon"])
    ruta = tmp_path / "manifiesto.json"
    ruta.write_text(json.dumps(manifiesto), encoding="utf-8")

    from tools.lope_import.promote import _load_manifest

    payload = _load_manifest(ruta)
    with psycopg.connect(labio["url"]) as conn:
        resultado = promover_manifiesto(conn, labio["scope"], payload, dry_run=False)
        conn.commit()
    assert resultado.changed_count == 6


def test_review_con_decision_humana_se_promueve(labio):
    from tools.lope_import.adapt import adapt_audit
    from tools.lope_import.decisions import build_manifest, create_decisions_template

    huella = _huella(labio["scope"], "review-humana")
    file_id = f"sha256:{huella}"
    origin_ref = f"{file_id}:Individual:C2:ANIMAL:cuyes"
    audit = {
        "contract": "lope_import_audit/v1",
        "parser_version": "p1.0.0",
        "mapeo_version": "m1.0.0",
        "files": [
            {
                "file_id": file_id,
                "sha256_before": huella,
                "sha256_after": huella,
            }
        ],
        "candidates": [
            {
                "kind": "animal",
                "file_id": file_id,
                "origin_ref": origin_ref,
                "animal_no": "SYN-001",
                "sexo": "H",
                "fecha_nacimiento": "2026-01-01",
                "color": "B",
                "ojos": "1",
            }
        ],
        "errors": [],
        "warnings": [],
        "summary": {"files_unchanged": True},
    }
    review = adapt_audit(audit)
    review_bytes = json.dumps(review, ensure_ascii=False).encode("utf-8")
    review_sha256 = hashlib.sha256(review_bytes).hexdigest()
    decisions = create_decisions_template(
        review, review_sha256, lote_id=uuid.uuid4()
    )
    decision = decisions["decisions"][0]
    decision.update(
        {
            "estado": "ACEPTADO",
            "revisor": "revisor-sintetico",
            "evidencia": "Ficha sintética conciliada.",
            "entidad_id": str(uuid.uuid4()),
        }
    )
    decision["after"]["galpon_origen_id"] = str(labio["galpon"])
    decision["after"]["estado"] = "ACTIVO"
    manifest = build_manifest(
        review,
        decisions,
        review_sha256,
        scope_id=labio["scope"],
        config_alias="LOPE-SINTETICO",
    )

    with psycopg.connect(labio["url"]) as conn:
        resultado = promover_manifiesto(
            conn, labio["scope"], manifest, dry_run=False
        )
        conn.commit()
    assert resultado.changed_count == 1
    with psycopg.connect(labio["url"]) as conn:
        publicado = conn.execute(
            "SELECT codigo_identificacion, estado FROM cuyes WHERE id=%s",
            (decision["entidad_id"],),
        ).fetchone()
        assert publicado == ("SYN-001", "ACTIVO")
