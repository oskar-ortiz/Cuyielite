import {
  IonBackButton,
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
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  FieldErrors,
  FormActions,
  InlineNotice,
  PageFrame,
  PageIntro,
  PageState,
  SectionCard,
} from '../components/AppUi';
import { getDomainRepository } from '../data/work.domain.factory';
import type { PozaRef } from '../data/work.domain.repository';
import { validateCuyo, type Cuyo, type CuyoInput, type Sexo } from '../data/work.domain.validation';

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

const fieldHints = [
  'chapa',
  'poza',
  'sexo',
  'nacimiento',
  'estado',
  'padre',
  'madre',
  'color',
  'ojos',
  'pelaje',
  'categoría',
  'último peso',
];

const FormularioCuyo: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ galponId?: string; pozaId?: string; animalId?: string }>();
  const editing = Boolean(params.animalId);
  const [input, setInput] = useState<CuyoInput>({ ...empty, pozaId: params.pozaId ?? '' });
  const [pozas, setPozas] = useState<PozaRef[]>([]);
  const [cuyes, setCuyes] = useState<Cuyo[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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
    if (savingRef.current || loading) return;
    setNotice(null);
    const validation = validateCuyo(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    savingRef.current = true;
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
      savingRef.current = false;
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
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow="Base de trabajo"
            title={editing ? 'Editar animal' : 'Registrar animal'}
            description="Completa los datos disponibles. Los valores vacíos permanecen sin registrar y no se convierten en cero."
          />
          {loading ? (
            <PageState kind="loading" title="Cargando datos del animal…" />
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <SectionCard
                title="Identificación y ubicación"
                description="Datos para reconocer al animal y encontrarlo en campo."
              >
                <div className="form-grid">
                  <div className="form-grid__full">
                    <IonInput
                      label="Chapa"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.codigoIdentificacion}
                      onIonInput={(e) => change({ codigoIdentificacion: String(e.detail.value ?? '') })}
                      maxlength={50}
                      required
                      autofocus={!editing}
                      helperText="Código visible usado para identificar al animal."
                      disabled={saving}
                      aria-invalid={errors.some((error) => error.toLocaleLowerCase().includes('chapa'))}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('chapa'))} />
                  </div>
                  <div>
                    <IonSelect
                      cancelText="Cancelar"
                      okText="Aceptar"
                      label="Sexo"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.sexo ?? ''}
                      onIonChange={(e) => change({ sexo: (e.detail.value || null) as Sexo | null })}
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin registrar</IonSelectOption>
                      <IonSelectOption value="M">Macho</IonSelectOption>
                      <IonSelectOption value="H">Hembra</IonSelectOption>
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('sexo'))} />
                  </div>
                  <div>
                    <IonInput
                      label="Fecha de nacimiento"
                      labelPlacement="stacked"
                      fill="outline"
                      type="date"
                      value={input.fechaNacimiento ?? ''}
                      onIonInput={(e) => change({ fechaNacimiento: String(e.detail.value ?? '') || null })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('nacimiento'))} />
                  </div>
                  <div>
                    <IonSelect
                      cancelText="Cancelar"
                      okText="Aceptar"
                      label="Poza"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.pozaId}
                      onIonChange={(e) => change({ pozaId: String(e.detail.value ?? '') })}
                      disabled={saving}
                    >
                      {pozas.map((poza) => (
                        <IonSelectOption key={poza.id} value={poza.id}>
                          {poza.codigo}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('poza'))} />
                  </div>
                  <div>
                    <IonInput
                      label="Estado"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.estado ?? ''}
                      onIonInput={(e) => change({ estado: String(e.detail.value ?? '') || null })}
                      maxlength={20}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('estado'))} />
                  </div>
                </div>
                <InlineNotice tone="medium">
                  La categoría y el último peso son valores derivados del servidor. El peso autoritativo se registra en
                  Pesajes.
                </InlineNotice>
              </SectionCard>

              <SectionCard title="Genealogía" description="Selecciona referencias existentes o déjalas sin registrar.">
                <div className="form-grid">
                  <div>
                    <IonSelect
                      cancelText="Cancelar"
                      okText="Aceptar"
                      label="Padre"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.padreId ?? ''}
                      onIonChange={(e) => change({ padreId: (e.detail.value || null) as string | null })}
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin registrar</IonSelectOption>
                      {cuyes.map((cuyo) => (
                        <IonSelectOption key={cuyo.id} value={cuyo.id}>
                          {cuyo.codigoIdentificacion}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('padre'))} />
                  </div>
                  <div>
                    <IonSelect
                      cancelText="Cancelar"
                      okText="Aceptar"
                      label="Madre"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.madreId ?? ''}
                      onIonChange={(e) => change({ madreId: (e.detail.value || null) as string | null })}
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin registrar</IonSelectOption>
                      {cuyes.map((cuyo) => (
                        <IonSelectOption key={cuyo.id} value={cuyo.id}>
                          {cuyo.codigoIdentificacion}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('madre'))} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Características"
                description="Códigos zootécnicos opcionales, limitados por el contrato vigente."
              >
                <div className="form-grid">
                  <div>
                    <IonInput
                      label="Color (código)"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.colorCodigo ?? ''}
                      onIonInput={(e) => change({ colorCodigo: String(e.detail.value ?? '') || null })}
                      maxlength={20}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('color'))} />
                  </div>
                  <div>
                    <IonInput
                      label="Ojos (código)"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.ojosCodigo ?? ''}
                      onIonInput={(e) => change({ ojosCodigo: String(e.detail.value ?? '') || null })}
                      maxlength={20}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('ojos'))} />
                  </div>
                  <div className="form-grid__full">
                    <IonInput
                      label="Pelaje (código)"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.pelajeOriginal ?? ''}
                      onIonInput={(e) => change({ pelajeOriginal: String(e.detail.value ?? '') || null })}
                      maxlength={20}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('pelaje'))} />
                  </div>
                </div>
              </SectionCard>

              <FieldErrors
                errors={errors.filter((error) => !fieldHints.some((hint) => error.toLocaleLowerCase().includes(hint)))}
              />

              {notice && <InlineNotice role="status">{notice}</InlineNotice>}
              <FormActions saving={saving} />
            </form>
          )}
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default FormularioCuyo;
