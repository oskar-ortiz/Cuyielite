import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

import type { MigrationDb } from './work.migration';
import { createWorkGalpon } from './work.outbox';
import { runSyncCycle } from './work.sync.coordinator';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import type { SyncPullPage } from './work.sync.pull';
import type { SyncTransport } from './work.sync.transport';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CREATED = '2026-11-06T10:00:00.000Z';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

function emptyPage(cursor: string): SyncPullPage {
  return { protocol_version: 1, scope_id: SCOPE, items: [], next_cursor: cursor, has_more: false };
}

function accepted(request: any) {
  const operation = request.operations[0];
  return {
    protocol_version: 1,
    results: [
      {
        operation_id: operation.operation_id,
        entity: operation.entity,
        record_id: operation.record_id,
        status: 'accepted' as const,
        changed: true,
        code: null,
        record: {
          id: operation.record_id,
          version: '1',
          created_at: CREATED,
          updated_at: CREATED,
          deleted_at: null,
          last_client_edited_at: CREATED,
          data: operation.data,
        },
      },
    ],
  };
}

describe('coordinador sync-v1', () => {
  it('captura local_seq, hace pull antes/después y no envía ediciones posteriores al corte', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    const first = await createWorkGalpon(adapter, { nombre: 'Antes del ciclo', ubicacion: null });
    let pullCalls = 0;
    const pushed: any[] = [];
    const order: string[] = [];
    const transport: SyncTransport = {
      context: async () => {
        order.push('context');
        return {
          protocol_version: 1,
          scope_id: SCOPE,
          device_id: identity.deviceId,
          limits: { push_operations: 100, push_bytes: 1_048_576, pull_default: 50, pull_max: 100 },
        };
      },
      pull: async () => {
        order.push('pull');
        pullCalls++;
        if (pullCalls === 1) await createWorkGalpon(adapter, { nombre: 'Durante el ciclo', ubicacion: null });
        return emptyPage(`checkpoint-${pullCalls}`);
      },
      push: async (_token, body) => {
        order.push('push');
        pushed.push(body);
        return accepted(body);
      },
    };
    const result = await runSyncCycle(adapter, transport, 'synthetic-token-abcdefghijklmnopqrstuvwxyz', {
      sleep: async () => {},
      random: () => 0.5,
    });
    expect(result).toMatchObject({ capturedThroughLocalSeq: 1, pagesBeforePush: 1, pagesAfterPush: 1, pending: 1 });
    expect(pushed).toHaveLength(1);
    expect(pushed[0].operations[0].record_id).toBe(first.id);
    expect(order).toEqual(['context', 'pull', 'push', 'pull']);
    expect(db.prepare("SELECT state FROM sync_outbox WHERE state='queued'").all()).toHaveLength(1);
    db.close();
  });

  it('reintenta solo errores transitorios hasta tres intentos', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    await createWorkGalpon(adapter, { nombre: 'Reintento', ubicacion: null });
    let attempts = 0;
    const sleeps: number[] = [];
    const transport: SyncTransport = {
      context: async () => ({
        protocol_version: 1,
        scope_id: SCOPE,
        device_id: identity.deviceId,
        limits: { push_operations: 100, push_bytes: 1_048_576, pull_default: 50, pull_max: 100 },
      }),
      pull: async (_token, _cursor, _limit) => emptyPage('checkpoint'),
      push: async (_token, body) => {
        attempts++;
        if (attempts < 3) throw new Error('HTTP 503');
        return accepted(body);
      },
    };
    const result = await runSyncCycle(adapter, transport, 'synthetic-token-abcdefghijklmnopqrstuvwxyz', {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
    });
    expect(attempts).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
    expect(result.pending).toBe(0);
    db.close();
  });

  it('impide dos ciclos concurrentes sobre el mismo dataset', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    let release!: () => void;
    let markStarted!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const contextStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const transport: SyncTransport = {
      context: async () => {
        markStarted();
        await wait;
        return {
          protocol_version: 1,
          scope_id: SCOPE,
          device_id: identity.deviceId,
          limits: { push_operations: 100, push_bytes: 1_048_576, pull_default: 50, pull_max: 100 },
        };
      },
      pull: async (_token, _cursor, _limit) => emptyPage('checkpoint'),
      push: vi.fn(),
    };
    const first = runSyncCycle(adapter, transport, 'synthetic-token-abcdefghijklmnopqrstuvwxyz');
    await contextStarted;
    await expect(runSyncCycle(adapter, transport, 'synthetic-token-abcdefghijklmnopqrstuvwxyz')).rejects.toThrow(
      /activo/,
    );
    release();
    await first;
    db.close();
  });
});
