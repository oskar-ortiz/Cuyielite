import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { FieldErrors, FormActions, InlineNotice, PageFrame, PageIntro, SectionCard } from '../components/AppUi';
import { getGalponesRepositoryFor } from '../data/galpones.repository.scope';
import { normalizePoza, validatePoza } from '../data/galpones.validation';

interface CrearPozaProps {
  mode?: 'demo' | 'trabajo';
}

const fieldHints = ['código', 'tipo', 'capacidad'];

const CrearPoza: React.FC<CrearPozaProps> = ({ mode = 'demo' }) => {
  const navigate = useNavigate();
  const basePath = mode === 'trabajo' ? '/trabajo/galpones' : '/galpones';
  const { id } = useParams<{ id: string }>();
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState('');
  const [capacidad, setCapacidad] = useState('0');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    if (!id) {
      setErrors(['Galpón no válido']);
      return;
    }
    const input = { codigo, tipo, capacidadMaxima: Number(capacidad) };
    const validation = validatePoza(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const normalized = normalizePoza(input);
      await getGalponesRepositoryFor(mode).createPoza({
        galponId: id,
        codigo: normalized.codigo,
        tipo: normalized.tipo,
        capacidadMaxima: normalized.capacidadMaxima,
      });
      navigate(`${basePath}/${id}`);
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
            <IonBackButton defaultHref={`${basePath}/${id}`} text="Cancelar" />
          </IonButtons>
          <IonTitle>{mode === 'trabajo' ? 'Nueva poza · Trabajo' : 'Nueva poza'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow={mode === 'trabajo' ? 'Base de trabajo' : 'Datos de demostración'}
            title="Nueva poza"
            description="Registra la poza y su capacidad. El galpón al que pertenece no se puede cambiar desde aquí."
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
                onIonInput={(e) => setCodigo(String(e.detail.value ?? ''))}
                maxlength={50}
                required
                autofocus
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('código'))} />
              <IonInput
                label="Tipo"
                labelPlacement="stacked"
                fill="outline"
                value={tipo}
                onIonInput={(e) => setTipo(String(e.detail.value ?? ''))}
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
                onIonInput={(e) => setCapacidad(String(e.detail.value ?? '0'))}
                disabled={saving}
              />
              <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('capacidad'))} />
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

export default CrearPoza;
