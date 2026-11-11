import { adaptWorkConnection, getWorkConnection } from './work.database.android.js';
import type { DomainRepository } from './work.domain.api.js';
import * as repo from './work.domain.repository.js';

async function db() {
  return adaptWorkConnection(await getWorkConnection());
}

export const androidDomainRepository: DomainRepository = {
  listPozas: async () => repo.listPozas(await db()),
  listConflictKeys: async () => repo.listConflictKeys(await db()),
  listCuyesByPoza: async (pozaId) => repo.listCuyesByPoza(await db(), pozaId),
  listAllCuyes: async () => repo.listAllCuyes(await db()),
  getCuyo: async (id) => repo.getCuyo(await db(), id),
  listPartosByCuyo: async (cuyId) => repo.listPartosByCuyo(await db(), cuyId),
  listPesajesByCuyo: async (cuyId) => repo.listPesajesByCuyo(await db(), cuyId),
  listEventosByCuyo: async (cuyId) => repo.listEventosByCuyo(await db(), cuyId),
  listCriasByParto: async (partoId) => repo.listCriasByParto(await db(), partoId),
  getParto: async (id) => repo.getParto(await db(), id),
  getPesaje: async (id) => repo.getPesaje(await db(), id),
  getEvento: async (id) => repo.getEvento(await db(), id),
  createCuyo: async (input) => repo.createCuyo(await db(), input),
  updateCuyo: async (id, input) => repo.updateCuyo(await db(), id, input),
  createParto: async (input) => repo.createParto(await db(), input),
  updateParto: async (id, input) => repo.updateParto(await db(), id, input),
  createPesaje: async (input) => repo.createPesaje(await db(), input),
  updatePesaje: async (id, input) => repo.updatePesaje(await db(), id, input),
  createEvento: async (input) => repo.createEvento(await db(), input),
  updateEvento: async (id, input) => repo.updateEvento(await db(), id, input),
};
