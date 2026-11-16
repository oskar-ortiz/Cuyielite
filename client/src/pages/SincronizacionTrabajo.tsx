import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PageFrame, PageIntro, SectionCard } from '../components/AppUi';
import { AUTH_MODE } from '../data/api.config';
import { ensureAccessToken, initializeAuthSession, snapshot } from '../data/auth.session';
import type { AuthSnapshot } from '../data/auth.types';
import { getWorkSyncRepository, type SyncRunSummary } from '../data/work.sync.repository';
import type { WorkSyncStatus } from '../data/work.sync.status';
import { classifySyncError, describeSyncState, type SyncOutcome } from '../data/work.sync.ui';
import './sincronizacion.css';

const SincronizacionTrabajo: React.FC = () => {
  const [status, setStatus] = useState<WorkSyncStatus | null>(null);
  const [auth, setAuth] = useState<AuthSnapshot>(() => snapshot());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome>({ kind: 'none' });
  const [token, setToken] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncRunSummary | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const authIdentityRef = useRef(`${auth.user?.id ?? ''}:${auth.scopeId ?? ''}`);

  useEffect(() => {
    const identity = `${auth.user?.id ?? ''}:${auth.scopeId ?? ''}`;
    if (authIdentityRef.current !== identity) {
      authIdentityRef.current = identity;
      setOutcome((current) => (current.kind === 'scopeMismatch' ? { kind: 'none' } : current));
    }
  }, [auth.scopeId, auth.user?.id]);

  const load = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setStatusError(null);
    Promise.resolve()
      .then(() => initializeAuthSession())
      .then(() => {
        if (requestId === requestIdRef.current) setAuth(snapshot());
        return getWorkSyncRepository().status();
      })
      .then((current) => {
        if (requestId !== requestIdRef.current) return;
        setStatus(current);
      })
      .catch(() => {
        if (requestId === requestIdRef.current) setStatusError('No se pudo leer el estado local de sincronización.');
      })
      .finally(() => {
        inFlightRef.current = false;
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      requestIdRef.current = -1;
    };
  }, [load]);
  useIonViewWillEnter(() => load());

  const pilot = AUTH_MODE === 'pilot';
  const scopeMismatch = outcome.kind === 'scopeMismatch';
  const canRun = pilot
    ? Boolean(auth.user) && !syncing && !scopeMismatch
    : token.trim().length > 0 && !syncing && !scopeMismatch;
  const canRetry = outcome.kind === 'offline' || outcome.kind === 'error';
  const view = describeSyncState({ status, syncing, outcome });
  const chipColor = view.tone === 'medium' ? 'medium' : view.tone;

  const sync = async () => {
    if (!canRun) return;
    setSyncing(true);
    setResult(null);
    setStatusError(null);
    setAuthError(null);
    try {
      let access = token;
      let allowPush = true;
      if (pilot) {
        access = await ensureAccessToken();
        allowPush = auth.role === 'admin';
      }
      const summary = await getWorkSyncRepository().run(access, { allowPush });
      setResult(summary);
      setOutcome({ kind: 'done' });
    } catch (error) {
      if (
        pilot &&
        error instanceof Error &&
        /AUTH_|SESION|sesión|CREDENCIALES|REFRESH|ROL_|OFFLINE/i.test(error.message)
      ) {
        setAuthError(
          error.message === 'OFFLINE'
            ? 'Sin conexión para renovar la sesión. El trabajo local sigue disponible.'
            : 'La sesión venció o ya no es válida. Inicia sesión de nuevo.',
        );
      }
      setOutcome({ kind: classifySyncError(error) });
    } finally {
      setSyncing(false);
      load();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/trabajo/galpones" text="Trabajo" />
          </IonButtons>
          <IonTitle>Sincronización · Trabajo</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <PageFrame>
          <PageIntro
            eyebrow="Base de trabajo"
            title="Sincronización"
            description="Envía y recibe cambios sin bloquear la consulta local."
          />

          <section aria-labelledby="sync-estado" className="sync-resumen">
            <div className="sync-encabezado">
              <h2 id="sync-estado">Estado de sincronización</h2>
              <IonChip color={chipColor} aria-hidden="true">
                {view.title}
              </IonChip>
            </div>
            <div role="status" aria-live="polite" aria-atomic="true" aria-busy={syncing}>
              <p>
                <strong>{view.title}.</strong> {view.detail}
              </p>
            </div>
            {loading && <p className="texto-ayuda">Leyendo el estado local…</p>}
            {statusError && <p role="alert">{statusError}</p>}
            {status && (
              <dl className="sync-cuentas" aria-label="Resumen de cambios locales">
                <div>
                  <dt>Pendientes de envío</dt>
                  <dd>{status.pending}</dd>
                </div>
                <div>
                  <dt>Conflictos</dt>
                  <dd>{status.conflicts}</dd>
                </div>
                <div>
                  <dt>Rechazados por el servidor</dt>
                  <dd>{status.rejected}</dd>
                </div>
              </dl>
            )}
          </section>

          <SectionCard title="Sincronizar ahora">
            <p className="texto-ayuda">
              La sincronización no bloquea la consulta local. Si falla, tus datos siguen disponibles y puedes
              reintentar.
            </p>
            {pilot ? (
              <>
                {auth.user ? (
                  <div>
                    <p>
                      Sesión: <strong>{auth.user.username}</strong> ·{' '}
                      {auth.role === 'admin' ? 'Administrador' : 'Consulta'} · instalación {auth.deviceId?.slice(0, 8)}
                    </p>
                    {auth.role === 'viewer' && (
                      <p className="texto-ayuda">
                        Esta cuenta solo consulta: puede descargar cambios, pero no escribir, resolver conflictos ni
                        enviar pendientes. La outbox se conserva.
                      </p>
                    )}
                    <IonButton fill="clear" size="small" routerLink="/trabajo/acceso">
                      Ver perfil / cambiar usuario
                    </IonButton>
                  </div>
                ) : (
                  <>
                    <p className="texto-ayuda">
                      Inicia sesión para sincronizar. Trabajo sigue disponible para consulta.
                    </p>
                    <IonButton fill="outline" routerLink="/trabajo/acceso">
                      Iniciar sesión
                    </IonButton>
                  </>
                )}
                {authError && (
                  <p role="alert">
                    {authError}{' '}
                    <IonButton fill="clear" size="small" routerLink="/trabajo/acceso">
                      Ir a acceso
                    </IonButton>
                  </p>
                )}
              </>
            ) : (
              <>
                <IonInput
                  label="Token de laboratorio"
                  labelPlacement="stacked"
                  fill="outline"
                  type="password"
                  autocomplete="off"
                  spellcheck={false}
                  value={token}
                  disabled={syncing}
                  onIonInput={(event) => {
                    setToken(event.detail.value ?? '');
                    if (scopeMismatch) setOutcome({ kind: 'none' });
                  }}
                />
                <p className="texto-ayuda">
                  Solo se mantiene en memoria mientras la app está abierta. No se guarda en la base ni en el
                  repositorio.
                </p>
              </>
            )}
            <IonButton expand="block" onClick={sync} disabled={!canRun} aria-busy={syncing}>
              {syncing ? (
                <>
                  <IonSpinner name="dots" /> Sincronizando…
                </>
              ) : canRetry ? (
                'Reintentar'
              ) : (
                'Sincronizar'
              )}
            </IonButton>
            {!pilot && !syncing && !token.trim() && (
              <p className="texto-ayuda">Ingresa el token de laboratorio para habilitar la sincronización.</p>
            )}
            {!pilot && token.trim() !== '' && !syncing && (
              <IonButton fill="clear" size="small" onClick={() => setToken('')}>
                Borrar token
              </IonButton>
            )}
            {result && (
              <p role="status">
                Se recibieron {result.appliedRemoteRecords} registro(s) y se enviaron {result.pushedResults} cambio(s).
              </p>
            )}
          </SectionCard>

          {status && status.conflicts > 0 && (
            <SectionCard title="Conflictos por revisar">
              <p>
                {status.conflicts === 1
                  ? 'Hay 1 conflicto pendiente.'
                  : `Hay ${status.conflicts} conflictos pendientes.`}{' '}
                Los cambios locales se conservan hasta que decidas.
              </p>
              <IonButton routerLink="/trabajo/conflictos" fill="outline">
                Revisar conflictos
              </IonButton>
            </SectionCard>
          )}

          <SectionCard title="Datos de trabajo">
            <IonList>
              <IonItem routerLink="/trabajo/galpones" detail={true}>
                <IonLabel>
                  <h3>Galpones de trabajo</h3>
                  <p>Consulta local disponible incluso sin conexión.</p>
                </IonLabel>
              </IonItem>
            </IonList>
          </SectionCard>
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default SincronizacionTrabajo;
