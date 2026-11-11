import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getDomainRepository } from '../data/work.domain.factory';
import type { Cuyo } from '../data/work.domain.validation';
import { getWorkSyncRepository } from '../data/work.sync.repository';
import './galpones.css';

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
  useIonViewWillEnter(() => load());
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
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`${base}/${galponId}`} text="Galpón" />
          </IonButtons>
          <IonTitle>Animales</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/trabajo/asistente">Asistente</IonButton>
            <IonButton routerLink={`${base}/${galponId}/pozas/${pozaId}/animales/nuevo`}>Nuevo animal</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="marcado-demo">
          <IonChip color="primary">Base de trabajo</IonChip>
          {!online && <IonChip color="warning">Sin conexión</IonChip>}
          {pending > 0 && (
            <IonChip color="warning">{pending === 1 ? '1 cambio pendiente' : `${pending} cambios pendientes`}</IonChip>
          )}
          {conflicts > 0 && (
            <IonButton fill="clear" size="small" routerLink="/trabajo/conflictos">
              <IonChip color="danger">{conflicts === 1 ? '1 conflicto' : `${conflicts} conflictos`}</IonChip>
            </IonButton>
          )}
        </div>
        {loading && <p className="estado-vacio">Cargando animales…</p>}
        {!loading && error && <p className="estado-vacio">Error al cargar animales: {error}</p>}
        {!loading && !error && cuyes.length === 0 && (
          <p className="estado-vacio">
            Esta poza todavía no tiene animales.{' '}
            <IonButton routerLink={`${base}/${galponId}/pozas/${pozaId}/animales/nuevo`} fill="clear" size="small">
              Registrar el primero
            </IonButton>
          </p>
        )}
        {!loading && !error && cuyes.length > 0 && (
          <IonList>
            {cuyes.map((cuyo) => (
              <IonItem key={cuyo.id} routerLink={`/trabajo/animales/${cuyo.id}`}>
                <IonLabel>
                  <h2>{cuyo.codigoIdentificacion}</h2>
                  <p>
                    {cuyo.sexo === 'M' ? 'Macho' : cuyo.sexo === 'H' ? 'Hembra' : 'Sexo sin registrar'} ·{' '}
                    {cuyo.estado ?? 'Estado sin registrar'}
                  </p>
                </IonLabel>
                {cuyo.ultimoPesoG && <IonLabel slot="end">{cuyo.ultimoPesoG} g</IonLabel>}
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Animales;
