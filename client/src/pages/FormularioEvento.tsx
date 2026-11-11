import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getDomainRepository } from '../data/work.domain.factory';
import type { PozaRef } from '../data/work.domain.repository';
import { validateEvento, type Cuyo, type EventoInput } from '../data/work.domain.validation';
import './galpones.css';

const FormularioEvento: React.FC = () => {
  const navigate = useNavigate();
  const { animalId = '', eventoId } = useParams<{ animalId: string; eventoId?: string }>();
  const editing = Boolean(eventoId);
  const [input, setInput] = useState<EventoInput>({
    cuyId: animalId,
    tipo: '',
    fecha: null,
    machoId: null,
    pozaOrigenId: null,
    pozaDestinoId: null,
    detalle: null,
  });
  const [cuyes, setCuyes] = useState<Cuyo[]>([]);
  const [pozas, setPozas] = useState<PozaRef[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getDomainRepository())
      .then(async (repo) => {
        const [cuyesData, pozasData] = await Promise.all([repo.listAllCuyes(), repo.listPozas()]);
        if (!active) return;
        setCuyes(cuyesData.filter((cuyo) => cuyo.id !== animalId));
        setPozas(pozasData);
        if (eventoId) {
          const actual = await repo.getEvento(eventoId);
          if (active && actual) setInput(actual);
        }
      })
      .catch((e) => active && setErrors([e instanceof Error ? e.message : String(e)]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [animalId, eventoId]);

  const change = (patch: Partial<EventoInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    setNotice(null);
    const validation = validateEvento(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const repo = await getDomainRepository();
      const result = eventoId
        ? await repo.updateEvento(eventoId, validation.value)
        : await repo.createEvento(validation.value);
      if (!result.changed) {
        setNotice('Sin cambios para guardar.');
        return;
      }
      navigate(`/trabajo/animales/${animalId}`);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/trabajo/animales/${animalId}`} text="Cancelar" />
          </IonButtons>
          <IonTitle>{editing ? 'Editar evento' : 'Registrar evento'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && <p className="estado-vacio">Cargando…</p>}
        <IonInput
          label="Tipo de evento"
          labelPlacement="stacked"
          value={input.tipo}
          onIonInput={(e) => change({ tipo: String(e.detail.value ?? '') })}
          maxlength={30}
        />
        <IonInput
          label="Fecha"
          labelPlacement="stacked"
          type="date"
          value={input.fecha ?? ''}
          onIonInput={(e) => change({ fecha: String(e.detail.value ?? '') || null })}
        />
        <IonSelect
          label="Macho (opcional)"
          labelPlacement="stacked"
          value={input.machoId ?? ''}
          onIonChange={(e) => change({ machoId: (e.detail.value || null) as string | null })}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          {cuyes.map((cuyo) => (
            <IonSelectOption key={cuyo.id} value={cuyo.id}>
              {cuyo.codigoIdentificacion}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonSelect
          label="Poza de origen (opcional)"
          labelPlacement="stacked"
          value={input.pozaOrigenId ?? ''}
          onIonChange={(e) => change({ pozaOrigenId: (e.detail.value || null) as string | null })}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          {pozas.map((poza) => (
            <IonSelectOption key={poza.id} value={poza.id}>
              {poza.codigo}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonSelect
          label="Poza de destino (opcional)"
          labelPlacement="stacked"
          value={input.pozaDestinoId ?? ''}
          onIonChange={(e) => change({ pozaDestinoId: (e.detail.value || null) as string | null })}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          {pozas.map((poza) => (
            <IonSelectOption key={poza.id} value={poza.id}>
              {poza.codigo}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonTextarea
          label="Detalle (opcional)"
          labelPlacement="stacked"
          value={input.detalle ?? ''}
          onIonInput={(e) => change({ detalle: String(e.detail.value ?? '') || null })}
          maxlength={255}
        />
        {errors.map((err, index) => (
          <p key={index} className="estado-vacio">
            {err}
          </p>
        ))}
        {notice && <p className="estado-vacio">{notice}</p>}
        <IonButton expand="block" onClick={submit} disabled={saving || loading}>
          {saving ? 'Guardando…' : 'Guardar'}
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default FormularioEvento;
