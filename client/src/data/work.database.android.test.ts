import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeWorkConnection, getWorkConnection } from './work.database.android';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  closeNative: vi.fn(),
  closeWrapper: vi.fn(),
  migrate: vi.fn(),
}));

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: { closeConnection: mocks.closeNative },
  SQLiteConnection: class {
    createConnection = mocks.create;
    closeConnection = mocks.closeWrapper;
  },
}));

vi.mock('./work.sync.migration', () => ({ initializeWorkSyncDatabase: mocks.migrate }));

const connection = { open: vi.fn(), close: vi.fn() };

describe('Android work connection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockResolvedValue(connection);
  });

  afterEach(async () => {
    await closeWorkConnection();
  });

  it('recupera una conexión nativa residual tras recargar el WebView', async () => {
    mocks.create.mockRejectedValueOnce(new Error('CreateConnection: Connection trabajo already exists'));

    await expect(getWorkConnection()).resolves.toBe(connection);
    expect(mocks.closeNative).toHaveBeenCalledExactlyOnceWith({ database: 'trabajo', readonly: false });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(connection.open).toHaveBeenCalledTimes(1);
  });

  it('no cierra la conexión nativa cuando la apertura funciona', async () => {
    await expect(getWorkConnection()).resolves.toBe(connection);
    expect(mocks.closeNative).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('propaga otros errores de apertura sin reintentar', async () => {
    mocks.create.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(getWorkConnection()).rejects.toThrow('storage unavailable');
    expect(mocks.closeNative).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
