import { Capacitor } from '@capacitor/core';

import type { Galpon, GalponesRepository, Poza } from './galpones.repository';

interface ElectronSqlitePlugin {
  initializeDatabase(): Promise<{ ok: boolean }>;
  listGalpones(): Promise<{ galpones: { id: string; nombre: string; ubicacion: string | null }[] }>;
  listPozasByGalpon(options: { galponId: string }): Promise<{
    pozas: { id: string; galpon_id: string; codigo: string; tipo: string; capacidad_maxima: number }[];
  }>;
}

export function createElectronRepository(plugin: ElectronSqlitePlugin): GalponesRepository {
  return {
    async listGalpones(): Promise<Galpon[]> {
      await plugin.initializeDatabase();
      const result = await plugin.listGalpones();
      return result.galpones.map((g) => ({
        id: g.id,
        nombre: g.nombre,
        ubicacion: g.ubicacion,
      }));
    },
    async listPozasByGalpon(galponId: string): Promise<Poza[]> {
      await plugin.initializeDatabase();
      const result = await plugin.listPozasByGalpon({ galponId });
      return result.pozas.map((p) => ({
        id: p.id,
        galponId: p.galpon_id,
        codigo: p.codigo,
        tipo: p.tipo,
        capacidadMaxima: p.capacidad_maxima,
      }));
    },
  };
}

export function getElectronRepository(): GalponesRepository {
  const plugin = (Capacitor as unknown as { Plugins: { SqlitePoc: ElectronSqlitePlugin } }).Plugins.SqlitePoc;
  return createElectronRepository(plugin);
}
