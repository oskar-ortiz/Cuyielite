import { SqlitePoc, type WorkDbStatus } from './sqlitePocPlugin';

export type { WorkDbStatus };

export async function initializeWorkDatabase(): Promise<WorkDbStatus> {
  const result = await SqlitePoc.initializeWorkDatabase();
  return result.status;
}

export async function getWorkDatabaseStatus(): Promise<WorkDbStatus> {
  return SqlitePoc.getWorkDatabaseStatus();
}

export async function closeWorkDatabase(): Promise<void> {
  await SqlitePoc.closeWorkDatabase();
}
