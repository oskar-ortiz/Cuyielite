export type AuthRole = 'admin' | 'viewer';

export interface AuthUser {
  id: string;
  username: string;
  role: AuthRole;
}

export interface SessionResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
  scope_id: string;
  device_id: string;
  must_change_password: boolean;
}

export interface StoredSession {
  refreshToken: string;
  user: AuthUser;
  scopeId: string;
  deviceId: string;
  offlineUntil: number;
  mustChangePassword: boolean;
}

export interface AuthSnapshot {
  user: AuthUser | null;
  role: AuthRole | null;
  scopeId: string | null;
  deviceId: string | null;
  offlineUntil: number | null;
  canWrite: boolean;
}

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}
