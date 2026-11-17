import type { ConflictKey, DomainWriteResult, PozaRef } from './work.domain.repository.js';
import type {
  Cuyo,
  CuyoInput,
  Evento,
  EventoInput,
  Parto,
  PartoCria,
  PartoInput,
  Pesaje,
  PesajeInput,
} from './work.domain.validation.js';

export interface DomainRepository {
  listPozas(): Promise<PozaRef[]>;
  listConflictKeys(): Promise<ConflictKey[]>;
  listCuyesByPoza(pozaId: string): Promise<Cuyo[]>;
  listAllCuyes(): Promise<Cuyo[]>;
  getCuyo(id: string): Promise<Cuyo | null>;
  listPartosByCuyo(cuyId: string): Promise<Parto[]>;
  listPesajesByCuyo(cuyId: string): Promise<Pesaje[]>;
  listEventosByCuyo(cuyId: string): Promise<Evento[]>;
  listVinculosByCuyo(cuyId: string): Promise<PartoCria[]>;
  listCriasByParto(partoId: string): Promise<Cuyo[]>;
  getParto(id: string): Promise<Parto | null>;
  getPesaje(id: string): Promise<Pesaje | null>;
  getEvento(id: string): Promise<Evento | null>;
  createCuyo(input: CuyoInput): Promise<DomainWriteResult>;
  updateCuyo(id: string, input: CuyoInput): Promise<DomainWriteResult>;
  createParto(input: PartoInput): Promise<DomainWriteResult>;
  updateParto(id: string, input: PartoInput): Promise<DomainWriteResult>;
  createPesaje(input: PesajeInput): Promise<DomainWriteResult>;
  updatePesaje(id: string, input: PesajeInput): Promise<DomainWriteResult>;
  createEvento(input: EventoInput): Promise<DomainWriteResult>;
  updateEvento(id: string, input: EventoInput): Promise<DomainWriteResult>;
}
