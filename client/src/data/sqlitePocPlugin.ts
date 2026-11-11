import { registerPlugin } from '@capacitor/core';

import type {
  Cuyo,
  CuyoInput,
  Evento,
  EventoInput,
  Parto,
  PartoInput,
  Pesaje,
  PesajeInput,
} from './work.domain.validation';

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
  listDomainCuyesByPoza(options: { pozaId: string }): Promise<{ cuyes: Cuyo[] }>;
  listDomainPozas(): Promise<{ pozas: { id: string; galponId: string; codigo: string; tipo: string }[] }>;
  listDomainConflicts(): Promise<{ conflicts: { entity: string; recordId: string }[] }>;
  listDomainCuyes(): Promise<{ cuyes: Cuyo[] }>;
  getDomainCuyo(options: { id: string }): Promise<{ cuyo: Cuyo | null }>;
  listDomainPartos(options: { cuyId: string }): Promise<{ partos: Parto[] }>;
  listDomainPesajes(options: { cuyId: string }): Promise<{ pesajes: Pesaje[] }>;
  listDomainEventos(options: { cuyId: string }): Promise<{ eventos: Evento[] }>;
  listDomainCrias(options: { partoId: string }): Promise<{ cuyes: Cuyo[] }>;
  getDomainParto(options: { id: string }): Promise<{ parto: Parto | null }>;
  getDomainPesaje(options: { id: string }): Promise<{ pesaje: Pesaje | null }>;
  getDomainEvento(options: { id: string }): Promise<{ evento: Evento | null }>;
  createDomainCuyo(options: { input: CuyoInput }): Promise<LocalWriteResult>;
  updateDomainCuyo(options: { id: string; input: CuyoInput }): Promise<LocalWriteResult>;
  createDomainParto(options: { input: PartoInput }): Promise<LocalWriteResult>;
  updateDomainParto(options: { id: string; input: PartoInput }): Promise<LocalWriteResult>;
  createDomainPesaje(options: { input: PesajeInput }): Promise<LocalWriteResult>;
  updateDomainPesaje(options: { id: string; input: PesajeInput }): Promise<LocalWriteResult>;
  createDomainEvento(options: { input: EventoInput }): Promise<LocalWriteResult>;
  updateDomainEvento(options: { id: string; input: EventoInput }): Promise<LocalWriteResult>;
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
