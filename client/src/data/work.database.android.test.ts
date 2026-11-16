import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeWorkConnection, getWorkConnection } from './work.database.android';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  isConnection: vi.fn(),
  consistency: vi.fn(),
  closeAll: vi.fn(),
  closeWrapper: vi.fn(),
  migrate: vi.fn(),
}));

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: { closeConnection: vi.fn() },
  SQLiteConnection: class {
    createConnection = mocks.create;
    retrieveConnection = mocks.retrieve;
    isConnection = mocks.isConnection;
    checkConnectionsConsistency = mocks.consistency;
    closeAllConnections = mocks.closeAll;
    closeConnection = mocks.closeWrapper;
  },
}));

vi.mock('./work.sync.migration', () => ({ initializeWorkSyncDatabase: mocks.migrate }));

const connection = { open: vi.fn(), close: vi.fn() };

describe('Android work connection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockResolvedValue(connection);
    mocks.retrieve.mockResolvedValue(connection);
    mocks.consistency.mockResolvedValue({ result: true });
    mocks.isConnection.mockResolvedValue({ result: false });
    mocks.migrate.mockResolvedValue({ deviceId: 'device-test' });
  });

  afterEach(async () => {
    await closeWorkConnection();
  });

  it('libera las conexiones nativas huérfanas tras recargar el WebView', async () => {
    mocks.consistency.mockResolvedValue({ result: false });

    await expect(getWorkConnection()).resolves.toBe(connection);
    expect(mocks.closeAll).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(connection.open).toHaveBeenCalledTimes(1);
  });

  it('reutiliza la conexión registrada sin volver a crearla', async () => {
    mocks.isConnection.mockResolvedValue({ result: true });

    await expect(getWorkConnection()).resolves.toBe(connection);
    expect(mocks.retrieve).toHaveBeenCalledWith('trabajo', false);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.closeAll).not.toHaveBeenCalled();
  });

  it('tolera que la conexión reutilizada ya esté abierta', async () => {
    mocks.isConnection.mockResolvedValue({ result: true });
    connection.open.mockRejectedValueOnce(new Error('Open: database trabajo already opened'));

    await expect(getWorkConnection()).resolves.toBe(connection);
  });

  it('reintenta cuando la apertura queda bloqueada por un handle previo', async () => {
    mocks.create
      .mockRejectedValueOnce(new Error('Open: database is locked (code 5) while compiling: PRAGMA journal_mode'))
      .mockResolvedValueOnce(connection);

    await expect(getWorkConnection()).resolves.toBe(connection);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.closeAll).toHaveBeenCalled();
  });

  it('propaga errores no recuperables sin reintentar', async () => {
    mocks.create.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(getWorkConnection()).rejects.toThrow('storage unavailable');
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('cierra el adaptador y la conexión nativa al liberar', async () => {
    await getWorkConnection();
    await closeWorkConnection();
    expect(connection.close).toHaveBeenCalled();
    expect(mocks.closeAll).toHaveBeenCalled();
  });
});
