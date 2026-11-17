import {
  IonBackButton,
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

import { FieldErrors, FormActions, PageFrame, PageIntro, PageState, SectionCard } from '../components/AppUi';
import type { Galpon } from '../data/galpones.repository';
import { getGalponesRepositoryFor } from '../data/galpones.repository.scope';
import { normalizeGalpon, validateGalpon } from '../data/galpones.validation';

interface EditarGalponProps {
  mode?: 'demo' | 'trabajo';
}

const fieldHints = ['nombre', 'ubicación'];

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
  const [errors, setErrors] = useState<string[]>([]);
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
    setErrors([]);
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
      setErrors(validation.errors);
      return;
    }
    const normalized = normalizeGalpon(input);
    if (normalized.nombre === galpon.nombre && normalized.ubicacion === galpon.ubicacion) {
      navigate(`${basePath}/${id}`);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await getGalponesRepositoryFor(mode).updateGalpon(id, normalized);
      navigate(`${basePath}/${id}`);
    } catch (e) {
      setErrors([String(e)]);
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
        <IonContent fullscreen className="app-content">
          <PageFrame narrow>
            <PageState kind="loading" title="Cargando galpón…" />
          </PageFrame>
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
        <IonContent fullscreen className="app-content">
          <PageFrame narrow>
            <PageState kind="error" title="Error al cargar el galpón">
              <p>{loadError}</p>
            </PageState>
          </PageFrame>
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
        <IonContent fullscreen className="app-content">
          <PageFrame narrow>
            <PageState kind="empty" title="No existe un galpón con ese identificador." />
          </PageFrame>
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
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow={mode === 'trabajo' ? 'Base de trabajo' : 'Datos de demostración'}
            title="Editar galpón"
            description="Actualiza los datos del galpón. Si no hay cambios efectivos, no se modifica la fecha."
          />
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <SectionCard title="Datos del galpón">
              <IonInput
                label="Nombre"
                labelPlacement="stacked"
                fill="outline"
                value={nombre}
                onIonInput={(e) => {
                  dirtyRef.current = true;
                  setNombre(String(e.detail.value ?? ''));
                }}
                maxlength={120}
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('nombre'))} />
              <IonTextarea
                label="Ubicación (opcional)"
                labelPlacement="stacked"
                fill="outline"
                value={ubicacion}
                onIonInput={(e) => {
                  dirtyRef.current = true;
                  setUbicacion(String(e.detail.value ?? ''));
                }}
                maxlength={255}
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('ubicación'))} />
            </SectionCard>
            <FieldErrors
              errors={errors.filter((error) => !fieldHints.some((hint) => error.toLocaleLowerCase().includes(hint)))}
            />
            <FormActions saving={saving} />
          </form>
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default EditarGalpon;
