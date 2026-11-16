import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

import type { MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';

const sqlite = new SQLiteConnection(CapacitorSQLite);

let connectionPromise: Promise<SQLiteDBConnection> | null = null;

const REOPEN_ATTEMPTS = 4;

// Un reload del WebView (o la recreación de la vista tras recuperar memoria)
// destruye el wrapper JS pero deja la conexión nativa registrada. `createConnection`
// la encuentra y `open()` falla con "database is locked" al compilar el PRAGMA
// inicial. Reabrir desde cero es recuperable: no se pierde ninguna fila.
function recoverableOpenError(error: unknown): boolean {
  return /Connection trabajo already exists|already opened|database is locked|code 5/i.test(String(error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function releaseNativeConnection(): Promise<void> {
  try {
    // Cierra las conexiones nativas que quedaron abiertas por un contexto JS
    // anterior; sin esto el plugin conserva el lock del archivo.
    await sqlite.closeAllConnections();
  } catch {
    // Sin conexiones registradas no hay nada que liberar.
  }
}

async function openWorkConnection(): Promise<SQLiteDBConnection> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < REOPEN_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await releaseNativeConnection();
      await delay(200 * attempt);
    }
    try {
      // Tras un reload del WebView la conexión nativa sigue abierta: reutilizarla
      // evita un segundo handle sobre el mismo archivo (que falla con
      // "database is locked" al compilar el PRAGMA de journal).
      const consistent = (await sqlite.checkConnectionsConsistency().catch(() => ({ result: false }))).result;
      const exists = (await sqlite.isConnection('trabajo', false).catch(() => ({ result: false }))).result;
      if (!consistent) {
        // El wrapper JS se recreó y ya no conoce las conexiones nativas: liberarlas.
        await releaseNativeConnection();
      }
      const connection =
        consistent && exists
          ? await sqlite.retrieveConnection('trabajo', false)
          : await sqlite.createConnection('trabajo', false, 'no-encryption', 3, false);
      try {
        await connection.open();
      } catch (error) {
        if (!/already open/i.test(String(error))) throw error;
      }
      return connection;
    } catch (error) {
      lastError = error;
      if (!recoverableOpenError(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No se pudo abrir la base de trabajo');
}

const adapters = new WeakMap<SQLiteDBConnection, MigrationDb>();

export function adaptWorkConnection(c: SQLiteDBConnection): MigrationDb {
  // Un adaptador estable por conexión permite reutilizar la validación del
  // esquema en vez de repetirla en cada operación.
  const existing = adapters.get(c);
  if (existing) return existing;
  const adapter: MigrationDb = {
    exec: async (sql: string) => {
      await c.execute(sql, false);
    },
    run: async (sql: string, params?: unknown[]) => {
      await c.run(sql, params ?? [], false);
    },
    query: async (sql: string, params?: unknown[]) => {
      const res = await c.query(sql, params ?? []);
      return { values: res.values ?? [] };
    },
  };
  adapters.set(c, adapter);
  return adapter;
}

export async function getWorkConnection(): Promise<SQLiteDBConnection> {
  if (!connectionPromise) {
    const promise = (async () => {
      let c: SQLiteDBConnection | null = null;
      try {
        c = await openWorkConnection();
        await initializeWorkSyncDatabase(adaptWorkConnection(c));
        return c;
      } catch (err) {
        // release connection and registration before allowing retry
        if (c) {
          try {
            await c.close();
          } catch {
            // ignore close errors
          }
        }
        await releaseNativeConnection();
        throw err; // keep original cause
      }
    })();
    connectionPromise = promise;
    promise.catch(() => {
      connectionPromise = null;
    });
  }
  return connectionPromise;
}

export async function closeWorkConnection(): Promise<void> {
  if (connectionPromise) {
    const c = await connectionPromise.catch(() => null);
    if (c) {
      try {
        await c.close();
      } catch {
        // ignore
      }
    }
    await releaseNativeConnection();
    connectionPromise = null;
  }
}
