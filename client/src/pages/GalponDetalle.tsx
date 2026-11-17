import {
  IonBackButton,
  IonButton,
  IonButtons,
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
import { addOutline, businessOutline, createOutline, locationOutline, pawOutline } from 'ionicons/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ModeChip, PageFrame, PageIntro, PageState, SectionCard, StatusChip } from '../components/AppUi';
import { snapshot } from '../data/auth.session';
import type { Galpon, Poza } from '../data/galpones.repository';
import { getGalponesRepository } from '../data/galpones.repository.factory';
import { getWorkGalponesReader } from '../data/work.galpones.repository';

interface GalponDetalleProps {
  mode?: 'demo' | 'trabajo';
}

const GalponDetalle: React.FC<GalponDetalleProps> = ({ mode = 'demo' }) => {
  const workMode = mode === 'trabajo';
  const basePath = workMode ? '/trabajo/galpones' : '/galpones';
  const { id } = useParams<{ id: string }>();
  const [galpon, setGalpon] = useState<Galpon | null>(null);
  const [pozas, setPozas] = useState<Poza[]>([]);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [notFound, setNotFound] = useState<boolean>(!id);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(() => snapshot().canWrite);

  const requestIdRef = useRef(0);
  const load = useCallback(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const currentId = id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setGalpon(null);
    setPozas([]);
    Promise.resolve()
      .then(() => (workMode ? getWorkGalponesReader() : getGalponesRepository()))
      .then((repo) => Promise.all([repo.listGalpones(), repo.listPozasByGalpon(currentId)]))
      .then(([galpones, pozasData]) => {
        if (requestId !== requestIdRef.current) return;
        const found = galpones.find((g) => g.id === currentId) ?? null;
        if (!found) {
          setNotFound(true);
        } else {
          setGalpon(found);
          setPozas(pozasData);
        }
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        setNotFound(false);
        setError(String(e));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [id, workMode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      requestIdRef.current = -1;
    };
  }, [load]);

  useIonViewWillEnter(() => {
    setCanWrite(snapshot().canWrite);
    load();
  });

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={basePath} text="Galpones" />
            </IonButtons>
            <IonTitle>Cargando…</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-content">
          <PageFrame>
            <PageState kind="loading" title="Cargando galpón…" />
          </PageFrame>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={basePath} text="Galpones" />
            </IonButtons>
            <IonTitle>Error</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-content">
          <PageFrame>
            <PageState kind="error" title="Error al cargar el galpón">
              <p>{error}</p>
            </PageState>
          </PageFrame>
        </IonContent>
      </IonPage>
    );
  }

  if (notFound || !galpon) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={basePath} text="Galpones" />
            </IonButtons>
            <IonTitle>Galpón no encontrado</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-content">
          <PageFrame>
            <PageState kind="empty" title="No existe un galpón con ese identificador." />
          </PageFrame>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={basePath} text="Galpones" />
          </IonButtons>
          <IonTitle>{galpon.nombre}</IonTitle>
          <IonButtons slot="end">
            {(!workMode || canWrite) && (
              <>
                <IonButton routerLink={`${basePath}/${id}/editar`}>
                  <IonIcon slot="start" icon={createOutline} aria-hidden="true" />
                  Editar galpón
                </IonButton>
                <IonButton routerLink={`${basePath}/${id}/pozas/nueva`}>
                  <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
                  Nueva poza
                </IonButton>
              </>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame>
          <PageIntro
            eyebrow={workMode ? 'Operación local' : 'Datos de demostración'}
            title={galpon.nombre}
            description={galpon.ubicacion ?? 'Ubicación sin registrar'}
            actions={
              <StatusChip tone="medium">
                <IonIcon icon={locationOutline} aria-hidden="true" /> {pozas.length} poza{pozas.length === 1 ? '' : 's'}
              </StatusChip>
            }
          />

          <div className="context-bar">
            <div className="context-status">
              <ModeChip work={workMode} readOnly={workMode && !canWrite} />
            </div>
          </div>

          {pozas.length === 0 ? (
            <PageState
              kind="empty"
              title="Este galpón todavía no tiene pozas registradas."
              action={
                (!workMode || canWrite) && (
                  <IonButton routerLink={`${basePath}/${id}/pozas/nueva`} fill="outline">
                    <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
                    Registrar la primera
                  </IonButton>
                )
              }
            />
          ) : (
            <SectionCard className="section-card--flush" title="Pozas del galpón" ariaLabel="Pozas del galpón">
              <IonList className="app-list">
                {pozas.map((poza) => (
                  <IonItem key={poza.id}>
                    <div className="app-list__title">
                      <IonIcon className="app-list__icon" icon={businessOutline} aria-hidden="true" />
                      <IonLabel className="ion-text-wrap">
                        <h2>{poza.codigo}</h2>
                        <p>
                          {poza.tipo} · capacidad {poza.capacidadMaxima}
                        </p>
                      </IonLabel>
                    </div>
                    <div slot="end" className="record-actions">
                      {(!workMode || canWrite) && (
                        <IonButton fill="clear" size="small" routerLink={`${basePath}/${id}/pozas/${poza.id}/editar`}>
                          <IonIcon slot="start" icon={createOutline} aria-hidden="true" />
                          Editar
                        </IonButton>
                      )}
                      {workMode && (
                        <IonButton
                          fill="outline"
                          size="small"
                          routerLink={`${basePath}/${id}/pozas/${poza.id}/animales`}
                        >
                          <IonIcon slot="start" icon={pawOutline} aria-hidden="true" />
                          Animales
                        </IonButton>
                      )}
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

export default GalponDetalle;
