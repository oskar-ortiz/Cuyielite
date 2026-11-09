import { Capacitor } from '@capacitor/core';

import type { WorkSyncStatus } from './work.sync.status.js';
import { SyncLab, synchronizeWorkDatabase } from './work.sync.transport.js';

export interface SyncRunSummary {
  appliedRemoteRecords: number;
  pushedResults: number;
}

export interface WorkSyncRepository {
  status(): Promise<WorkSyncStatus>;
  run(token: string): Promise<SyncRunSummary>;
}

let running = false;

function summary(value: unknown): SyncRunSummary {
  const data = (value ?? {}) as Record<string, unknown>;
  const count = (key: string) => (Number.isFinite(Number(data[key])) ? Number(data[key]) : 0);
  return {
    appliedRemoteRecords: count('appliedRemoteRecords'),
    pushedResults: count('pushedResults'),
  };
}

async function run(token: string): Promise<SyncRunSummary> {
  if (running) throw new Error('Ya hay una sincronización en curso');
  if (token.trim().length < 32) {
    throw new Error('El token de laboratorio debe tener al menos 32 caracteres');
  }
  running = true;
  try {
    return summary(await synchronizeWorkDatabase(token.trim()));
  } finally {
    running = false;
  }
}

const androidRepository: WorkSyncRepository = {
  async status() {
    const [{ adaptWorkConnection, getWorkConnection }, { readWorkSyncStatus }] = await Promise.all([
      import('./work.database.android.js'),
      import('./work.sync.status.js'),
    ]);
    return readWorkSyncStatus(adaptWorkConnection(await getWorkConnection()));
  },
  run,
};

const electronRepository: WorkSyncRepository = {
  async status() {
    return SyncLab.status();
  },
  run,
};

export function getWorkSyncRepository(): WorkSyncRepository {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return androidRepository;
  if (platform === 'electron') return electronRepository;
  throw new Error('La sincronización requiere Android o Windows instalado');
}
