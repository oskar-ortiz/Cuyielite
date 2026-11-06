// Plugin Electron del transporte S3. El renderer no elige URL, ruta, metodo ni
// SQL: aporta el token en memoria y, en el caso de push, el cuerpo congelado.
// La peticion HTTP y las operaciones de sincronizacion sobre SQLite ocurren
// siempre en el proceso principal, contra el loopback fijo del laboratorio.
import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

import { bindContext } from './work.sync.scope.js';
import { prepareEligible, sendPrepared } from './work.sync.client.js';
import { runSyncCycle } from './work.sync.coordinator.js';
import { listConflictCases, resolveConflictKeepCentral, resolveConflictRetry } from './work.sync.conflicts.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

const LAB_BASE_URL = 'http://127.0.0.1:8000';

const ROUTES = Object.freeze({
  context: '/sync/context',
  push: '/sync/push',
  pull: '/sync/pull',
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
    methods: ['context', 'push', 'pull', 'bind', 'prepare', 'send', 'sync', 'listConflicts', 'keepCentral', 'retryConflict'],
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
      return await sendPrepared(adapter, (frozen) => this.push({ token, body: frozen }));
    } finally {
      db.close();
    }
  }

  async sync({ token }) {
    const db = openWorkDb();
    try {
      const adapter = makeAdapter(db);
      return await runSyncCycle(adapter, {
        context: (value) => this.context({ token: value }),
        push: (value, body) => this.push({ token: value, body }),
        pull: (value, cursor, limit) => this.pull({ token: value, cursor, limit }),
      }, token);
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
}

export { SyncLab };
