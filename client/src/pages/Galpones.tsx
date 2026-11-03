import {
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';

import type { Galpon } from '../data/galpones.repository';
import { getGalponesRepository } from '../data/galpones.repository.factory';
import './galpones.css';

const Galpones: React.FC = () => {
  const [galpones, setGalpones] = useState<Galpon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getGalponesRepository()
      .listGalpones()
      .then((data) => {
        if (active) setGalpones(data);
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Galpones</IonTitle>
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
