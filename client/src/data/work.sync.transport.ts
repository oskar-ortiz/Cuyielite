// Transporte nativo acotado para sincronizacion de laboratorio (T6).
// El token vive solo en memoria; la URL base es loopback fija.

export const LAB_BASE_URL = 'http://127.0.0.1:8000';

export function isLoopbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

export interface SyncTransport {
  context(token: string): Promise<{ protocol_version: number; scope_id: string; device_id: string; limits: Record<string, number> }>;
  push(token: string, req: unknown): Promise<unknown>;
}

export function createFetchTransport(): SyncTransport {
  async function request(path: string, token: string, init?: RequestInit): Promise<unknown> {
    const url = LAB_BASE_URL + path;
    if (!isLoopbackUrl(url)) throw new Error('Destino fuera de loopback');
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      redirect: 'error',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  return {
    context: (token) => request('/sync/context', token) as Promise<any>,
    push: (token, req) => request('/sync/push', token, { method: 'POST', body: JSON.stringify(req) }),
  };
}

export function assertScopeUnchanged(previousScopeId: string | null, newScopeId: string): void {
  if (previousScopeId && previousScopeId !== newScopeId) {
    throw new Error('Cambio de scope no permitido');
  }
}
