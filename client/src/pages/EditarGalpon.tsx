import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { Galpon } from '../data/galpones.repository';
import { getGalponesRepositoryFor } from '../data/galpones.repository.scope';
import { normalizeGalpon, validateGalpon } from '../data/galpones.validation';

interface EditarGalponProps {
  mode?: 'demo' | 'trabajo';
}

const EditarGalpon: React.FC<EditarGalponProps> = ({ mode = 'demo' }) => {
  const navigate = useNavigate();
  const basePath = mode === 'trabajo' ? '/trabajo/galpones' : '/galpones';
  const { id } = useParams<{ id: string }>();
  const [galpon, setGalpon] = useState<Galpon | null>(null);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [loading, setLoading] = useState<boolean>(!!id);
  const [notFound, setNotFound] = useState<boolean>(!id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirtyRef = useRef(false);
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
    setLoadError(null);
    setSaveError(null);
    setNotFound(false);
    setGalpon(null);
    const repo = getGalponesRepositoryFor(mode);
    repo
      .listGalpones()
      .then((galpones) => {
        if (requestId !== requestIdRef.current) return;
        const found = galpones.find((g) => g.id === currentId) ?? null;
        if (!found) {
          setNotFound(true);
        } else {
          setGalpon(found);
          if (!dirtyRef.current) {
            setNombre(found.nombre);
            setUbicacion(found.ubicacion ?? '');
          }
        }
      })
      .catch((e) => {
        if (requestId !== requestIdRef.current) return;
        setNotFound(false);
        setLoadError(String(e));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [id, mode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      requestIdRef.current = -1;
    };
  }, [load]);

  useIonViewWillEnter(() => {
    dirtyRef.current = false;
    load();
  });

  const submit = async () => {
    if (!id || !galpon) return;
    const input = { nombre, ubicacion: ubicacion.trim() === '' ? null : ubicacion };
    const validation = validateGalpon(input);
    if (!validation.ok) {
      setSaveError(validation.errors.join('; '));
      return;
    }
    const normalized = normalizeGalpon(input);
    if (normalized.nombre === galpon.nombre && normalized.ubicacion === galpon.ubicacion) {
      navigate(`${basePath}/${id}`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await getGalponesRepositoryFor(mode).updateGalpon(id, normalized);
      navigate(`${basePath}/${id}`);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Cargando…</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <p className="estado-vacio">Cargando galpón…</p>
        </IonContent>
      </IonPage>
    );
  }

  if (loadError) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={`${basePath}/${id}`} text="Volver" />
            </IonButtons>
            <IonTitle>Error</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <p className="estado-vacio">Error al cargar el galpón: {loadError}</p>
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
        <IonContent fullscreen>
          <p className="estado-vacio">No existe un galpón con ese identificador.</p>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`${basePath}/${id}`} text="Cancelar" />
          </IonButtons>
          <IonTitle>{mode === 'trabajo' ? 'Editar galpón · Trabajo' : 'Editar galpón'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonInput
          label="Nombre"
          labelPlacement="stacked"
          value={nombre}
          onIonInput={(e) => {
            dirtyRef.current = true;
            setNombre(String(e.detail.value ?? ''));
          }}
          maxlength={120}
        />
        <IonTextarea
          label="Ubicación (opcional)"
          labelPlacement="stacked"
          value={ubicacion}
          onIonInput={(e) => {
            dirtyRef.current = true;
            setUbicacion(String(e.detail.value ?? ''));
          }}
          maxlength={255}
        />
        {saveError && <p className="estado-vacio">{saveError}</p>}
        <IonButton expand="block" onClick={submit} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default EditarGalpon;
