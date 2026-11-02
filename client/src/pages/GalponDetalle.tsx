import {
  IonBackButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRouterLink,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useParams } from 'react-router-dom';

import { galponesDemo, pozasDemo } from '../data/galpones.demo';
import './galpones.css';

const GalponDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const galpon = galponesDemo.find((g) => g.id === id);

  if (!galpon) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/galpones" text="Galpones" />
            </IonButtons>
            <IonTitle>Galpón no encontrado</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <p className="estado-vacio">
            No existe un galpón con ese identificador. <IonRouterLink href="/galpones">Volver al listado</IonRouterLink>
          </p>
        </IonContent>
      </IonPage>
    );
  }

  const pozas = pozasDemo.filter((poza) => poza.galponId === galpon.id);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/galpones" text="Galpones" />
          </IonButtons>
          <IonTitle>{galpon.nombre}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="marcado-demo">
          <IonChip color="warning">Datos de demostración</IonChip>
        </div>
        {pozas.length === 0 ? (
          <p className="estado-vacio">Este galpón todavía no tiene pozas registradas.</p>
        ) : (
          <IonList>
            {pozas.map((poza) => (
              <IonItem key={poza.id}>
                <IonLabel>
                  <h2>{poza.codigo}</h2>
                  <p>{poza.tipo}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default GalponDetalle;
