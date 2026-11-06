import type { GalponInput, PozaInput } from './galpones.validation';
import { SqlitePoc, type LocalWriteResult } from './sqlitePocPlugin';

export function createElectronWorkGalpon(input: GalponInput): Promise<LocalWriteResult> {
  return SqlitePoc.createWorkGalpon(input);
}

export function createElectronWorkPoza(galponId: string, input: PozaInput): Promise<LocalWriteResult> {
  return SqlitePoc.createWorkPoza({ galponId, ...input });
}

export function updateElectronWorkGalpon(id: string, input: GalponInput): Promise<LocalWriteResult> {
  return SqlitePoc.updateWorkGalpon({ id, ...input });
}

export function updateElectronWorkPoza(galponId: string, id: string, input: PozaInput): Promise<LocalWriteResult> {
  return SqlitePoc.updateWorkPoza({ galponId, id, ...input });
}
