import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getConflictRepository } from './work.sync.conflict.repository';

const mocks = vi.hoisted(() => ({
  platform: 'android',
  connection: { marker: 'connection' },
  adapted: { marker: 'adapted' },
  cases: [{ marker: 'case' }],
  androidList: vi.fn(),
  keep: vi.fn(),
  retry: vi.fn(),
  syncList: vi.fn(),
  syncKeep: vi.fn(),
  syncRetry: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mocks.platform } }));
vi.mock('./work.database.android', () => ({
  getWorkConnection: vi.fn(async () => mocks.connection),
  adaptWorkConnection: vi.fn(() => mocks.adapted),
}));
vi.mock('./work.sync.conflicts', () => ({
  listConflictCases: mocks.androidList,
  resolveConflictKeepCentral: mocks.keep,
  resolveConflictRetry: mocks.retry,
}));
vi.mock('./work.sync.transport', () => ({
  SyncLab: { listConflicts: mocks.syncList, keepCentral: mocks.syncKeep, retryConflict: mocks.syncRetry },
}));

describe('repositorio de conflictos por plataforma', () => {
  beforeEach(() => {
    mocks.platform = 'android';
    vi.clearAllMocks();
    mocks.androidList.mockResolvedValue(mocks.cases);
    mocks.syncList.mockResolvedValue({ cases: mocks.cases });
  });

  it('usa SQLite comunitario en Android', async () => {
    const cases = await getConflictRepository().list();
    expect(cases).toBe(mocks.cases);
    expect(mocks.androidList).toHaveBeenCalledWith(mocks.adapted);
  });

  it('usa el plugin nativo en Electron', async () => {
    mocks.platform = 'electron';
    const cases = await getConflictRepository().list();
    expect(cases).toBe(mocks.cases);
    expect(mocks.syncList).toHaveBeenCalledOnce();
  });

  it('rechaza plataformas sin repositorio nativo', () => {
    mocks.platform = 'web';
    expect(() => getConflictRepository()).toThrow(/Android o Windows/);
  });
});
