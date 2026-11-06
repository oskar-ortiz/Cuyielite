import type { GalponInput, PozaInput } from './galpones.validation';
import { adaptWorkConnection, getWorkConnection } from './work.database.android';
import {
  createWorkGalpon,
  createWorkPoza,
  updateWorkGalpon,
  updateWorkPoza,
  type LocalWriteResult,
} from './work.outbox';

export async function createAndroidWorkGalpon(input: GalponInput): Promise<LocalWriteResult> {
  return createWorkGalpon(adaptWorkConnection(await getWorkConnection()), input);
}

export async function createAndroidWorkPoza(galponId: string, input: PozaInput): Promise<LocalWriteResult> {
  return createWorkPoza(adaptWorkConnection(await getWorkConnection()), galponId, input);
}

export async function updateAndroidWorkGalpon(id: string, input: GalponInput): Promise<LocalWriteResult> {
  return updateWorkGalpon(adaptWorkConnection(await getWorkConnection()), id, input);
}

export async function updateAndroidWorkPoza(galponId: string, id: string, input: PozaInput): Promise<LocalWriteResult> {
  return updateWorkPoza(adaptWorkConnection(await getWorkConnection()), galponId, id, input);
}
