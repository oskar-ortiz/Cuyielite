import { Capacitor } from '@capacitor/core';

import { adaptWorkConnection, getWorkConnection } from './work.database.android.js';
import {
  readAlertasDerivadas,
  readCategoriaDerivada,
  type AlertaDerivada,
  type CategoriaDerivada,
} from './work.derived.apply.js';
import { SyncLab } from './work.sync.transport.js';

// Lectura del feed derivado. Es solo consulta en ambas plataformas: no existe
// ninguna operación de escritura de categorías o alertas desde el cliente.
export interface DerivedReader {
  categoria(cuyId: string): Promise<CategoriaDerivada | null>;
  alertas(cuyId: string): Promise<AlertaDerivada[]>;
}

const androidReader: DerivedReader = {
  async categoria(cuyId) {
    return readCategoriaDerivada(adaptWorkConnection(await getWorkConnection()), cuyId);
  },
  async alertas(cuyId) {
    return readAlertasDerivadas(adaptWorkConnection(await getWorkConnection()), cuyId);
  },
};

const electronReader: DerivedReader = {
  categoria: (cuyId) => SyncLab.categoriaDerivada({ cuyId }) as Promise<CategoriaDerivada | null>,
  alertas: (cuyId) => SyncLab.alertasDerivadas({ cuyId }) as Promise<AlertaDerivada[]>,
};

export function getDerivedReader(): DerivedReader {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return androidReader;
  if (platform === 'electron') return electronReader;
  throw new Error('La evaluación derivada requiere Android o Windows instalado.');
}
