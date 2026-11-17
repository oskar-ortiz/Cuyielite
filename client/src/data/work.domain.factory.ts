import { Capacitor } from '@capacitor/core';

import { requireCanWriteLocal } from './auth.session.js';
import { androidDomainRepository } from './work.domain.android.js';
import type { DomainRepository } from './work.domain.api.js';
import { electronDomainRepository } from './work.domain.electron.js';

function guardWrites(repository: DomainRepository): DomainRepository {
  return {
    ...repository,
    createCuyo: async (input) => {
      requireCanWriteLocal();
      return repository.createCuyo(input);
    },
    updateCuyo: async (id, input) => {
      requireCanWriteLocal();
      return repository.updateCuyo(id, input);
    },
    createParto: async (input) => {
      requireCanWriteLocal();
      return repository.createParto(input);
    },
    updateParto: async (id, input) => {
      requireCanWriteLocal();
      return repository.updateParto(id, input);
    },
    createPesaje: async (input) => {
      requireCanWriteLocal();
      return repository.createPesaje(input);
    },
    updatePesaje: async (id, input) => {
      requireCanWriteLocal();
      return repository.updatePesaje(id, input);
    },
    createEvento: async (input) => {
      requireCanWriteLocal();
      return repository.createEvento(input);
    },
    updateEvento: async (id, input) => {
      requireCanWriteLocal();
      return repository.updateEvento(id, input);
    },
  };
}

export function getDomainRepository(): DomainRepository {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return guardWrites(androidDomainRepository);
  if (platform === 'electron') return guardWrites(electronDomainRepository);
  throw new Error('El dominio de trabajo requiere Android o Windows instalado.');
}
