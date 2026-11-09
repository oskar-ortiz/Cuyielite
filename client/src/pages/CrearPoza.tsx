import {
  IonBackButton,
  IonButton,
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

import { getGalponesRepositoryFor } from '../data/galpones.repository.scope';
import { normalizePoza, validatePoza } from '../data/galpones.validation';

interface CrearPozaProps {
  mode?: 'demo' | 'trabajo';
}

const CrearPoza: React.FC<CrearPozaProps> = ({ mode = 'demo' }) => {
  const navigate = useNavigate();
  const basePath = mode === 'trabajo' ? '/trabajo/galpones' : '/galpones';
  const { id } = useParams<{ id: string }>();
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState('');
  const [capacidad, setCapacidad] = useState('0');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
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
      <IonContent className="ion-padding">
        <IonInput
          label="Código"
          labelPlacement="stacked"
          value={codigo}
          onIonInput={(e) => setCodigo(String(e.detail.value ?? ''))}
          maxlength={50}
        />
        <IonInput
          label="Tipo"
          labelPlacement="stacked"
          value={tipo}
          onIonInput={(e) => setTipo(String(e.detail.value ?? ''))}
          maxlength={50}
        />
        <p className="estado-vacio">Sugerencias: cría, engorde, reproducción</p>
        <IonInput
          label="Capacidad máxima"
          labelPlacement="stacked"
          type="number"
          value={capacidad}
          onIonInput={(e) => setCapacidad(String(e.detail.value ?? '0'))}
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

export default CrearPoza;
