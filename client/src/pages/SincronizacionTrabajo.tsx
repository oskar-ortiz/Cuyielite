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

import { getWorkSyncRepository, type SyncRunSummary } from '../data/work.sync.repository';
import type { WorkSyncStatus } from '../data/work.sync.status';
import { classifySyncError, describeSyncState, type SyncOutcome } from '../data/work.sync.ui';
import './sincronizacion.css';

const SincronizacionTrabajo: React.FC = () => {
  const [status, setStatus] = useState<WorkSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome>({ kind: 'none' });
  const [token, setToken] = useState('');
  const [result, setResult] = useState<SyncRunSummary | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const load = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setStatusError(null);
    Promise.resolve()
      .then(() => getWorkSyncRepository().status())
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

  const canRun = token.trim().length > 0 && !syncing;
  const canRetry = outcome.kind === 'offline' || outcome.kind === 'error';
  const view = describeSyncState({ status, syncing, outcome });
  const chipColor = view.tone === 'medium' ? 'medium' : view.tone;

  const sync = async () => {
    if (!canRun) return;
    setSyncing(true);
    setResult(null);
    setStatusError(null);
    try {
      const summary = await getWorkSyncRepository().run(token);
      setResult(summary);
      setOutcome({ kind: 'done' });
    } catch (error) {
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
        <section aria-labelledby="sync-estado" className="sync-resumen">
          <div className="sync-encabezado">
            <h1 id="sync-estado">Estado de sincronización</h1>
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

        <section aria-labelledby="sync-acciones">
          <h2 id="sync-acciones">Sincronizar ahora</h2>
          <p className="texto-ayuda">
            La sincronización no bloquea la consulta local. Si falla, tus datos siguen disponibles y puedes reintentar.
          </p>
          <IonInput
            label="Token de laboratorio"
            labelPlacement="stacked"
            type="password"
            autocomplete="off"
            spellcheck={false}
            value={token}
            disabled={syncing}
            onIonInput={(event) => setToken(event.detail.value ?? '')}
          />
          <p className="texto-ayuda">
            Solo se mantiene en memoria mientras la app está abierta. No se guarda en la base ni en el repositorio.
          </p>
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
          {!syncing && !token.trim() && (
            <p className="texto-ayuda">Ingresa el token de laboratorio para habilitar la sincronización.</p>
          )}
          {token.trim() !== '' && !syncing && (
            <IonButton fill="clear" size="small" onClick={() => setToken('')}>
              Borrar token
            </IonButton>
          )}
          {result && (
            <p role="status">
              Se recibieron {result.appliedRemoteRecords} registro(s) y se enviaron {result.pushedResults} cambio(s).
            </p>
          )}
        </section>

        {status && status.conflicts > 0 && (
          <section aria-labelledby="sync-conflictos">
            <h2 id="sync-conflictos">Conflictos por revisar</h2>
            <p>
              {status.conflicts === 1 ? 'Hay 1 conflicto pendiente.' : `Hay ${status.conflicts} conflictos pendientes.`}{' '}
              Los cambios locales se conservan hasta que decidas.
            </p>
            <IonButton routerLink="/trabajo/conflictos" fill="outline">
              Revisar conflictos
            </IonButton>
          </section>
        )}

        <section aria-labelledby="sync-navegacion">
          <h2 id="sync-navegacion">Datos de trabajo</h2>
          <IonList>
            <IonItem routerLink="/trabajo/galpones" detail={true}>
              <IonLabel>
                <h3>Galpones de trabajo</h3>
                <p>Consulta local disponible incluso sin conexión.</p>
              </IonLabel>
            </IonItem>
          </IonList>
        </section>
      </IonContent>
    </IonPage>
  );
};

export default SincronizacionTrabajo;
