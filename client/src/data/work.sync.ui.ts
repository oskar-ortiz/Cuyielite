import type { WorkSyncStatus } from './work.sync.status.js';

export type SyncPhase = 'unsynced' | 'pending' | 'syncing' | 'done' | 'offline' | 'conflict' | 'error';
export type SyncTone = 'medium' | 'warning' | 'success' | 'danger' | 'primary';

export type SyncOutcome = { kind: 'none' } | { kind: 'done' } | { kind: 'offline' } | { kind: 'error' };

export interface SyncView {
  phase: SyncPhase;
  title: string;
  detail: string;
  tone: SyncTone;
}

function changes(count: number): string {
  return count === 1 ? '1 cambio' : `${count} cambios`;
}

// Un fallo de red o un 503 se puede reintentar; un token inválido o un contexto
// incompatible exigen revisar la configuración antes de volver a intentarlo.
export function classifySyncError(error: unknown): 'offline' | 'error' {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (
    /HTTP 401|HTTP 403|Token de sincronizacion invalido|Contexto central incompatible|Sincronizacion no disponible|protocol_version/i.test(
      message,
    )
  ) {
    return 'error';
  }
  if (
    /network|fetch failed|failed to fetch|load failed|timeout|timed out|aborted|ECONN|socket|HTTP 503|ERR_CONNECTION|ERR_INTERNET_DISCONNECTED|Failed to connect|Connection refused|EHOSTUNREACH|ENETUNREACH/i.test(
      message,
    )
  ) {
    return 'offline';
  }
  return 'error';
}

export function describeSyncState(input: {
  status: WorkSyncStatus | null;
  syncing: boolean;
  outcome?: SyncOutcome;
}): SyncView {
  const { status, syncing } = input;
  const outcome = input.outcome ?? { kind: 'none' as const };
  const pending = status?.pending ?? 0;
  const conflicts = status?.conflicts ?? 0;
  const rejected = status?.rejected ?? 0;
  const note = rejected > 0 ? ` El servidor rechazó ${changes(rejected)}; requiere revisión.` : '';

  if (syncing) {
    return {
      phase: 'syncing',
      title: 'Sincronizando…',
      detail: 'Puedes seguir consultando los galpones mientras termina.' + note,
      tone: 'primary',
    };
  }
  if (conflicts > 0) {
    return {
      phase: 'conflict',
      title: 'Conflictos pendientes',
      detail: `${changes(conflicts)} esperan tu decisión. Los cambios locales se conservan.` + note,
      tone: 'warning',
    };
  }
  if (outcome.kind === 'offline') {
    return {
      phase: 'offline',
      title: 'Sin conexión',
      detail: 'No se pudo contactar al servidor. Tus datos locales siguen disponibles; puedes reintentar.' + note,
      tone: 'warning',
    };
  }
  if (outcome.kind === 'error') {
    return {
      phase: 'error',
      title: 'No se pudo sincronizar',
      detail: 'Revisa el token de laboratorio y vuelve a intentarlo.' + note,
      tone: 'danger',
    };
  }
  if (pending > 0) {
    return {
      phase: 'pending',
      title: 'Cambios pendientes',
      detail: `${changes(pending)} locales esperan envío.` + note,
      tone: 'warning',
    };
  }
  if (outcome.kind === 'done') {
    return {
      phase: 'done',
      title: 'Sincronización completada',
      detail: 'El ciclo terminó. Puedes seguir usando la base local.' + note,
      tone: 'success',
    };
  }
  if (status?.scopeId) {
    return {
      phase: 'done',
      title: 'Sin cambios pendientes',
      detail: 'Esta base de trabajo ya está vinculada con el servidor.' + note,
      tone: 'success',
    };
  }
  return {
    phase: 'unsynced',
    title: 'Sin sincronizar',
    detail: 'Esta base de trabajo todavía no se vinculó con el servidor.' + note,
    tone: 'medium',
  };
}
