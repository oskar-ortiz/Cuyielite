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
import { addOutline, alertCircleOutline, chatboxEllipsesOutline, pawOutline, personOutline } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  ConnectivityChip,
  ModeChip,
  PageFrame,
  PageIntro,
  PageState,
  PendingChip,
  SectionCard,
} from '../components/AppUi';
import { snapshot } from '../data/auth.session';
import { getDomainRepository } from '../data/work.domain.factory';
import type { Cuyo } from '../data/work.domain.validation';
import { getWorkSyncRepository } from '../data/work.sync.repository';

interface AnimalesProps {
  mode?: 'trabajo';
}

const Animales: React.FC<AnimalesProps> = () => {
  const { galponId = '', pozaId = '' } = useParams<{ galponId: string; pozaId: string }>();
  const [cuyes, setCuyes] = useState<Cuyo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [canWrite, setCanWrite] = useState(() => snapshot().canWrite);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => getDomainRepository())
      .then((repo) =>
        Promise.all([
          repo.listCuyesByPoza(pozaId),
          getWorkSyncRepository()
            .status()
            .catch(() => null),
        ]),
      )
      .then(([data, status]) => {
        setCuyes(data);
        setPending((status?.pending ?? 0) + (status?.prepared ?? 0));
        setConflicts(status?.conflicts ?? 0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [pozaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useIonViewWillEnter(() => {
    setCanWrite(snapshot().canWrite);
    load();
  });
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  const base = '/trabajo/galpones';
  const newAnimalPath = `${base}/${galponId}/pozas/${pozaId}/animales/nuevo`;
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`${base}/${galponId}`} text="Galpón" />
          </IonButtons>
          <IonTitle>Animales</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame>
          <PageIntro
            eyebrow="Inventario de la poza"
            title="Animales"
            description="Abre una ficha para consultar su genealogía, historial, evaluación y recomendaciones."
            actions={
              <>
                <IonButton fill="outline" routerLink="/trabajo/asistente">
                  <IonIcon slot="start" icon={chatboxEllipsesOutline} aria-hidden="true" />
                  Asistente
                </IonButton>
                {canWrite && (
                  <IonButton routerLink={newAnimalPath}>
                    <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
                    Nuevo animal
                  </IonButton>
                )}
              </>
            }
          />
          <div className="context-bar">
            <div className="context-status">
              <ModeChip work readOnly={!canWrite} />
              <ConnectivityChip online={online} />
              <PendingChip count={pending} />
            </div>
            {conflicts > 0 && (
              <IonButton color="danger" fill="outline" routerLink="/trabajo/conflictos">
                <IonIcon slot="start" icon={alertCircleOutline} aria-hidden="true" />
                {conflicts === 1 ? '1 conflicto' : `${conflicts} conflictos`}
              </IonButton>
            )}
          </div>

          {loading ? (
            <PageState kind="loading" title="Cargando animales…" />
          ) : error ? (
            <PageState kind="error" title="Error al cargar animales">
              <p>{error}</p>
            </PageState>
          ) : cuyes.length === 0 ? (
            <PageState
              kind="empty"
              title="Esta poza todavía no tiene animales."
              action={
                canWrite && (
                  <IonButton routerLink={newAnimalPath} fill="outline">
                    <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
                    Registrar el primero
                  </IonButton>
                )
              }
            />
          ) : (
            <SectionCard className="section-card--flush" ariaLabel="Listado de animales">
              <IonList className="app-list">
                {cuyes.map((cuyo) => (
                  <IonItem key={cuyo.id} routerLink={`/trabajo/animales/${cuyo.id}`} detail={true}>
                    <div className="app-list__title">
                      <IonIcon className="app-list__icon" icon={pawOutline} aria-hidden="true" />
                      <IonLabel>
                        <h2>{cuyo.codigoIdentificacion}</h2>
                        <p>
                          <IonIcon icon={personOutline} aria-hidden="true" />{' '}
                          {cuyo.sexo === 'M' ? 'Macho' : cuyo.sexo === 'H' ? 'Hembra' : 'Sexo sin registrar'} ·{' '}
                          {cuyo.estado ?? 'Estado sin registrar'}
                        </p>
                      </IonLabel>
                    </div>
                    <IonLabel slot="end" className="app-list__meta">
                      {cuyo.ultimoPesoG !== null ? `${cuyo.ultimoPesoG} g` : 'Peso sin dato'}
                    </IonLabel>
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

export default Animales;
