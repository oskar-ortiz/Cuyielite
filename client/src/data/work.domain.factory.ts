import { Capacitor } from '@capacitor/core';

import { androidDomainRepository } from './work.domain.android.js';
import type { DomainRepository } from './work.domain.api.js';
import { electronDomainRepository } from './work.domain.electron.js';

export function getDomainRepository(): DomainRepository {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return androidDomainRepository;
  if (platform === 'electron') return electronDomainRepository;
  throw new Error('El dominio de trabajo requiere Android o Windows instalado.');
}
