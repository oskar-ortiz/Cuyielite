import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { SyncLab } from './work.sync.transport.js';

const LAB_BASE_URL = 'http://127.0.0.1:8000';

export class MlHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MlHttpError';
  }
}

export function isMlHttpError(error: unknown): error is MlHttpError {
  return typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number';
}

function assertLoopback(path: string): string {
  const url = LAB_BASE_URL + path;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') throw new Error('fuera de loopback');
  } catch {
    throw new Error('Destino ML fuera de loopback');
  }
  return url;
}

async function androidRequest(path: string, token: string, body: unknown): Promise<unknown> {
  const res = await CapacitorHttp.request({
    url: assertLoopback(path),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    data: body,
    disableRedirects: true,
    connectTimeout: 15_000,
    readTimeout: 30_000,
  });
  if (res.status >= 300 && res.status < 400) throw new MlHttpError(0, 'Redirección rechazada');
  if (res.status < 200 || res.status >= 300) throw new MlHttpError(res.status, `HTTP ${res.status}`);
  return res.data;
}

async function electronRequest(
  call: (token: string, body: unknown) => Promise<unknown>,
  token: string,
  body: unknown,
): Promise<unknown> {
  try {
    return await call(token, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = /HTTP (\d{3})/.exec(message);
    if (match) throw new MlHttpError(Number(match[1]), message);
    throw error;
  }
}

export interface MlTransport {
  predictHembra(token: string, body: unknown): Promise<unknown>;
  predictCandidata(token: string, body: unknown): Promise<unknown>;
  assistantQuery(token: string, body: unknown): Promise<unknown>;
}

export interface HembraResult {
  cuy_id: string;
  clase: 'NORMAL' | 'DESCARTE';
  motivos: string[];
  estado_calidad: string;
  fecha_descarte_sugerida: string | null;
  peso_monta_en_rango_900_1000: boolean | null;
}

export interface ApoyoModelo {
  clase: 'ELITE' | 'NORMAL';
  probabilidades: Record<string, number>;
}

export interface CandidataResult {
  cuy_id: string;
  clase: 'ELITE' | 'NORMAL';
  motivos: string[];
  estado_calidad: string;
  apoyo_modelo: ApoyoModelo | null;
}

export interface AssistantResult {
  respuesta: string;
  fuentes: string[];
}

export function getMlTransport(): MlTransport {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    return {
      predictHembra: (token, body) => androidRequest('/ml/predict/hembra', token, body),
      predictCandidata: (token, body) => androidRequest('/ml/predict/candidata', token, body),
      assistantQuery: (token, body) => androidRequest('/assistant/query', token, body),
    };
  }
  if (platform === 'electron') {
    return {
      predictHembra: (token, body) =>
        electronRequest((t, b) => SyncLab.predictHembra({ token: t, body: b }), token, body),
      predictCandidata: (token, body) =>
        electronRequest((t, b) => SyncLab.predictCandidata({ token: t, body: b }), token, body),
      assistantQuery: (token, body) =>
        electronRequest((t, b) => SyncLab.assistantQuery({ token: t, body: b }), token, body),
    };
  }
  throw new Error('Las consultas ML/RAG requieren Android o Windows instalado');
}
