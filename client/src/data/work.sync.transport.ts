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
  const w = (typeof window !== 'undefined' ? (window as any) : null);
  const native = w && w.electronSync;
  if (native) {
    return {
      context: (token) => native.context(token),
      push: (token, req) => native.push(token, req),
    };
  }
  const cap = w && w.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    const http = cap.Plugins && cap.Plugins.CapacitorHttp;
    if (http) {
      async function capRequest(path: string, token: string, init?: RequestInit): Promise<unknown> {
        const url = LAB_BASE_URL + path;
        if (!isLoopbackUrl(url)) throw new Error('Destino fuera de loopback');
        const opts: any = {
          url,
          method: (init?.method ?? 'GET'),
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          redirect: 'error',
        };
        if (init?.body) opts.data = JSON.parse(init.body as string);
        const res = await http.request(opts);
        if (res.status < 200 || res.status >= 300) throw new Error('HTTP ' + res.status);
        return res.data;
      }
      return {
        context: (token) => capRequest('/sync/context', token) as Promise<any>,
        push: (token, req) => capRequest('/sync/push', token, { method: 'POST', body: JSON.stringify(req) }),
      };
    }
  }
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
