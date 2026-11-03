import {
  IonButton,
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
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Galpon } from '../data/galpones.repository';
import { getGalponesRepository } from '../data/galpones.repository.factory';
import './galpones.css';

const Galpones: React.FC = () => {
  const [galpones, setGalpones] = useState<Galpon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    getGalponesRepository()
      .listGalpones()
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setGalpones(data);
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      requestIdRef.current = -1;
    };
  }, [load]);

  useIonViewWillEnter(() => {
    load();
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Galpones</IonTitle>
          <IonButton slot="end" routerLink="/galpones/nuevo">
            Nuevo
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="marcado-demo">
          <IonChip color="warning">Datos de demostración</IonChip>
        </div>
        {loading ? (
          <p className="estado-vacio">Cargando galpones…</p>
        ) : error ? (
          <p className="estado-vacio">Error al cargar galpones: {error}</p>
        ) : galpones.length === 0 ? (
          <p className="estado-vacio">No hay galpones registrados.</p>
        ) : (
          <IonList>
            {galpones.map((galpon) => (
              <IonItem key={galpon.id} routerLink={`/galpones/${galpon.id}`} detail={true}>
                <IonLabel>
                  <h2>{galpon.nombre}</h2>
                  <p>{galpon.ubicacion ?? 'Sin ubicación registrada'}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Galpones;
