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
import { getWorkGalponesReader } from '../data/work.galpones.repository';
import './galpones.css';

interface GalponesProps {
  mode?: 'demo' | 'trabajo';
}

const Galpones: React.FC<GalponesProps> = ({ mode = 'demo' }) => {
  const workMode = mode === 'trabajo';
  const basePath = workMode ? '/trabajo/galpones' : '/galpones';
  const [galpones, setGalpones] = useState<Galpon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [load]);

  useIonViewWillEnter(() => {
    load();
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{workMode ? 'Galpones · Trabajo' : 'Galpones'}</IonTitle>
          {!workMode && (
            <IonButton slot="end" routerLink="/galpones/nuevo">
              Nuevo
            </IonButton>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="marcado-demo">
          <IonChip color={workMode ? 'primary' : 'warning'}>
            {workMode ? 'Base de trabajo · solo consulta' : 'Datos de demostración'}
          </IonChip>
          <IonButton size="small" fill="clear" routerLink="/">
            Cambiar modo
          </IonButton>
          {workMode && (
            <IonButton size="small" fill="clear" routerLink="/trabajo/conflictos">
              Revisar conflictos
            </IonButton>
          )}
        </div>
        {loading ? (
          <p className="estado-vacio">Cargando galpones…</p>
        ) : error ? (
          <p className="estado-vacio">Error al cargar galpones: {error}</p>
        ) : galpones.length === 0 ? (
          <p className="estado-vacio">
            {workMode ? 'La base de trabajo todavía no tiene galpones.' : 'No hay galpones registrados.'}
          </p>
        ) : (
          <IonList>
            {galpones.map((galpon) => (
              <IonItem key={galpon.id} routerLink={`${basePath}/${galpon.id}`} detail={true}>
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
