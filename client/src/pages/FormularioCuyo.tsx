import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getDomainRepository } from '../data/work.domain.factory';
import type { PozaRef } from '../data/work.domain.repository';
import { validateCuyo, type Cuyo, type CuyoInput, type Sexo } from '../data/work.domain.validation';
import './galpones.css';

const empty: CuyoInput = {
  pozaId: '',
  galponOrigenId: null,
  codigoIdentificacion: '',
  sexo: null,
  fechaNacimiento: null,
  colorCodigo: null,
  ojosCodigo: null,
  pelajeOriginal: null,
  padreId: null,
  madreId: null,
  categoriaMl: null,
  ultimoPesoG: null,
  estado: null,
};

function fromCuyo(cuyo: Cuyo): CuyoInput {
  return {
    pozaId: cuyo.pozaId ?? '',
    galponOrigenId: cuyo.galponOrigenId,
    codigoIdentificacion: cuyo.codigoIdentificacion,
    sexo: cuyo.sexo,
    fechaNacimiento: cuyo.fechaNacimiento,
    colorCodigo: cuyo.colorCodigo,
    ojosCodigo: cuyo.ojosCodigo,
    pelajeOriginal: cuyo.pelajeOriginal,
    padreId: cuyo.padreId,
    madreId: cuyo.madreId,
    categoriaMl: cuyo.categoriaMl,
    ultimoPesoG: cuyo.ultimoPesoG,
    estado: cuyo.estado,
  };
}

const FormularioCuyo: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ galponId?: string; pozaId?: string; animalId?: string }>();
  const editing = Boolean(params.animalId);
  const [input, setInput] = useState<CuyoInput>({ ...empty, pozaId: params.pozaId ?? '' });
  const [pozas, setPozas] = useState<PozaRef[]>([]);
  const [cuyes, setCuyes] = useState<Cuyo[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getDomainRepository())
      .then(async (repo) => {
        const [pozasData, cuyesData, actual] = await Promise.all([
          repo.listPozas(),
          repo.listAllCuyes(),
          params.animalId ? repo.getCuyo(params.animalId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setPozas(pozasData);
        setCuyes(cuyesData.filter((item) => item.id !== params.animalId));
        if (actual) setInput(fromCuyo(actual));
      })
      .catch((e) => active && setErrors([e instanceof Error ? e.message : String(e)]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [params.animalId]);

  const change = (patch: Partial<CuyoInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    setNotice(null);
    const validation = validateCuyo(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const repo = await getDomainRepository();
      const result = params.animalId
        ? await repo.updateCuyo(params.animalId, validation.value)
        : await repo.createCuyo(validation.value);
      if (!result.changed) {
        setNotice('Sin cambios para guardar.');
        return;
      }
      if (params.animalId) navigate(`/trabajo/animales/${params.animalId}`);
      else navigate(`/trabajo/galpones/${params.galponId}/pozas/${validation.value.pozaId}/animales`);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setSaving(false);
    }
  };

  const back = params.animalId
    ? `/trabajo/animales/${params.animalId}`
    : `/trabajo/galpones/${params.galponId}/pozas/${params.pozaId}/animales`;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={back} text="Cancelar" />
          </IonButtons>
          <IonTitle>{editing ? 'Editar animal' : 'Nuevo animal'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && <p className="estado-vacio">Cargando…</p>}
        <IonInput
          label="Chapa"
          labelPlacement="stacked"
          value={input.codigoIdentificacion}
          onIonInput={(e) => change({ codigoIdentificacion: String(e.detail.value ?? '') })}
          maxlength={50}
        />
        <IonSelect
          label="Sexo"
          labelPlacement="stacked"
          value={input.sexo ?? ''}
          onIonChange={(e) => change({ sexo: (e.detail.value || null) as Sexo | null })}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          <IonSelectOption value="M">Macho</IonSelectOption>
          <IonSelectOption value="H">Hembra</IonSelectOption>
        </IonSelect>
        <IonInput
          label="Fecha de nacimiento"
          labelPlacement="stacked"
          type="date"
          value={input.fechaNacimiento ?? ''}
          onIonInput={(e) => change({ fechaNacimiento: String(e.detail.value ?? '') || null })}
        />
        <IonSelect
          label="Poza"
          labelPlacement="stacked"
          value={input.pozaId}
          onIonChange={(e) => change({ pozaId: String(e.detail.value ?? '') })}
        >
          {pozas.map((poza) => (
            <IonSelectOption key={poza.id} value={poza.id}>
              {poza.codigo}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonItem lines="none">
          <IonLabel className="ion-text-wrap">
            La categoría y el último peso son valores derivados del servidor; el peso autoritativo se registra en
            Pesajes.
          </IonLabel>
        </IonItem>
        <IonInput
          label="Estado"
          labelPlacement="stacked"
          value={input.estado ?? ''}
          onIonInput={(e) => change({ estado: String(e.detail.value ?? '') || null })}
          maxlength={20}
        />
        <IonSelect
          label="Padre"
          labelPlacement="stacked"
          value={input.padreId ?? ''}
          onIonChange={(e) => change({ padreId: (e.detail.value || null) as string | null })}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          {cuyes.map((cuyo) => (
            <IonSelectOption key={cuyo.id} value={cuyo.id}>
              {cuyo.codigoIdentificacion}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonSelect
          label="Madre"
          labelPlacement="stacked"
          value={input.madreId ?? ''}
          onIonChange={(e) => change({ madreId: (e.detail.value || null) as string | null })}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          {cuyes.map((cuyo) => (
            <IonSelectOption key={cuyo.id} value={cuyo.id}>
              {cuyo.codigoIdentificacion}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonInput
          label="Color (código)"
          labelPlacement="stacked"
          value={input.colorCodigo ?? ''}
          onIonInput={(e) => change({ colorCodigo: String(e.detail.value ?? '') || null })}
          maxlength={20}
        />
        <IonInput
          label="Ojos (código)"
          labelPlacement="stacked"
          value={input.ojosCodigo ?? ''}
          onIonInput={(e) => change({ ojosCodigo: String(e.detail.value ?? '') || null })}
          maxlength={20}
        />
        <IonInput
          label="Pelaje (código)"
          labelPlacement="stacked"
          value={input.pelajeOriginal ?? ''}
          onIonInput={(e) => change({ pelajeOriginal: String(e.detail.value ?? '') || null })}
          maxlength={20}
        />
        <IonItem lines="none">
          <IonLabel className="estado-vacio">Los campos vacíos se guardan como NULL, no como cero.</IonLabel>
        </IonItem>
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

export default FormularioCuyo;
