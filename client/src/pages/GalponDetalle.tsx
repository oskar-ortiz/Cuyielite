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
  IonRouterLink,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { Galpon, Poza } from '../data/galpones.repository';
import { getGalponesRepository } from '../data/galpones.repository.factory';
import './galpones.css';

const GalponDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [galpon, setGalpon] = useState<Galpon | null>(null);
  const [pozas, setPozas] = useState<Poza[]>([]);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [notFound, setNotFound] = useState<boolean>(!id);
  const [error, setError] = useState<string | null>(null);

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
    const repo = getGalponesRepository();
    Promise.all([repo.listGalpones(), repo.listPozasByGalpon(currentId)])
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
  }, [id]);

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
          <IonButtons slot="end">
            <IonButton routerLink={`/galpones/${id}/editar`}>Editar galpón</IonButton>
            <IonButton routerLink={`/galpones/${id}/pozas/nueva`}>Nueva poza</IonButton>
          </IonButtons>
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
                <IonButton slot="end" routerLink={`/galpones/${id}/pozas/${poza.id}/editar`}>
                  Editar
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default GalponDetalle;
