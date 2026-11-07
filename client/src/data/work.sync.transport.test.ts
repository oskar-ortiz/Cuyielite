import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchTransport } from './work.sync.transport';

const state = vi.hoisted(() => ({
  platform: 'electron',
  http: vi.fn(),
  context: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => state.platform },
  CapacitorHttp: { request: (...args: unknown[]) => state.http(...args) },
  registerPlugin: () => ({ context: state.context, push: state.push }),
}));

const TOKEN = 'lab-e2e-token-abcdefghijklmnopqrstuvwxyz012345';

describe('transporte S3 nativo (T6)', () => {
  beforeEach(() => {
    state.platform = 'electron';
    state.http.mockReset();
    state.context.mockReset();
    state.push.mockReset();
  });

  it('Electron delega context/push en el plugin acotado, sin URL ni metodo', async () => {
    state.context.mockResolvedValue({ protocol_version: 1, scope_id: 's', device_id: 'd', limits: {} });
    state.push.mockResolvedValue({ protocol_version: 1, results: [] });
    const t = createFetchTransport();
    const ctx = await t.context(TOKEN);
    expect(ctx.scope_id).toBe('s');
    expect(state.context).toHaveBeenCalledWith({ token: TOKEN });
    const req = { protocol_version: 1, device_id: 'd', operations: [] };
    await t.push(TOKEN, req);
    expect(state.push).toHaveBeenCalledWith({ token: TOKEN, body: req });
  });

  it('Android usa CapacitorHttp con loopback fijo, disableRedirects y data JSON', async () => {
    state.platform = 'android';
    state.http.mockResolvedValue({ status: 200, data: { ok: true } });
    const t = createFetchTransport();
    await t.context(TOKEN);
    expect(state.http).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://127.0.0.1:8000/sync/context',
        method: 'GET',
        disableRedirects: true,
      }),
    );
    state.http.mockClear();
    await t.push(TOKEN, { a: 1 });
    expect(state.http).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://127.0.0.1:8000/sync/push',
        method: 'POST',
        disableRedirects: true,
        data: { a: 1 },
      }),
    );
  });

  it('Android rechaza una respuesta 3xx en lugar de seguirla', async () => {
    state.platform = 'android';
    state.http.mockResolvedValue({ status: 302, data: {} });
    const t = createFetchTransport();
    await expect(t.context(TOKEN)).rejects.toThrow('Redireccion rechazada');
  });

  it('Android propaga error HTTP no exitoso', async () => {
    state.platform = 'android';
    state.http.mockResolvedValue({ status: 503, data: {} });
    const t = createFetchTransport();
    await expect(t.context(TOKEN)).rejects.toThrow('HTTP 503');
  });

  it('web no inicia sincronizacion: error explicito sin solicitud', () => {
    state.platform = 'web';
    expect(() => createFetchTransport()).toThrow(/no disponible/);
    expect(state.http).not.toHaveBeenCalled();
    expect(state.context).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled();
  });

  it('plataforma no admitida tampoco inicia sincronizacion', () => {
    state.platform = 'ios';
    expect(() => createFetchTransport()).toThrow(/no disponible/);
  });
});
