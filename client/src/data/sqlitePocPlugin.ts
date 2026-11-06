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
}

export interface WorkDbStatus {
  schemaFamily: string;
  schemaVersion: number;
  datasetId: string;
  checksum: string;
  counts: Record<string, number>;
}

export const SqlitePoc = registerPlugin<SqlitePocPlugin>('SqlitePoc');
export { SqlitePoc as default };
