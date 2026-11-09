import type { GalponesRepository } from './galpones.repository';
import { getGalponesRepository } from './galpones.repository.factory';
import { getWorkGalponesRepository } from './work.galpones.repository';

export type DataMode = 'demo' | 'trabajo';

// La demo y el trabajo nunca comparten repositorio: cada modo resuelve su base.
export function getGalponesRepositoryFor(mode: DataMode): GalponesRepository {
  return mode === 'trabajo' ? getWorkGalponesRepository() : getGalponesRepository();
}
