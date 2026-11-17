import { SqlitePoc } from './sqlitePocPlugin.js';
import type { DomainRepository } from './work.domain.api.js';

export const electronDomainRepository: DomainRepository = {
  listPozas: async () => (await SqlitePoc.listDomainPozas()).pozas,
  listConflictKeys: async () => (await SqlitePoc.listDomainConflicts()).conflicts,
  listCuyesByPoza: async (pozaId) => (await SqlitePoc.listDomainCuyesByPoza({ pozaId })).cuyes,
  listAllCuyes: async () => (await SqlitePoc.listDomainCuyes()).cuyes,
  getCuyo: async (id) => (await SqlitePoc.getDomainCuyo({ id })).cuyo,
  listPartosByCuyo: async (cuyId) => (await SqlitePoc.listDomainPartos({ cuyId })).partos,
  listPesajesByCuyo: async (cuyId) => (await SqlitePoc.listDomainPesajes({ cuyId })).pesajes,
  listEventosByCuyo: async (cuyId) => (await SqlitePoc.listDomainEventos({ cuyId })).eventos,
  listVinculosByCuyo: async (cuyId) => (await SqlitePoc.listDomainVinculos({ cuyId })).vinculos,
  listCriasByParto: async (partoId) => (await SqlitePoc.listDomainCrias({ partoId })).cuyes,
  getParto: async (id) => (await SqlitePoc.getDomainParto({ id })).parto,
  getPesaje: async (id) => (await SqlitePoc.getDomainPesaje({ id })).pesaje,
  getEvento: async (id) => (await SqlitePoc.getDomainEvento({ id })).evento,
  createCuyo: async (input) => SqlitePoc.createDomainCuyo({ input }),
  updateCuyo: async (id, input) => SqlitePoc.updateDomainCuyo({ id, input }),
  createParto: async (input) => SqlitePoc.createDomainParto({ input }),
  updateParto: async (id, input) => SqlitePoc.updateDomainParto({ id, input }),
  createPesaje: async (input) => SqlitePoc.createDomainPesaje({ input }),
  updatePesaje: async (id, input) => SqlitePoc.updateDomainPesaje({ id, input }),
  createEvento: async (input) => SqlitePoc.createDomainEvento({ input }),
  updateEvento: async (id, input) => SqlitePoc.updateDomainEvento({ id, input }),
};
