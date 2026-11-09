import { Capacitor } from '@capacitor/core';

import type { Galpon, GalponesRepository, Poza } from './galpones.repository';
import { SqlitePoc } from './sqlitePocPlugin';
import { getWorkConnection } from './work.database.android';
import {
  createAndroidWorkGalpon,
  createAndroidWorkPoza,
  updateAndroidWorkGalpon,
  updateAndroidWorkPoza,
} from './work.outbox.android';
import {
  createElectronWorkGalpon,
  createElectronWorkPoza,
  updateElectronWorkGalpon,
  updateElectronWorkPoza,
} from './work.outbox.electron';

export type WorkGalponesReader = Pick<GalponesRepository, 'listGalpones' | 'listPozasByGalpon'>;

const androidReader: WorkGalponesReader = {
  async listGalpones(): Promise<Galpon[]> {
    const db = await getWorkConnection();
    const result = await db.query(
      'SELECT id, nombre, ubicacion FROM galpones WHERE deleted_at IS NULL ORDER BY nombre, id',
    );
    return (result.values ?? []).map((row: { id: string; nombre: string; ubicacion: string | null }) => ({
      id: row.id,
      nombre: row.nombre,
      ubicacion: row.ubicacion,
    }));
  },
  async listPozasByGalpon(galponId: string): Promise<Poza[]> {
    const db = await getWorkConnection();
    const result = await db.query(
      'SELECT id, galpon_id, codigo, tipo, capacidad_maxima FROM pozas WHERE galpon_id = ? AND deleted_at IS NULL ORDER BY codigo, id',
      [galponId],
    );
    return (result.values ?? []).map(
      (row: { id: string; galpon_id: string; codigo: string; tipo: string; capacidad_maxima: number }) => ({
        id: row.id,
        galponId: row.galpon_id,
        codigo: row.codigo,
        tipo: row.tipo,
        capacidadMaxima: row.capacidad_maxima,
      }),
    );
  },
};

const electronReader: WorkGalponesReader = {
  async listGalpones(): Promise<Galpon[]> {
    const result = await SqlitePoc.listWorkGalpones();
    return result.galpones;
  },
  async listPozasByGalpon(galponId: string): Promise<Poza[]> {
    const result = await SqlitePoc.listWorkPozasByGalpon({ galponId });
    return result.pozas.map((row) => ({
      id: row.id,
      galponId: row.galpon_id,
      codigo: row.codigo,
      tipo: row.tipo,
      capacidadMaxima: row.capacidad_maxima,
    }));
  },
};

export function getWorkGalponesReader(): WorkGalponesReader {
  if (Capacitor.getPlatform() === 'android') return androidReader;
  if (Capacitor.getPlatform() === 'electron') return electronReader;
  throw new Error('El modo trabajo requiere Android o Windows instalado.');
}

const androidRepository: GalponesRepository = {
  ...androidReader,
  async createGalpon(input) {
    const result = await createAndroidWorkGalpon(input);
    return { id: result.id, nombre: input.nombre, ubicacion: input.ubicacion };
  },
  async createPoza(input) {
    const result = await createAndroidWorkPoza(input.galponId, input);
    return {
      id: result.id,
      galponId: input.galponId,
      codigo: input.codigo,
      tipo: input.tipo,
      capacidadMaxima: input.capacidadMaxima,
    };
  },
  async updateGalpon(id, input) {
    await updateAndroidWorkGalpon(id, input);
    return { id, nombre: input.nombre, ubicacion: input.ubicacion };
  },
  async updatePoza(galponId, pozaId, input) {
    await updateAndroidWorkPoza(galponId, pozaId, input);
    return { id: pozaId, galponId, ...input };
  },
};

const electronWorkRepository: GalponesRepository = {
  ...electronReader,
  async createGalpon(input) {
    const result = await createElectronWorkGalpon(input);
    return { id: result.id, nombre: input.nombre, ubicacion: input.ubicacion };
  },
  async createPoza(input) {
    const result = await createElectronWorkPoza(input.galponId, input);
    return {
      id: result.id,
      galponId: input.galponId,
      codigo: input.codigo,
      tipo: input.tipo,
      capacidadMaxima: input.capacidadMaxima,
    };
  },
  async updateGalpon(id, input) {
    await updateElectronWorkGalpon(id, input);
    return { id, nombre: input.nombre, ubicacion: input.ubicacion };
  },
  async updatePoza(galponId, pozaId, input) {
    await updateElectronWorkPoza(galponId, pozaId, input);
    return { id: pozaId, galponId, ...input };
  },
};

export function getWorkGalponesRepository(): GalponesRepository {
  if (Capacitor.getPlatform() === 'android') return androidRepository;
  if (Capacitor.getPlatform() === 'electron') return electronWorkRepository;
  throw new Error('El modo trabajo requiere Android o Windows instalado.');
}
