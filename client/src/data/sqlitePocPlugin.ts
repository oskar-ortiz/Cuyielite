import { registerPlugin } from '@capacitor/core';

export interface SqlitePocPlugin {
  saveValue(options: { value: string }): Promise<{ ok: boolean }>;
  readValue(): Promise<{ value: string | null }>;
  initializeDatabase(): Promise<{ ok: boolean }>;
  listGalpones(): Promise<{ galpones: { id: string; nombre: string; ubicacion: string | null }[] }>;
  listPozasByGalpon(options: { galponId: string }): Promise<{
    pozas: { id: string; galpon_id: string; codigo: string; tipo: string; capacidad_maxima: number }[];
  }>;
  createGalpon(options: { nombre: string; ubicacion: string | null }): Promise<{
    galpon: { id: string; nombre: string; ubicacion: string | null };
  }>;
  createPoza(options: { galponId: string; codigo: string; tipo: string; capacidadMaxima: number }): Promise<{
    poza: { id: string; galpon_id: string; codigo: string; tipo: string; capacidad_maxima: number };
  }>;
  updateGalpon(options: { id: string; nombre: string; ubicacion: string | null }): Promise<{
    galpon: { id: string; nombre: string; ubicacion: string | null } | null;
  }>;
  updatePoza(options: {
    galponId: string;
    pozaId: string;
    codigo: string;
    tipo: string;
    capacidadMaxima: number;
  }): Promise<{
    poza: { id: string; galpon_id: string; codigo: string; tipo: string; capacidad_maxima: number } | null;
  }>;
  initializeWorkDatabase(): Promise<{ ok: boolean; status: WorkDbStatus }>;
  getWorkDatabaseStatus(): Promise<WorkDbStatus>;
  closeWorkDatabase(): Promise<{ ok: boolean }>;
  listWorkGalpones(): Promise<{ galpones: { id: string; nombre: string; ubicacion: string | null }[] }>;
  listWorkPozasByGalpon(options: { galponId: string }): Promise<{
    pozas: { id: string; galpon_id: string; codigo: string; tipo: string; capacidad_maxima: number }[];
  }>;
  createWorkGalpon(options: { nombre: string; ubicacion: string | null }): Promise<LocalWriteResult>;
  createWorkPoza(options: {
    galponId: string;
    codigo: string;
    tipo: string;
    capacidadMaxima: number;
  }): Promise<LocalWriteResult>;
  updateWorkGalpon(options: { id: string; nombre: string; ubicacion: string | null }): Promise<LocalWriteResult>;
  updateWorkPoza(options: {
    galponId: string;
    id: string;
    codigo: string;
    tipo: string;
    capacidadMaxima: number;
  }): Promise<LocalWriteResult>;
}

export interface LocalWriteResult {
  id: string;
  operationId: string | null;
  changed: boolean;
}

export interface WorkDbStatus {
  schemaFamily: string;
  schemaVersion: number;
  datasetId: string;
  checksum: string;
  syncChecksum?: string;
  deviceId?: string;
  scopeId?: string | null;
  cursor?: string | null;
  counts: Record<string, number>;
}

export const SqlitePoc = registerPlugin<SqlitePocPlugin>('SqlitePoc');
export { SqlitePoc as default };
