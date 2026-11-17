// Configuración de acceso del cliente. El valor de build decide si se usa el
// login de piloto o el token de laboratorio; nunca se acepta una URL arbitraria
// desde la UI.
const env = ((import.meta as unknown as { env?: Record<string, string> }).env ?? {}) as Record<string, string>;

export type AuthMode = 'pilot' | 'lab';

export const AUTH_MODE: AuthMode =
  (env.VITE_AUTH_MODE ?? (env.MODE === 'test' ? 'lab' : 'pilot')).toLowerCase() === 'lab' ? 'lab' : 'pilot';

export const API_BASE_URL = (env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');

export function isAllowedApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  } catch {
    return false;
  }
}

export function apiUrl(path: string): string {
  const value = `${API_BASE_URL}${path}`;
  if (!isAllowedApiUrl(value)) throw new Error('Destino de API no autorizado');
  return value;
}
