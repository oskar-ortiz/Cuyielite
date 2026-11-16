import type { WorkSyncStatus } from './work.sync.status.js';

export type SyncPhase =
  'unsynced' | 'pending' | 'syncing' | 'done' | 'offline' | 'conflict' | 'scopeMismatch' | 'error';
export type SyncTone = 'medium' | 'warning' | 'success' | 'danger' | 'primary';

export type SyncOutcome =
  { kind: 'none' } | { kind: 'done' } | { kind: 'offline' } | { kind: 'scopeMismatch' } | { kind: 'error' };

export interface SyncView {
  phase: SyncPhase;
  title: string;
  detail: string;
  tone: SyncTone;
}

// Un fallo de red o un 503 se puede reintentar; un token inválido o un contexto
// incompatible exigen revisar la configuración antes de volver a intentarlo.
export function classifySyncError(error: unknown): 'offline' | 'scopeMismatch' | 'error' {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/scope local no coincide|cambio de scope no permitido|ámbito local no coincide/i.test(message)) {
    return 'scopeMismatch';
  }
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
  const pendingText = pending === 1 ? '1 cambio local espera envío.' : `${pending} cambios locales esperan envío.`;
  const conflictText =
    conflicts === 1 ? '1 conflicto espera tu decisión.' : `${conflicts} conflictos esperan tu decisión.`;
  const note =
    rejected === 0
      ? ''
      : rejected === 1
        ? ' El servidor rechazó 1 cambio; requiere revisión.'
        : ` El servidor rechazó ${rejected} cambios; requieren revisión.`;

  if (syncing) {
    return {
      phase: 'syncing',
      title: 'Sincronizando…',
      detail: 'Puedes seguir consultando los galpones mientras termina.' + note,
      tone: 'primary',
    };
  }
  if (outcome.kind === 'scopeMismatch') {
    return {
      phase: 'scopeMismatch',
      title: 'La sesión y la base local tienen ámbitos distintos',
      detail:
        'No se modificaron ni borraron datos, y los cambios pendientes se conservaron. Verifica que la cuenta corresponda al Centro Lope y que esta instalación de Trabajo esté vinculada al mismo ámbito. No reintentes hasta corregir el perfil.',
      tone: 'danger',
    };
  }
  if (conflicts > 0) {
    return {
      phase: 'conflict',
      title: 'Conflictos pendientes',
      detail: `${conflictText} Los cambios locales se conservan.` + note,
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
      detail: pendingText + note,
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
