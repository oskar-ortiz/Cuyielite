// Plugin Electron del transporte S3. El renderer no elige URL, ruta, metodo ni
// SQL: aporta el token en memoria y, en el caso de push, el cuerpo congelado.
// La peticion HTTP y las operaciones de sincronizacion sobre SQLite ocurren
// siempre en el proceso principal, contra el loopback fijo del laboratorio.
import { app, safeStorage } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

import { bindContext } from './work.sync.scope.js';
import { prepareEligible, sendPrepared } from './work.sync.client.js';
import { runSyncCycle } from './work.sync.coordinator.js';
import { listConflictCases, resolveConflictKeepCentral, resolveConflictRetry } from './work.sync.conflicts.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { readWorkSyncStatus } from './work.sync.status.js';

const LAB_BASE_URL = 'http://127.0.0.1:8000';
const AUTH_BASE_URL = (process.env.CUYIELITE_API_URL || LAB_BASE_URL).replace(/\/+$/, '');
const SESSION_PATH = path.join(app.getPath('userData'), 'auth-session.bin');

const ROUTES = Object.freeze({
  context: '/sync/context',
  push: '/sync/push',
  pull: '/sync/pull',
  contextV2: '/sync/v2/context',
  pushV2: '/sync/v2/push',
  pullV2: '/sync/v2/pull',
  hembra: '/ml/predict/hembra',
  candidata: '/ml/predict/candidata',
  assistant: '/assistant/query',
});

const WORK_DB_DIR = path.join(app.getPath('userData'), 'cuyielite-work');
const WORK_DB_PATH = path.join(WORK_DB_DIR, 'trabajo.db');

function openWorkDb() {
  fs.mkdirSync(WORK_DB_DIR, { recursive: true });
  const db = new DatabaseSync(WORK_DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function makeAdapter(db) {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...(params ?? []));
    },
    query: (sql, params) => {
      const stmt = db.prepare(sql);
      const rows = params ? stmt.all(...params) : stmt.all();
      return { values: rows };
    },
  };
}

function assertLoopback(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Destino de sincronizacion invalido');
  }
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') {
    throw new Error('Destino de sincronizacion fuera de loopback');
  }
}

function assertToken(token) {
  if (typeof token !== 'string' || token.length < 32) {
    throw new Error('Token de sincronizacion invalido');
  }
}

function assertAllowedApi(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Destino de API invalido');
  }
  if (parsed.protocol === 'https:') return;
  if (parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')) return;
  throw new Error('Destino de API no autorizado');
}

async function authRequest(route, body, token) {
  const url = AUTH_BASE_URL + route;
  assertAllowedApi(url);
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  assertAllowedApi(res.url);
  if (!res.ok) {
    let detail = `AUTH_HTTP_${res.status}`;
    try {
      const payload = await res.json();
      if (payload && typeof payload.detail === 'string') detail = payload.detail;
    } catch {
      // mantener código HTTP
    }
    throw new Error(`HTTP ${res.status} ${detail}`);
  }
  return res.json();
}

