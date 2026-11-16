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
} from '@ionic/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FieldErrors, FormActions, InlineNotice, PageFrame, PageIntro, SectionCard } from '../components/AppUi';
import { getGalponesRepositoryFor } from '../data/galpones.repository.scope';
import { normalizeGalpon, validateGalpon } from '../data/galpones.validation';

interface CrearGalponProps {
  mode?: 'demo' | 'trabajo';
}

const fieldHints = ['nombre', 'ubicación'];

const CrearGalpon: React.FC<CrearGalponProps> = ({ mode = 'demo' }) => {
  const navigate = useNavigate();
  const basePath = mode === 'trabajo' ? '/trabajo/galpones' : '/galpones';
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    const input = { nombre, ubicacion: ubicacion.trim() === '' ? null : ubicacion };
    const validation = validateGalpon(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const normalized = normalizeGalpon(input);
      await getGalponesRepositoryFor(mode).createGalpon(normalized);
      navigate(basePath);
    } catch (e) {
      setErrors([String(e)]);
      setNotice(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={basePath} text="Cancelar" />
          </IonButtons>
          <IonTitle>{mode === 'trabajo' ? 'Nuevo galpón · Trabajo' : 'Nuevo galpón'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow={mode === 'trabajo' ? 'Base de trabajo' : 'Datos de demostración'}
            title="Nuevo galpón"
            description="Registra el galpón y su ubicación. Los datos vacíos permanecen sin registrar."
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
                onIonInput={(e) => setNombre(String(e.detail.value ?? ''))}
                maxlength={120}
                required
                autofocus
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('nombre'))} />
              <IonTextarea
                label="Ubicación (opcional)"
                labelPlacement="stacked"
                fill="outline"
                value={ubicacion}
                onIonInput={(e) => setUbicacion(String(e.detail.value ?? ''))}
                maxlength={255}
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('ubicación'))} />
            </SectionCard>
            <FieldErrors
              errors={errors.filter((error) => !fieldHints.some((hint) => error.toLocaleLowerCase().includes(hint)))}
            />
            {notice && <InlineNotice role="status">{notice}</InlineNotice>}
            <FormActions saving={saving} />
          </form>
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default CrearGalpon;
