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
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { Galpon, Poza } from '../data/galpones.repository';
import { getElectronRepository } from '../data/galpones.repository.electron';
import './galpones.css';

const GalponDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [galpon, setGalpon] = useState<Galpon | null>(null);
  const [pozas, setPozas] = useState<Poza[]>([]);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [notFound, setNotFound] = useState<boolean>(!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const repo = getElectronRepository();
    Promise.all([repo.listGalpones(), repo.listPozasByGalpon(id)])
      .then(([galpones, pozasData]) => {
        if (!active) return;
        const found = galpones.find((g) => g.id === id) ?? null;
        if (!found) {
          setNotFound(true);
        } else {
          setGalpon(found);
          setPozas(pozasData);
        }
      })
      .catch((e) => {
        if (active) {
          setNotFound(false);
          setError(String(e));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/galpones" text="Galpones" />
            </IonButtons>
            <IonTitle>Cargando…</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <p className="estado-vacio">Cargando galpón…</p>
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
              <IonBackButton defaultHref="/galpones" text="Galpones" />
            </IonButtons>
            <IonTitle>Error</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <p className="estado-vacio">Error al cargar el galpón: {error}</p>
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
