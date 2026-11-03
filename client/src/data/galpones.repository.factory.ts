import { Capacitor } from '@capacitor/core';

import type { GalponesRepository } from './galpones.repository';
import { createAndroidRepository } from './galpones.repository.android';
import { getElectronRepository } from './galpones.repository.electron';

export function getGalponesRepository(): GalponesRepository {
  if (Capacitor.getPlatform() === 'android') {
    return createAndroidRepository();
  }
  return getElectronRepository();
}
