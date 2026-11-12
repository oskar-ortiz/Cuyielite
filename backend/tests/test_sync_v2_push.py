"""Pruebas backend del push v2 de dominio con PostgreSQL temporal aislado.

Cubre el contrato decidido para v2: protocolo explícito, cursor independiente,
escritura de dominio y publicación en la misma transacción, recibo por
operación, allowlists, referencias por ámbito y resultados parciales.
"""

import hashlib
import os
from pathlib import Path
import secrets
import urllib.parse
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

REPO_ROOT = Path(__file__).resolve().parents[2]
DDL_DIR = REPO_ROOT / 'db' / 'ddl' / 'central'
SIGNING_KEY = 'synthetic-v2-key-never-production-0123456789'
MAX_MIGRATION = '0004_publicacion_dominio.sql'


def _base_url() -> str:
    url = os.environ.get('TEST_DATABASE_URL')
    if not url:
        pytest.fail('TEST_DATABASE_URL requerida')
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname not in ('localhost', '127.0.0.1'):
        pytest.fail('host de pruebas inválido')
    return url


def _admin_url(url: str) -> str:
    return urllib.parse.urlunparse(urllib.parse.urlparse(url)._replace(path='/postgres'))


def _new_database(url: str) -> tuple[str, str]:
    name = f'cuyielite_v2_push_{uuid.uuid4().hex[:10]}'
    admin = psycopg.connect(_admin_url(url), autocommit=True)
    try:
        admin.execute(f'CREATE DATABASE "{name}"')
    finally:
        admin.close()
    parsed = urllib.parse.urlparse(url)
    return name, urllib.parse.urlunparse(parsed._replace(path=f'/{name}'))


def _drop_database(url: str, name: str) -> None:
    admin = psycopg.connect(_admin_url(url), autocommit=True)
    try:
        admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
    finally:
        admin.close()


@pytest.fixture(scope='module')
def lab_url():
    base = _base_url()
    name, db_url = _new_database(base)
    try:
        boot = psycopg.connect(db_url, autocommit=True)
        try:
            for sql_file in sorted(DDL_DIR.glob('*.sql')):
                boot.execute(sql_file.read_text(encoding='utf-8'))
        finally:
            boot.close()
        from tools.db_migrate.runner import apply_migrations

        applied = apply_migrations(db_url)
        assert applied[:4] == [
            '0001_lope_domain.sql',
            '0002_sync_lab.sql',
            '0003_rag_e5_embeddings.sql',
            MAX_MIGRATION,
        ]
        yield db_url
    finally:
        _drop_database(base, name)


