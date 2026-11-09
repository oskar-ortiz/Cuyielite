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
} from '@ionic/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getGalponesRepositoryFor } from '../data/galpones.repository.scope';
import { normalizeGalpon, validateGalpon } from '../data/galpones.validation';

interface CrearGalponProps {
  mode?: 'demo' | 'trabajo';
}

const CrearGalpon: React.FC<CrearGalponProps> = ({ mode = 'demo' }) => {
  const navigate = useNavigate();
  const basePath = mode === 'trabajo' ? '/trabajo/galpones' : '/galpones';
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
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
      <IonContent className="ion-padding">
        <IonInput
          label="Nombre"
          labelPlacement="stacked"
          value={nombre}
          onIonInput={(e) => setNombre(String(e.detail.value ?? ''))}
          maxlength={120}
        />
        <IonTextarea
          label="Ubicación (opcional)"
          labelPlacement="stacked"
          value={ubicacion}
          onIonInput={(e) => setUbicacion(String(e.detail.value ?? ''))}
          maxlength={255}
        />
        {errors.map((err, i) => (
          <p key={i} className="estado-vacio">
            {err}
          </p>
        ))}
        <IonButton expand="block" onClick={submit} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default CrearGalpon;
