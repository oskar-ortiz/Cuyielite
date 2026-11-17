import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { apiUrl } from './api.config';
import type { SessionResponse } from './auth.types';
import { SyncLab } from './work.sync.transport';

export class AuthHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'AuthHttpError';
  }
}

function errorFrom(data: unknown, status: number, fallback: string): AuthHttpError {
  const detail =
    data && typeof data === 'object' && 'detail' in data ? String((data as { detail: unknown }).detail) : fallback;
  return new AuthHttpError(status, detail);
}

async function androidRequest(path: string, body?: unknown, token?: string): Promise<unknown> {
  const response = await CapacitorHttp.request({
    url: apiUrl(path),
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { data: body } : {}),
    disableRedirects: true,
    connectTimeout: 10_000,
    readTimeout: 15_000,
  });
  if (response.status < 200 || response.status >= 300) {
    throw errorFrom(response.data, response.status, `AUTH_HTTP_${response.status}`);
  }
  return response.data;
}

async function electronRequest(call: (body: unknown) => Promise<unknown>, body: unknown): Promise<unknown> {
  try {
    return await call(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = Number(/HTTP (\d{3})/.exec(message)?.[1] ?? 0);
    const code =
      /AUTH_[A-Z_]+|CREDENCIALES_INVALIDAS|REFRESH_[A-Z]+|LOGIN_BLOQUEADO|DEVICE_[A-Z]+|ROL_SIN_ESCRITURA/.exec(
        message,
      )?.[0];
    throw new AuthHttpError(status, code ?? message);
  }
}

export interface AuthTransport {
  login(body: Record<string, unknown>): Promise<SessionResponse>;
  refresh(body: Record<string, unknown>): Promise<SessionResponse>;
  logout(body: Record<string, unknown>): Promise<void>;
  changePassword(token: string, body: Record<string, unknown>): Promise<void>;
  me(token: string): Promise<{ user: SessionResponse['user']; scope_id: string; device_id: string }>;
}

const androidTransport: AuthTransport = {
  async login(body) {
    return (await androidRequest('/auth/login', body)) as SessionResponse;
  },
  async refresh(body) {
    return (await androidRequest('/auth/refresh', body)) as SessionResponse;
  },
  async logout(body) {
    await androidRequest('/auth/logout', body);
  },
  async changePassword(token, body) {
    await androidRequest('/auth/change-password', body, token);
  },
  async me(token) {
    return (await androidRequest('/auth/me', undefined, token)) as {
      user: SessionResponse['user'];
      scope_id: string;
      device_id: string;
    };
  },
};

const electronTransport: AuthTransport = {
  async login(body) {
    return (await electronRequest((value) => SyncLab.authLogin({ body: value }), body)) as SessionResponse;
  },
  async refresh(body) {
    return (await electronRequest((value) => SyncLab.authRefresh({ body: value }), body)) as SessionResponse;
  },
  async logout(body) {
    await electronRequest((value) => SyncLab.authLogout({ body: value }), body);
  },
  async changePassword(token, body) {
    await SyncLab.authChangePassword({ token, body });
  },
  async me(token) {
    return (await SyncLab.authMe({ token })) as {
      user: SessionResponse['user'];
      scope_id: string;
      device_id: string;
    };
  },
};

export function getAuthTransport(): AuthTransport {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return androidTransport;
  if (platform === 'electron') return electronTransport;
  throw new Error('El acceso de piloto requiere Android o Windows instalado');
}
