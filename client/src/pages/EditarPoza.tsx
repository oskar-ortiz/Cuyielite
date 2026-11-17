import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { FieldErrors, FormActions, PageFrame, PageIntro, PageState, SectionCard } from '../components/AppUi';
import type { Poza } from '../data/galpones.repository';
import { getGalponesRepositoryFor } from '../data/galpones.repository.scope';
import { normalizePoza, validatePoza } from '../data/galpones.validation';

interface EditarPozaProps {
  mode?: 'demo' | 'trabajo';
}

const fieldHints = ['código', 'tipo', 'capacidad'];

const EditarPoza: React.FC<EditarPozaProps> = ({ mode = 'demo' }) => {
  const navigate = useNavigate();
  const basePath = mode === 'trabajo' ? '/trabajo/galpones' : '/galpones';
  const { id, pozaId } = useParams<{ id: string; pozaId: string }>();
  const [poza, setPoza] = useState<Poza | null>(null);
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState('');
  const [capacidad, setCapacidad] = useState('0');
  const [loading, setLoading] = useState<boolean>(!!id && !!pozaId);
  const [notFound, setNotFound] = useState<boolean>(!id || !pozaId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const dirtyRef = useRef(false);
  const requestIdRef = useRef(0);
  const load = useCallback(() => {
    if (!id || !pozaId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const currentId = id;
    const currentPozaId = pozaId;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    setErrors([]);
    setNotFound(false);
    setPoza(null);
    const repo = getGalponesRepositoryFor(mode);
    repo
      .listPozasByGalpon(currentId)
      .then((pozas) => {
        if (requestId !== requestIdRef.current) return;
        const found = pozas.find((p) => p.id === currentPozaId) ?? null;
        if (!found) {
          setNotFound(true);
        } else {
          setPoza(found);
          if (!dirtyRef.current) {
            setCodigo(found.codigo);
            setTipo(found.tipo);
            setCapacidad(String(found.capacidadMaxima));
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
  }, [id, pozaId, mode]);

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
    if (!id || !pozaId || !poza) return;
    const input = { codigo, tipo, capacidadMaxima: Number(capacidad) };
    const validation = validatePoza(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    const normalized = normalizePoza(input);
    if (
      normalized.codigo === poza.codigo &&
      normalized.tipo === poza.tipo &&
      normalized.capacidadMaxima === poza.capacidadMaxima
    ) {
      navigate(`${basePath}/${id}`);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await getGalponesRepositoryFor(mode).updatePoza(id, pozaId, normalized);
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
            <PageState kind="loading" title="Cargando poza…" />
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
            <PageState kind="error" title="Error al cargar la poza">
              <p>{loadError}</p>
            </PageState>
          </PageFrame>
        </IonContent>
      </IonPage>
    );
  }

  if (notFound || !poza) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={`${basePath}/${id}`} text="Galpón" />
            </IonButtons>
            <IonTitle>Poza no encontrada</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="app-content">
          <PageFrame narrow>
            <PageState kind="empty" title="No existe una poza con ese identificador." />
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
          <IonTitle>{mode === 'trabajo' ? 'Editar poza · Trabajo' : 'Editar poza'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow={mode === 'trabajo' ? 'Base de trabajo' : 'Datos de demostración'}
            title="Editar poza"
            description="Actualiza los datos permitidos. El galpón al que pertenece no cambia."
          />
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <SectionCard title="Datos de la poza">
              <IonInput
                label="Código"
                labelPlacement="stacked"
                fill="outline"
                value={codigo}
                onIonInput={(e) => {
                  dirtyRef.current = true;
                  setCodigo(String(e.detail.value ?? ''));
                }}
                maxlength={50}
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('código'))} />
              <IonInput
                label="Tipo"
                labelPlacement="stacked"
                fill="outline"
                value={tipo}
                onIonInput={(e) => {
                  dirtyRef.current = true;
                  setTipo(String(e.detail.value ?? ''));
                }}
                maxlength={50}
                disabled={saving}
              />
              <p className="texto-ayuda">Sugerencias: cría, engorde, reproducción</p>
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('tipo'))} />
              <IonInput
                label="Capacidad máxima"
                labelPlacement="stacked"
                fill="outline"
                type="number"
                inputmode="numeric"
                value={capacidad}
                onIonInput={(e) => {
                  dirtyRef.current = true;
                  setCapacidad(String(e.detail.value ?? '0'));
                }}
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('capacidad'))} />
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

export default EditarPoza;
