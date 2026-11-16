import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  addOutline,
  businessOutline,
  chatboxEllipsesOutline,
  locationOutline,
  personCircleOutline,
  swapHorizontalOutline,
  syncOutline,
  warningOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ModeChip, PageFrame, PageIntro, PageState, PendingChip, SectionCard } from '../components/AppUi';
import { snapshot } from '../data/auth.session';
import type { Galpon } from '../data/galpones.repository';
import { getGalponesRepository } from '../data/galpones.repository.factory';
import { getWorkGalponesReader } from '../data/work.galpones.repository';
import { getWorkSyncRepository } from '../data/work.sync.repository';

interface GalponesProps {
  mode?: 'demo' | 'trabajo';
}

const Galpones: React.FC<GalponesProps> = ({ mode = 'demo' }) => {
  const workMode = mode === 'trabajo';
  const basePath = workMode ? '/trabajo/galpones' : '/galpones';
  const newPath = workMode ? '/trabajo/galpones/nuevo' : '/galpones/nuevo';
  const [galpones, setGalpones] = useState<Galpon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [canWrite, setCanWrite] = useState(() => snapshot().canWrite);

  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const load = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => (workMode ? getWorkGalponesReader() : getGalponesRepository()))
      .then((repo) => repo.listGalpones())
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setGalpones(data);
        if (workMode) {
          getWorkSyncRepository()
            .status()
            .then((status) => {
              if (requestId === requestIdRef.current) setPending(status.pending);
            })
            .catch(() => {
              if (requestId === requestIdRef.current) setPending(null);
            });
        }
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        setError(String(e));
      })
      .finally(() => {
        inFlightRef.current = false;
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [workMode]);

  useEffect(() => {
    load();
    return () => {
      requestIdRef.current = -1;
    };
  }, [workMode, load]);

  useIonViewWillEnter(() => {
    setCanWrite(snapshot().canWrite);
    load();
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{workMode ? 'Galpones · Trabajo' : 'Galpones'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame>
          <PageIntro
            eyebrow={workMode ? 'Operación local' : 'Exploración guiada'}
            title="Galpones"
            description={
              workMode
                ? 'Consulta la producción disponible en este dispositivo, incluso sin conexión.'
                : 'Recorre los galpones de prueba y sus pozas.'
            }
            actions={
              (!workMode || canWrite) && (
                <IonButton routerLink={newPath}>
                  <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
                  Nuevo
                </IonButton>
              )
            }
          />

          <div className="context-bar">
            <div className="context-status">
              <ModeChip work={workMode} readOnly={workMode && !canWrite} />
              {workMode && pending !== null && <PendingChip count={pending} />}
            </div>
            <nav className="context-actions" aria-label={workMode ? 'Herramientas de trabajo' : 'Navegación de modos'}>
              <IonButton fill="clear" routerLink="/">
                <IonIcon slot="start" icon={swapHorizontalOutline} aria-hidden="true" />
                Cambiar modo
              </IonButton>
              {workMode && (
                <>
                  <IonButton fill="clear" routerLink="/trabajo/sincronizacion">
                    <IonIcon slot="start" icon={syncOutline} aria-hidden="true" />
                    Sincronización
                  </IonButton>
                  <IonButton fill="clear" routerLink="/trabajo/conflictos">
                    <IonIcon slot="start" icon={warningOutline} aria-hidden="true" />
                    Revisar conflictos
                  </IonButton>
                  <IonButton fill="clear" routerLink="/trabajo/asistente">
                    <IonIcon slot="start" icon={chatboxEllipsesOutline} aria-hidden="true" />
                    Asistente
                  </IonButton>
                  <IonButton fill="clear" routerLink="/trabajo/acceso">
                    <IonIcon slot="start" icon={personCircleOutline} aria-hidden="true" />
                    Acceso
                  </IonButton>
                </>
              )}
            </nav>
          </div>

          {loading ? (
            <PageState kind="loading" title="Cargando galpones…" />
          ) : error ? (
            <PageState kind="error" title="Error al cargar galpones">
              <p>{error}</p>
            </PageState>
          ) : galpones.length === 0 ? (
            <PageState
              kind="empty"
              title={workMode ? 'La base de trabajo todavía no tiene galpones.' : 'No hay galpones registrados.'}
              action={
                (!workMode || canWrite) && (
                  <IonButton routerLink={newPath} fill="outline">
                    <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
                    Registrar el primero
                  </IonButton>
                )
              }
            />
          ) : (
            <SectionCard className="section-card--flush" ariaLabel="Listado de galpones">
              <IonList className="app-list">
                {galpones.map((galpon) => (
                  <IonItem key={galpon.id} routerLink={`${basePath}/${galpon.id}`} detail={true}>
                    <div className="app-list__title">
                      <IonIcon className="app-list__icon" icon={businessOutline} aria-hidden="true" />
                      <IonLabel>
                        <h2>{galpon.nombre}</h2>
                        <p>
                          <IonIcon icon={locationOutline} aria-hidden="true" />{' '}
                          {galpon.ubicacion ?? 'Sin ubicación registrada'}
                        </p>
                      </IonLabel>
                    </div>
                  </IonItem>
                ))}
              </IonList>
            </SectionCard>
          )}
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default Galpones;
