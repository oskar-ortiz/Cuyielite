import { AUTH_MODE } from './api.config';
import { clearSecureSession, readSecureSession, saveSecureSession } from './auth.storage';
import { getAuthTransport, AuthHttpError } from './auth.transport';
import { AuthError, type AuthRole, type AuthSnapshot, type SessionResponse, type StoredSession } from './auth.types';
import { getWorkSyncRepository } from './work.sync.repository';

const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_SKEW_MS = 30_000;

let stored: StoredSession | null = null;
let accessToken: string | null = null;
let accessExpiresAt = 0;
let initialized: Promise<void> | null = null;

function parseSession(value: string | null): StoredSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoredSession;
    if (
      typeof parsed.refreshToken !== 'string' ||
      !parsed.user ||
      (parsed.user.role !== 'admin' && parsed.user.role !== 'viewer') ||
      typeof parsed.scopeId !== 'string' ||
      typeof parsed.deviceId !== 'string' ||
      typeof parsed.offlineUntil !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function persist(next: StoredSession): Promise<void> {
  stored = next;
  await saveSecureSession(JSON.stringify(next));
}

function applyResponse(response: SessionResponse): void {
  accessToken = response.access_token;
  accessExpiresAt = Date.now() + response.expires_in * 1000;
}

export function authMode(): 'pilot' | 'lab' {
  return AUTH_MODE;
}

export async function initializeAuthSession(): Promise<void> {
  if (initialized) return initialized;
  initialized = (async () => {
    stored = parseSession(await readSecureSession());
    accessToken = null;
    accessExpiresAt = 0;
  })();
  return initialized;
}

export async function login(username: string, password: string, deviceId?: string): Promise<AuthSnapshot> {
  if (stored) await logout();
  const device = deviceId ?? (await getWorkSyncRepository().status()).deviceId;
  const transport = getAuthTransport();
  const response = await transport.login({
    username,
    password,
    device_id: device,
    platform: 'native',
  });
  const next: StoredSession = {
    refreshToken: response.refresh_token,
    user: response.user,
    scopeId: response.scope_id,
    deviceId: response.device_id,
    offlineUntil: Date.now() + OFFLINE_GRACE_MS,
    mustChangePassword: response.must_change_password,
  };
  await persist(next);
  applyResponse(response);
  return snapshot();
}

export async function refreshSession(): Promise<AuthSnapshot> {
  if (!stored) throw new AuthError('AUTH_REQUIRED');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AuthError('OFFLINE');
  try {
    const response = await getAuthTransport().refresh({ refresh_token: stored.refreshToken });
    const next: StoredSession = {
      ...stored,
      refreshToken: response.refresh_token,
      user: response.user,
      scopeId: response.scope_id,
      deviceId: response.device_id,
      offlineUntil: Date.now() + OFFLINE_GRACE_MS,
      mustChangePassword: response.must_change_password,
    };
    await persist(next);
    applyResponse(response);
    return snapshot();
  } catch (error) {
    if (error instanceof AuthHttpError && error.status === 401) {
      await clearSessionLocal();
      throw new AuthError(error.code);
    }
    throw error;
  }
}

export async function ensureAccessToken(): Promise<string> {
  if (accessToken && accessExpiresAt - ACCESS_SKEW_MS > Date.now()) return accessToken;
  if (!stored) throw new AuthError('AUTH_REQUIRED');
  await refreshSession();
  if (!accessToken) throw new AuthError('AUTH_REQUIRED');
  return accessToken;
}

export async function logout(): Promise<void> {
  const refresh = stored?.refreshToken;
  if (refresh) {
    try {
      await getAuthTransport().logout({ refresh_token: refresh });
    } catch {
      // El cierre local no depende de la red; el refresh se revoca al reconectar.
    }
  }
  await clearSessionLocal();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = await ensureAccessToken();
  await getAuthTransport().changePassword(token, {
    current_password: currentPassword,
    new_password: newPassword,
  });
  await clearSessionLocal();
}

async function clearSessionLocal(): Promise<void> {
  stored = null;
  accessToken = null;
  accessExpiresAt = 0;
  await clearSecureSession();
}

export function snapshot(): AuthSnapshot {
  const role: AuthRole | null = stored?.user.role ?? null;
  const offlineValid = stored ? stored.offlineUntil > Date.now() : false;
  return {
    user: stored?.user ?? null,
    role,
    scopeId: stored?.scopeId ?? null,
    deviceId: stored?.deviceId ?? null,
    offlineUntil: stored?.offlineUntil ?? null,
    canWrite: AUTH_MODE === 'lab' || (role === 'admin' && offlineValid),
  };
}

export function storedSession(): StoredSession | null {
  return stored;
}

export function canWriteLocal(): boolean {
  return snapshot().canWrite;
}

export function requireCanWriteLocal(): void {
  if (!canWriteLocal()) {
    throw new AuthError('ROL_SIN_ESCRITURA', 'La sesión actual solo permite consulta');
  }
}

export async function requireAccessToken(): Promise<string> {
  if (AUTH_MODE === 'lab') {
    // El modo laboratorio conserva su token manual; la UI lo entrega aparte.
    throw new AuthError('LAB_TOKEN_REQUIRED');
  }
  return ensureAccessToken();
}

export function resetAuthSessionForTests(): void {
  stored = null;
  accessToken = null;
  accessExpiresAt = 0;
  initialized = null;
}
