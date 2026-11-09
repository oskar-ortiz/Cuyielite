import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  closeNative: vi.fn(),
  migrate: vi.fn(),
}));

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: { closeConnection: mocks.closeNative },
  SQLiteConnection: class {
    createConnection = mocks.create;
  },
}));

vi.mock('./galpones.migration', () => ({ migrateAndSeed: mocks.migrate }));

const connection = {
  open: vi.fn(),
  execute: vi.fn(),
  run: vi.fn(),
  query: vi.fn(),
};

describe('Android demo connection', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.create.mockReset().mockResolvedValue(connection);
    mocks.closeNative.mockReset();
    mocks.migrate.mockReset().mockResolvedValue(undefined);
    connection.open.mockReset().mockResolvedValue(undefined);
    connection.query.mockReset().mockResolvedValue({ values: [] });
  });

  it('recupera una conexión demo residual tras recargar el WebView', async () => {
    mocks.create.mockRejectedValueOnce(new Error('CreateConnection: Connection cuyielite already exists'));
    const { createAndroidRepository } = await import('./galpones.repository.android');

    await expect(createAndroidRepository().listGalpones()).resolves.toEqual([]);
    expect(mocks.closeNative).toHaveBeenCalledExactlyOnceWith({ database: 'cuyielite', readonly: false });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(connection.open).toHaveBeenCalledTimes(1);
  });

  it('no cierra la conexión demo cuando la apertura funciona', async () => {
    const { createAndroidRepository } = await import('./galpones.repository.android');

    await expect(createAndroidRepository().listGalpones()).resolves.toEqual([]);
    expect(mocks.closeNative).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('propaga otros errores de apertura sin reintentar', async () => {
    mocks.create.mockRejectedValueOnce(new Error('storage unavailable'));
    const { createAndroidRepository } = await import('./galpones.repository.android');

    await expect(createAndroidRepository().listGalpones()).rejects.toThrow('storage unavailable');
    expect(mocks.closeNative).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
