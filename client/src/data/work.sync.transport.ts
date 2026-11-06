import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';

// Transporte nativo acotado para sincronizacion de laboratorio (T6).
// El token vive solo en memoria; la URL base es loopback fija y no la elige
// el renderer. En web no hay transporte: la sincronizacion queda deshabilitada.

export const LAB_BASE_URL = 'http://127.0.0.1:8000';

export function isLoopbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' && u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export interface SyncContext {
  protocol_version: number;
  scope_id: string;
  device_id: string;
  limits: Record<string, number>;
}

export interface SyncTransport {
  context(token: string): Promise<SyncContext>;
  push(token: string, req: unknown): Promise<unknown>;
}

interface SyncLabPlugin {
  context(options: { token: string }): Promise<SyncContext>;
  push(options: { token: string; body: unknown }): Promise<unknown>;
}

// Plugin Electron registrado en el manifest de Capawesome. El proceso principal
// resuelve la URL fija, el metodo y el rechazo de redirecciones.
const SyncLab = registerPlugin<SyncLabPlugin>('SyncLab');

function assertLoopback(path: string): string {
  const url = LAB_BASE_URL + path;
  if (!isLoopbackUrl(url)) throw new Error('Destino fuera de loopback');
  return url;
}

async function capRequest(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
  const url = assertLoopback(path);
  const res = await CapacitorHttp.request({
    url,
    method: init?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    disableRedirects: true,
    ...(init?.body !== undefined ? { data: init.body } : {}),
  });
  if (res.status >= 300 && res.status < 400) throw new Error('Redireccion rechazada');
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
  return res.data;
}

export function createFetchTransport(): SyncTransport {
  const platform = Capacitor.getPlatform();
  if (platform === 'electron') {
    return {
      context: (token) => SyncLab.context({ token }),
      push: (token, req) => SyncLab.push({ token, body: req }),
    };
  }
  if (platform === 'android') {
    return {
      context: (token) => capRequest('/sync/context', token) as Promise<SyncContext>,
      push: (token, req) => capRequest('/sync/push', token, { method: 'POST', body: req }),
    };
  }
  throw new Error('Sincronizacion no disponible: se requiere Android o Windows instalado');
}
