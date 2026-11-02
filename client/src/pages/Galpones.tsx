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

import { galponesDemo } from '../data/galpones.demo';
import './galpones.css';

const Galpones: React.FC = () => {
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
        {galponesDemo.length === 0 ? (
          <p className="estado-vacio">No hay galpones registrados.</p>
        ) : (
          <IonList>
            {galponesDemo.map((galpon) => (
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