async function request(route, token, init) {
  assertToken(token);
  const url = LAB_BASE_URL + route;
  assertLoopback(url);
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  assertLoopback(res.url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

class SyncLab {
  static __capacitorElectronPlugin = {
    name: 'SyncLab',
    methods: ['context', 'push', 'pull', 'contextV2', 'pushV2', 'pullV2', 'bind', 'prepare', 'send', 'sync', 'status', 'listConflicts', 'keepCentral', 'retryConflict', 'authLogin', 'authRefresh', 'authLogout', 'authChangePassword', 'authMe', 'authSessionSave', 'authSessionRead', 'authSessionClear', 'predictHembra', 'predictCandidata', 'assistantQuery'],
  };

  async load() {}

  async context({ token }) {
    return request(ROUTES.context, token, { method: 'GET' });
  }

  async push({ token, body }) {
    if (body === null || typeof body !== 'object') {
      throw new Error('Solicitud de sincronizacion invalida');
    }
    return request(ROUTES.push, token, { method: 'POST', body: JSON.stringify(body) });
  }

  async pull({ token, cursor, limit }) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Limite pull invalido');
    }
    if (cursor !== null && (typeof cursor !== 'string' || cursor.length > 4096)) {
      throw new Error('Cursor pull invalido');
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor !== null) params.set('cursor', cursor);
    return request(`${ROUTES.pull}?${params.toString()}`, token, { method: 'GET' });
  }

  async contextV2({ token }) {
    return request(ROUTES.contextV2, token, { method: 'GET' });
  }

  async pushV2({ token, body }) {
    if (body === null || typeof body !== 'object') {
      throw new Error('Solicitud de sincronizacion v2 invalida');
    }
    return request(ROUTES.pushV2, token, { method: 'POST', body: JSON.stringify(body) });
  }

  async pullV2({ token, cursor, limit }) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Limite pull v2 invalido');
    }
    if (cursor !== null && (typeof cursor !== 'string' || cursor.length > 4096)) {
      throw new Error('Cursor pull v2 invalido');
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor !== null) params.set('cursor', cursor);
    return request(`${ROUTES.pullV2}?${params.toString()}`, token, { method: 'GET' });
  }

  async bind({ token }) {
    const ctx = await this.context({ token });
    const db = openWorkDb();
    try {
      await bindContext(makeAdapter(db), ctx, ctx.device_id);
      return {
        scope_id: ctx.scope_id,
        device_id: ctx.device_id,
        protocol_version: ctx.protocol_version,
      };
    } finally {
      db.close();
    }
  }

  async prepare() {
    const db = openWorkDb();
    try {
      const adapter = makeAdapter(db);
      const identity = await initializeWorkSyncDatabase(adapter);
      const prepared = await prepareEligible(adapter, identity.deviceId);
      return { prepared };
    } finally {
      db.close();
    }
  }

  async send({ token }) {
    const db = openWorkDb();
    try {
      const adapter = makeAdapter(db);
      await initializeWorkSyncDatabase(adapter);
      return await sendPrepared(adapter, (frozen) =>
        frozen.protocol_version === 2 ? this.pushV2({ token, body: frozen }) : this.push({ token, body: frozen }),
      );
    } finally {
      db.close();
    }
  }

  async sync({ token, allowPush = true }) {
    const db = openWorkDb();
    try {
      const adapter = makeAdapter(db);
      return await runSyncCycle(adapter, {
        context: (value) => this.context({ token: value }),
        push: (value, body) => this.push({ token: value, body }),
        pull: (value, cursor, limit) => this.pull({ token: value, cursor, limit }),
        contextV2: (value) => this.contextV2({ token: value }),
        pushV2: (value, body) => this.pushV2({ token: value, body }),
        pullV2: (value, cursor, limit) => this.pullV2({ token: value, cursor, limit }),
      }, token, { allowPush });
    } finally {
      db.close();
    }
  }

  async listConflicts() {
    const db = openWorkDb();
    try {
      return { cases: await listConflictCases(makeAdapter(db)) };
    } finally {
      db.close();
    }
  }

  async status() {
    const db = openWorkDb();
    try {
      return await readWorkSyncStatus(makeAdapter(db));
    } finally {
      db.close();
    }
  }

  async keepCentral({ review }) {
    const db = openWorkDb();
    try {
      return await resolveConflictKeepCentral(makeAdapter(db), review);
    } finally {
      db.close();
    }
  }

  async retryConflict({ review, input }) {
    const db = openWorkDb();
    try {
      return await resolveConflictRetry(makeAdapter(db), review, input);
    } finally {
      db.close();
    }
  }

  async authLogin({ body }) {
    return authRequest('/auth/login', body);
  }

  async authRefresh({ body }) {
    return authRequest('/auth/refresh', body);
  }

  async authLogout({ body }) {
    return authRequest('/auth/logout', body);
  }

  async authChangePassword({ token, body }) {
    return authRequest('/auth/change-password', body, token);
  }

  async authMe({ token }) {
    return authRequest('/auth/me', undefined, token);
  }

  async authSessionSave({ value }) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Almacenamiento seguro no disponible');
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
    fs.writeFileSync(SESSION_PATH, safeStorage.encryptString(String(value)), { mode: 0o600 });
    return { ok: true };
  }

  async authSessionRead() {
    if (!fs.existsSync(SESSION_PATH)) return { value: null };
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Almacenamiento seguro no disponible');
    return { value: safeStorage.decryptString(fs.readFileSync(SESSION_PATH)) };
  }

  async authSessionClear() {
    if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);
    return { ok: true };
  }

  async predictHembra({ token, body }) {
    return request(ROUTES.hembra, token, { method: 'POST', body: JSON.stringify(body) });
  }

  async predictCandidata({ token, body }) {
    return request(ROUTES.candidata, token, { method: 'POST', body: JSON.stringify(body) });
  }

  async assistantQuery({ token, body }) {
    return request(ROUTES.assistant, token, { method: 'POST', body: JSON.stringify(body) });
  }
}

export { SyncLab };
