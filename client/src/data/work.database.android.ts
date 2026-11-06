import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

import type { MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';

const sqlite = new SQLiteConnection(CapacitorSQLite);

let connectionPromise: Promise<SQLiteDBConnection> | null = null;

export function adaptWorkConnection(c: SQLiteDBConnection): MigrationDb {
  return {
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
}

export async function getWorkConnection(): Promise<SQLiteDBConnection> {
  if (!connectionPromise) {
    const promise = (async () => {
      let c: SQLiteDBConnection | null = null;
      try {
        // disable auto transactions for controlled migration
        c = await sqlite.createConnection('trabajo', false, 'no-encryption', 3, false);
        await c.open();

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
        try {
          await sqlite.closeConnection('trabajo', false);
        } catch {
          // ignore
        }
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
    try {
      await sqlite.closeConnection('trabajo', false);
    } catch {
      // ignore
    }
    connectionPromise = null;
  }
}