@pytest.fixture
def lab(lab_url, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', lab_url)
    monkeypatch.setenv('CUYIELITE_SYNC_LAB_ENABLED', '1')
    monkeypatch.setenv('SYNC_CURSOR_SIGNING_KEY', SIGNING_KEY)

    scope = uuid.uuid4()
    device = uuid.uuid4()
    token = secrets.token_urlsafe(32)
    galpon = uuid.uuid4()
    poza = uuid.uuid4()
    with psycopg.connect(lab_url) as conn:
        conn.execute('INSERT INTO sync_scopes (id, name) VALUES (%s, %s)', (scope, f'v2-{scope}'))
        conn.execute(
            'INSERT INTO sync_devices (id, scope_id, token_hash) VALUES (%s, %s, %s)',
            (device, scope, hashlib.sha256(token.encode()).hexdigest()),
        )
        conn.execute("INSERT INTO galpones (id, scope_id, nombre) VALUES (%s, %s, 'G')", (galpon, scope))
        conn.execute(
            "INSERT INTO pozas (id, scope_id, galpon_id, codigo, tipo, capacidad_maxima) "
            "VALUES (%s, %s, %s, 'P', 'cría', 10)",
            (poza, scope, galpon),
        )
    client = TestClient(app, headers={'Authorization': f'Bearer {token}'})
    data = {'url': lab_url, 'scope': scope, 'device': device, 'token': token, 'galpon': galpon, 'poza': poza, 'client': client}
    try:
        yield data
    finally:
        with psycopg.connect(lab_url) as conn:
            for table in ('sync_changes', 'sync_receipts'):
                conn.execute(f'DELETE FROM {table} WHERE scope_id = %s', (scope,))
            for table in ('parto_crias', 'pesajes', 'eventos', 'partos', 'cuyes', 'pozas', 'galpones'):
                conn.execute(f'DELETE FROM {table} WHERE scope_id = %s', (scope,))
            conn.execute('DELETE FROM sync_devices WHERE scope_id = %s', (scope,))
            conn.execute('DELETE FROM sync_scopes WHERE id = %s', (scope,))


def _op(entity, record_id, data, action='create', base_version=None):
    return {
        'operation_id': str(uuid.uuid4()),
        'entity': entity,
        'record_id': str(record_id),
        'action': action,
        'base_version': base_version,
        'client_created_at': '2026-11-12T10:00:00Z',
        'client_edited_at': None if action == 'create' else '2026-11-12T11:00:00Z',
        'data': data,
    }


def _push(lab, operations, protocol=2):
    return lab['client'].post(
        '/sync/v2/push',
        json={'protocol_version': protocol, 'device_id': str(lab['device']), 'operations': operations},
    )


def _one(lab, operation):
    response = _push(lab, [operation])
    assert response.status_code == 200, response.text
    return response.json()['results'][0]


def cuy_data(lab, code, poza=None):
    return {
        'poza_id': str(poza or lab['poza']),
        'galpon_origen_id': None,
        'codigo_identificacion': code,
        'sexo': 'H',
        'fecha_nacimiento': '2025-03-12',
        'color_codigo': None,
        'ojos_codigo': None,
        'pelaje_original': None,
        'padre_id': None,
        'madre_id': None,
        'estado': 'ACTIVO',
    }


def parto_data(madre_id):
    return {
        'madre_id': str(madre_id),
        'fecha_parto': '2026-01-20',
        'numero_parto': 1,
        'nacidos_vivos': 2,
        'nacidos_muertos': 0,
        'tamano_camada_nacida': 2,
    }


def pesaje_data(cuy_id, parto_id=None, evento_id=None, peso='995.00'):
    return {
        'cuy_id': str(cuy_id),
        'fecha_pesaje': '2026-01-20',
        'peso_gramos': peso,
        'etapa': 'PARTO',
        'parto_id': None if parto_id is None else str(parto_id),
        'evento_id': None if evento_id is None else str(evento_id),
    }


def evento_data(cuy_id, detalle=None):
    return {
        'cuy_id': str(cuy_id),
        'tipo': 'DESTETE',
        'fecha': '2026-02-04',
        'macho_id': None,
        'poza_origen_id': None,
        'poza_destino_id': None,
        'detalle': detalle,
    }


def parto_cria_data(parto_id, cuy_id, rol='CRIA'):
    return {'parto_id': str(parto_id), 'cuy_id': str(cuy_id), 'rol': rol}


def _create_one(lab, entity, record_id, data):
    result = _one(lab, _op(entity, record_id, data))
    assert result['status'] == 'accepted', result
    return result


def test_v1_intacto_y_contexto_v2(lab):
    client = lab['client']
    context = client.get('/sync/context')
    assert context.status_code == 200 and context.json()['protocol_version'] == 1

    domain = _op('cuyes', uuid.uuid4(), cuy_data(lab, 'V1-NO'))
    v1_domain = client.post(
        '/sync/push',
        json={'protocol_version': 1, 'device_id': str(lab['device']), 'operations': [domain]},
    )
    assert v1_domain.status_code == 422

    galpon = uuid.uuid4()
    v1_galpon = client.post(
        '/sync/push',
        json={
            'protocol_version': 1,
            'device_id': str(lab['device']),
            'operations': [
                {
                    'operation_id': str(uuid.uuid4()),
                    'entity': 'galpon',
                    'record_id': str(galpon),
                    'action': 'create',
                    'base_version': None,
                    'client_created_at': '2026-11-12T10:00:00Z',
                    'data': {'nombre': 'Galpón v1', 'ubicacion': None},
                }
            ],
        },
    )
    assert v1_galpon.status_code == 200 and v1_galpon.json()['results'][0]['status'] == 'accepted'

    v2_context = client.get('/sync/v2/context')
    assert v2_context.status_code == 200
    assert v2_context.json()['protocol_version'] == 2
    assert set(v2_context.json()['supported_entities']) == {'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias'}

    extra = _push(lab, [_op('cuyes', uuid.uuid4(), cuy_data(lab, 'V2-NO'))])
    assert extra.status_code == 200
    wrong_protocol = client.post(
        '/sync/v2/push',
        json={'protocol_version': 1, 'device_id': str(lab['device']), 'operations': []},
    )
    assert wrong_protocol.status_code == 422


def test_autenticacion_device_y_ambito(lab):
    anonymous = TestClient(app)
    assert anonymous.get('/sync/v2/context').status_code == 401
    assert anonymous.post('/sync/v2/push', json={'protocol_version': 2, 'device_id': str(lab['device']), 'operations': []}).status_code == 401

    other = TestClient(app, headers={'Authorization': f"Bearer {lab['token']}"})
    wrong_device = other.post(
        '/sync/v2/push',
        json={'protocol_version': 2, 'device_id': str(uuid.uuid4()), 'operations': []},
    )
    assert wrong_device.status_code == 403

    body_with_scope = other.post(
        '/sync/v2/push',
        json={
            'protocol_version': 2,
            'device_id': str(lab['device']),
            'scope_id': str(uuid.uuid4()),
            'operations': [],
        },
    )
    assert body_with_scope.status_code == 422

    with psycopg.connect(lab['url']) as conn:
        foreign_scope = uuid.uuid4()
        foreign_galpon = uuid.uuid4()
        foreign_poza = uuid.uuid4()
        conn.execute('INSERT INTO sync_scopes (id, name) VALUES (%s, %s)', (foreign_scope, f'f-{foreign_scope}'))
        conn.execute("INSERT INTO galpones (id, scope_id, nombre) VALUES (%s, %s, 'FG')", (foreign_galpon, foreign_scope))
        conn.execute(
            "INSERT INTO pozas (id, scope_id, galpon_id, codigo, tipo, capacidad_maxima) "
            "VALUES (%s, %s, %s, 'FP', 'cría', 5)",
            (foreign_poza, foreign_scope, foreign_galpon),
        )
    cross = _one(lab, _op('cuyes', uuid.uuid4(), cuy_data(lab, 'CROSS', poza=foreign_poza)))
    assert cross['status'] == 'rejected' and cross['code'] == 'DEPENDENCY_PENDING'
    assert cross['record'] is None


def test_create_y_update_de_las_cinco_entidades(lab):
    client = lab['client']
    madre = uuid.uuid4()
    madre_result = _create_one(lab, 'cuyes', madre, cuy_data(lab, 'MADRE-1'))
    assert madre_result['record']['version'] == '1'
    assert 'categoria_ml' not in madre_result['record']['data']
    assert 'ultimo_peso_g' not in madre_result['record']['data']

    parto = uuid.uuid4()
    parto_result = _create_one(lab, 'partos', parto, parto_data(madre))
    assert parto_result['record']['data']['fecha_parto'] == '2026-01-20'

    cria = uuid.uuid4()
    _create_one(lab, 'cuyes', cria, cuy_data(lab, 'CRIA-1'))
    cria_result = _create_one(lab, 'parto_crias', uuid.uuid4(), parto_cria_data(parto, cria))
    assert cria_result['record']['data']['rol'] == 'CRIA'

    pesaje = uuid.uuid4()
    pesaje_result = _create_one(lab, 'pesajes', pesaje, pesaje_data(madre, parto))
    assert pesaje_result['record']['data']['peso_gramos'] == '995.00'

    evento = uuid.uuid4()
    evento_result = _create_one(lab, 'eventos', evento, evento_data(madre))
    assert evento_result['record']['data']['tipo'] == 'DESTETE'

    updates = [
        ('cuyes', madre, {**cuy_data(lab, 'MADRE-1'), 'estado': 'VENDIDO'}),
        ('partos', parto, {**parto_data(madre), 'nacidos_vivos': 1}),
        ('pesajes', pesaje, pesaje_data(madre, parto, peso='1000.50')),
        ('eventos', evento, evento_data(madre, detalle='Actualizado')),
    ]
    for entity, record_id, data in updates:
        result = _one(lab, _op(entity, record_id, data, 'update', '1'))
        assert result['status'] == 'accepted' and result['changed'] is True, result
        assert result['record']['version'] == '2'

    # parto_crias no tiene updated_at ni deleted_at propios.
    cria_update = _one(
        lab,
        _op('parto_crias', cria_result['record']['id'], parto_cria_data(parto, cria, 'LECHON'), 'update', '1'),
    )
    assert cria_update['status'] == 'accepted' and cria_update['record']['version'] == '2'

    # Un reintento con otra operación y los mismos datos no genera versión nueva.
    noop = _one(lab, _op('cuyes', madre, {**cuy_data(lab, 'MADRE-1'), 'estado': 'VENDIDO'}, 'update', '2'))
    assert noop['status'] == 'accepted' and noop['changed'] is False
    assert noop['record']['version'] == '2'

    with psycopg.connect(lab['url']) as conn:
        row = conn.execute(
            'SELECT estado, categoria_ml, ultimo_peso_g, server_version FROM cuyes WHERE id = %s', (madre,)
        ).fetchone()
        assert row == ('VENDIDO', None, None, 2)
        peso = conn.execute('SELECT peso_gramos FROM pesajes WHERE id = %s', (pesaje,)).fetchone()[0]
        assert str(peso) == '1000.50'
        rol = conn.execute('SELECT rol FROM parto_crias WHERE id = %s', (cria_result['record']['id'],)).fetchone()[0]
        assert rol == 'LECHON'

    assert client.get('/sync/v2/context').json()['device_id'] == str(lab['device'])


def test_allowlist_campos_servidor_y_null(lab):
    extra = cuy_data(lab, 'EXTRA')
    extra['categoria_ml'] = None
    result = _one(lab, _op('cuyes', uuid.uuid4(), extra))
    assert result['status'] == 'rejected' and result['code'] == 'CAMPOS_INVALIDOS'

    extra = cuy_data(lab, 'EXTRA-2')
    extra['ultimo_peso_g'] = '900.00'
    assert _one(lab, _op('cuyes', uuid.uuid4(), extra))['code'] == 'CAMPOS_INVALIDOS'

    extra = cuy_data(lab, 'EXTRA-3')
    extra['server_version'] = '1'
    assert _one(lab, _op('cuyes', uuid.uuid4(), extra))['code'] == 'CAMPOS_INVALIDOS'

    missing = cuy_data(lab, 'MISSING')
    missing.pop('estado')
    assert _one(lab, _op('cuyes', uuid.uuid4(), missing))['code'] == 'CAMPOS_INVALIDOS'

    madre = uuid.uuid4()
    _create_one(lab, 'cuyes', madre, cuy_data(lab, 'NULL-MADRE'))
    parto = uuid.uuid4()
    data = parto_data(madre)
    data['nacidos_vivos'] = None
    accepted = _create_one(lab, 'partos', parto, data)
    assert accepted['record']['data']['nacidos_vivos'] is None
    with psycopg.connect(lab['url']) as conn:
        assert conn.execute('SELECT nacidos_vivos FROM partos WHERE id = %s', (parto,)).fetchone()[0] is None

    bad_decimal = _create_one(lab, 'cuyes', uuid.uuid4(), cuy_data(lab, 'BAD-PESO'))
    invalid = _one(lab, _op('pesajes', uuid.uuid4(), pesaje_data(bad_decimal['record']['id'], peso='no-numero')))
    assert invalid['status'] == 'rejected' and invalid['code'] == 'DATOS_INVALIDOS'


def test_referencias_y_dependencias_en_lote(lab):
    missing_poza = cuy_data(lab, 'SIN-POZA', poza=uuid.uuid4())
    parent = uuid.uuid4()
    child = uuid.uuid4()
    results = _push(
        lab,
        [
            _op('cuyes', parent, missing_poza),
            _op('eventos', child, evento_data(parent)),
        ],
    ).json()['results']
    assert [r['status'] for r in results] == ['rejected', 'rejected']
    assert results[0]['code'] == 'DEPENDENCY_PENDING'
    assert results[1]['code'] == 'DEPENDENCY_REJECTED'

    # El orden del lote importa: la hija antes del padre queda pendiente.
    child_first = uuid.uuid4()
    parent_ok = uuid.uuid4()
    results = _push(
        lab,
        [
            _op('eventos', child_first, evento_data(parent_ok)),
            _op('cuyes', parent_ok, cuy_data(lab, 'PADRE-OK')),
        ],
    ).json()['results']
    assert results[0]['status'] == 'rejected' and results[0]['code'] == 'DEPENDENCY_PENDING'
    assert results[1]['status'] == 'accepted'

    # Con el padre aceptado antes, la hija se escribe en el mismo lote.
    parent_batch = uuid.uuid4()
    child_batch = uuid.uuid4()
    results = _push(
        lab,
        [
            _op('cuyes', parent_batch, cuy_data(lab, 'PADRE-BATCH')),
            _op('eventos', child_batch, evento_data(parent_batch)),
        ],
    ).json()['results']
    assert [r['status'] for r in results] == ['accepted', 'accepted']

    with psycopg.connect(lab['url']) as conn:
        assert conn.execute('SELECT count(*) FROM eventos WHERE id = %s', (child,)).fetchone()[0] == 0
        assert conn.execute('SELECT count(*) FROM eventos WHERE id = %s', (child_batch,)).fetchone()[0] == 1


def test_versiones_recibos_replay_y_reuso(lab):
    record = uuid.uuid4()
    create = _op('cuyes', record, cuy_data(lab, 'RECIBO'))
    first = _one(lab, create)
    assert first['status'] == 'accepted' and first['record']['version'] == '1'

    replay = _one(lab, create)
    assert replay == first
    with psycopg.connect(lab['url']) as conn:
        count = conn.execute(
            'SELECT count(*) FROM sync_receipts WHERE scope_id = %s AND operation_id = %s',
            (lab['scope'], create['operation_id']),
        ).fetchone()[0]
        assert count == 1

    reused = {**create, 'data': {**cuy_data(lab, 'RECIBO-2')}}
    assert _one(lab, reused)['code'] == 'OPERATION_ID_REUSED'

    stale = _op('cuyes', record, {**cuy_data(lab, 'RECIBO'), 'estado': 'VENDIDO'}, 'update', '9')
    conflict = _one(lab, stale)
    assert conflict['status'] == 'conflict' and conflict['code'] == 'VERSION_CONFLICT'
    assert conflict['record']['version'] == '1'

    update = _op('cuyes', record, {**cuy_data(lab, 'RECIBO'), 'estado': 'VENDIDO'}, 'update', '1')
    accepted = _one(lab, update)
    assert accepted['status'] == 'accepted' and accepted['record']['version'] == '2'

    # Operación distinta con base_version ya superada: conflicto, no replay.
    old = _op('cuyes', record, {**cuy_data(lab, 'RECIBO'), 'estado': 'ACTIVO'}, 'update', '1')
    assert _one(lab, old)['code'] == 'VERSION_CONFLICT'


def test_rollback_de_publicacion_no_avanza_nada(lab):
    madre = uuid.uuid4()
    _create_one(lab, 'cuyes', madre, cuy_data(lab, 'ROLLBACK-MADRE'))
    parto = uuid.uuid4()
    _create_one(lab, 'partos', parto, parto_data(madre))
    evento = uuid.uuid4()
    _create_one(lab, 'eventos', evento, evento_data(madre))

    with psycopg.connect(lab['url']) as conn:
        before_sequence = conn.execute('SELECT last_sequence FROM sync_scopes WHERE id = %s', (lab['scope'],)).fetchone()[0]
        before_changes = conn.execute('SELECT count(*) FROM sync_changes WHERE scope_id = %s', (lab['scope'],)).fetchone()[0]

    bad = uuid.uuid4()
    operation = _op('pesajes', bad, pesaje_data(madre, parto_id=parto, evento_id=evento))
    result = _one(lab, operation)
    assert result['status'] == 'rejected' and result['code'] == 'VINCULO_INVALIDO'

    with psycopg.connect(lab['url']) as conn:
        assert conn.execute('SELECT count(*) FROM pesajes WHERE id = %s', (bad,)).fetchone()[0] == 0
        assert conn.execute('SELECT last_sequence FROM sync_scopes WHERE id = %s', (lab['scope'],)).fetchone()[0] == before_sequence
        assert conn.execute('SELECT count(*) FROM sync_changes WHERE scope_id = %s', (lab['scope'],)).fetchone()[0] == before_changes
        assert conn.execute(
            'SELECT count(*) FROM sync_receipts WHERE scope_id = %s AND operation_id = %s',
            (lab['scope'], operation['operation_id']),
        ).fetchone()[0] == 1
    assert _one(lab, operation) == result


def test_cursor_v2_independiente_paginacion_y_replay(lab):
    client = lab['client']
    # Un cambio v1 en el mismo ámbito no debe aparecer en la página v2.
    v1 = client.post(
        '/sync/push',
        json={
            'protocol_version': 1,
            'device_id': str(lab['device']),
            'operations': [
                {
                    'operation_id': str(uuid.uuid4()),
                    'entity': 'galpon',
                    'record_id': str(uuid.uuid4()),
                    'action': 'create',
                    'base_version': None,
                    'client_created_at': '2026-11-12T10:00:00Z',
                    'data': {'nombre': 'Solo v1', 'ubicacion': None},
                }
            ],
        },
    )
    assert v1.status_code == 200

    madre = uuid.uuid4()
    _create_one(lab, 'cuyes', madre, cuy_data(lab, 'CURSOR-MADRE'))
    parto = uuid.uuid4()
    _create_one(lab, 'partos', parto, parto_data(madre))
    cria = uuid.uuid4()
    _create_one(lab, 'cuyes', cria, cuy_data(lab, 'CURSOR-CRIA'))
    _create_one(lab, 'parto_crias', uuid.uuid4(), parto_cria_data(parto, cria))
    _create_one(lab, 'pesajes', uuid.uuid4(), pesaje_data(madre, parto))
    _create_one(lab, 'eventos', uuid.uuid4(), evento_data(madre))

    first = client.get('/sync/v2/pull', params={'limit': 2})
    assert first.status_code == 200, first.text
    body = first.json()
    assert body['protocol_version'] == 2
    assert all(item['entity'] != 'galpon' for item in body['items'])
    assert body['has_more'] is True
    assert client.get('/sync/v2/pull', params={'limit': 2}).json() == body

    def walk():
        cursor = None
        seen = []
        pages = 0
        while True:
            params = {'limit': 2}
            if cursor is not None:
                params['cursor'] = cursor
            page = client.get('/sync/v2/pull', params=params).json()
            seen.extend(page['items'])
            pages += 1
            if not page['has_more']:
                return seen, page['next_cursor'], pages
            cursor = page['next_cursor']

    items, last_cursor, pages = walk()
    entities = {item['entity'] for item in items}
    assert entities == {'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias'}
    assert all(item['entity'] not in {'galpon', 'poza'} for item in items)
    assert pages >= 3
    assert client.get('/sync/v2/pull', params={'cursor': last_cursor}).json()['items'] == []

    v1_cursor = client.get('/sync/pull').json()['next_cursor']
    assert client.get('/sync/v2/pull', params={'cursor': v1_cursor}).status_code == 400
    v2_cursor = body['next_cursor']
    assert client.get('/sync/pull', params={'cursor': v2_cursor}).status_code == 400

    # v1 conserva su comportamiento: sigue entregando galpon y dominio.
    v1_page = client.get('/sync/pull').json()
    assert v1_page['protocol_version'] == 1
    assert {item['entity'] for item in v1_page['items']} & {'galpon', 'cuyes'}
