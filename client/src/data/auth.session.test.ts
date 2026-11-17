import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class TestAuthHttpError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
    ) {
      super(code);
    }
  }
  return {
    TestAuthHttpError,
    stored: null as string | null,
    status: vi.fn(),
    transport: {
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      me: vi.fn(),
    },
  };
});

vi.mock('./api.config', () => ({
  AUTH_MODE: 'pilot',
  API_BASE_URL: 'http://127.0.0.1:8000',
  apiUrl: (path: string) => `http://127.0.0.1:8000${path}`,
}));

vi.mock('./auth.storage', () => ({
  saveSecureSession: async (value: string) => {
    mocks.stored = value;
  },
  readSecureSession: async () => mocks.stored,
  clearSecureSession: async () => {
    mocks.stored = null;
  },
}));

vi.mock('./work.sync.repository', () => ({
  getWorkSyncRepository: () => ({ status: mocks.status }),
}));

vi.mock('./auth.transport', () => ({
  AuthHttpError: mocks.TestAuthHttpError,
  getAuthTransport: () => mocks.transport,
}));

const session = await import('./auth.session');

function response(role: 'admin' | 'viewer', refresh = 'refresh-token-abcdefghijklmnopqrstuvwxyz012345') {
  return {
    access_token: 'access-token-abcdefghijklmnopqrstuvwxyz012345',
    refresh_token: refresh,
    expires_in: 900,
    user: { id: 'user-1', username: role, role },
    scope_id: 'scope-1',
    device_id: 'device-1',
    must_change_password: false,
  };
}

describe('sesión de acceso de piloto', () => {
  beforeEach(async () => {
    mocks.stored = null;
    mocks.status.mockReset().mockResolvedValue({ deviceId: 'device-1' });
    mocks.transport.login.mockReset().mockResolvedValue(response('admin'));
    mocks.transport.refresh.mockReset().mockResolvedValue(response('admin', 'refresh-token-new'));
    mocks.transport.logout.mockReset().mockResolvedValue(undefined);
    mocks.transport.changePassword.mockReset().mockResolvedValue(undefined);
    session.resetAuthSessionForTests();
    await session.initializeAuthSession();
  });

  afterEach(() => {
    session.resetAuthSessionForTests();
  });

  it('inicia sesión conservando el device local y permite escribir al admin', async () => {
    const snapshot = await session.login('admin', 'secreto');
    expect(mocks.transport.login).toHaveBeenCalledWith({
      username: 'admin',
      password: 'secreto',
      device_id: 'device-1',
      platform: 'native',
    });
    expect(snapshot).toMatchObject({
      role: 'admin',
      deviceId: 'device-1',
      scopeId: 'scope-1',
      canWrite: true,
    });
    expect(mocks.stored).toContain('refresh-token');
    expect(mocks.stored).not.toContain('access-token');
  });

  it('deja al viewer en solo consulta sin borrar su sesión', async () => {
    mocks.transport.login.mockResolvedValue(response('viewer'));
    const snapshot = await session.login('viewer', 'secreto');
    expect(snapshot.role).toBe('viewer');
    expect(snapshot.canWrite).toBe(false);
    expect(() => session.requireCanWriteLocal()).toThrow(/solo permite consulta/);
    expect(mocks.stored).toContain('refresh-token');
  });

  it('renueva y rota el refresh sin cambiar dispositivo ni ámbito', async () => {
    await session.login('admin', 'secreto');
    const snapshot = await session.refreshSession();
    expect(mocks.transport.refresh).toHaveBeenCalledWith({ refresh_token: expect.stringContaining('refresh-token') });
    expect(snapshot).toMatchObject({ role: 'admin', deviceId: 'device-1', scopeId: 'scope-1' });
  });

  it('un refresh inválido cierra la sesión local', async () => {
    await session.login('admin', 'secreto');
    mocks.transport.refresh.mockRejectedValue(new mocks.TestAuthHttpError(401, 'REFRESH_REUTILIZADO'));
    await expect(session.refreshSession()).rejects.toThrow('REFRESH_REUTILIZADO');
    expect(session.snapshot().user).toBeNull();
    expect(mocks.stored).toBeNull();
  });

  it('cerrar sesión limpia credenciales pero no la identidad de instalación', async () => {
    await session.login('admin', 'secreto');
    await session.logout();
    expect(session.snapshot().user).toBeNull();
    expect(mocks.stored).toBeNull();
    expect(mocks.status).toHaveBeenCalled();
  });
});
