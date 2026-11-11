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
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getDomainRepository } from '../data/work.domain.factory';
import { validatePesaje, type Evento, type Parto, type PesajeInput } from '../data/work.domain.validation';
import './galpones.css';

const FormularioPesaje: React.FC = () => {
  const navigate = useNavigate();
  const { animalId = '', pesajeId } = useParams<{ animalId: string; pesajeId?: string }>();
  const editing = Boolean(pesajeId);
  const [input, setInput] = useState<PesajeInput>({
    cuyId: animalId,
    fechaPesaje: null,
    pesoGramos: '',
    etapa: null,
    partoId: null,
    eventoId: null,
  });
  const [partos, setPartos] = useState<Parto[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getDomainRepository())
      .then(async (repo) => {
        const [partosData, eventosData] = await Promise.all([
          repo.listPartosByCuyo(animalId),
          repo.listEventosByCuyo(animalId),
        ]);
        if (!active) return;
        setPartos(partosData);
        setEventos(eventosData);
        if (pesajeId) {
          const actual = await repo.getPesaje(pesajeId);
          if (active && actual) setInput(actual);
        }
      })
      .catch((e) => active && setErrors([e instanceof Error ? e.message : String(e)]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [animalId, pesajeId]);

  const change = (patch: Partial<PesajeInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    setNotice(null);
    const validation = validatePesaje(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const repo = await getDomainRepository();
      const result = pesajeId
        ? await repo.updatePesaje(pesajeId, validation.value)
        : await repo.createPesaje(validation.value);
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
          <IonTitle>{editing ? 'Editar pesaje' : 'Registrar pesaje'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && <p className="estado-vacio">Cargando…</p>}
        <IonInput
          label="Fecha de pesaje"
          labelPlacement="stacked"
          type="date"
          value={input.fechaPesaje ?? ''}
          onIonInput={(e) => change({ fechaPesaje: String(e.detail.value ?? '') || null })}
        />
        <IonInput
          label="Peso en gramos"
          labelPlacement="stacked"
          inputmode="decimal"
          value={input.pesoGramos}
          onIonInput={(e) => change({ pesoGramos: String(e.detail.value ?? '') })}
        />
        <IonInput
          label="Etapa"
          labelPlacement="stacked"
          value={input.etapa ?? ''}
          onIonInput={(e) => change({ etapa: String(e.detail.value ?? '') || null })}
          maxlength={20}
        />
        <IonSelect
          label="Parto (opcional)"
          labelPlacement="stacked"
          value={input.partoId ?? ''}
          onIonChange={(e) => change({ partoId: (e.detail.value || null) as string | null, eventoId: null })}
        >
          <IonSelectOption value="">Sin vínculo</IonSelectOption>
          {partos.map((parto) => (
            <IonSelectOption key={parto.id} value={parto.id}>
              {parto.fechaParto ?? parto.id}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonSelect
          label="Evento (opcional)"
          labelPlacement="stacked"
          value={input.eventoId ?? ''}
          onIonChange={(e) => change({ eventoId: (e.detail.value || null) as string | null, partoId: null })}
        >
          <IonSelectOption value="">Sin vínculo</IonSelectOption>
          {eventos.map((evento) => (
            <IonSelectOption key={evento.id} value={evento.id}>
              {evento.tipo} · {evento.fecha ?? 'sin fecha'}
            </IonSelectOption>
          ))}
        </IonSelect>
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

export default FormularioPesaje;
