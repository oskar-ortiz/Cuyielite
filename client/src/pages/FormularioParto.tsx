import {
  IonBackButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
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
import { validateParto, type Cuyo, type PartoInput } from '../data/work.domain.validation';

const fieldHints = ['fecha', 'número', 'nacidos', 'camada', 'cría', 'madre'];

const FormularioParto: React.FC = () => {
  const navigate = useNavigate();
  const { animalId = '', partoId } = useParams<{ animalId: string; partoId?: string }>();
  const editing = Boolean(partoId);
  const [input, setInput] = useState<PartoInput>({
    madreId: animalId,
    fechaParto: null,
    numeroParto: null,
    nacidosVivos: null,
    nacidosMuertos: null,
    tamanoCamadaNacida: null,
    crias: [],
  });
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
        const todos = await repo.listAllCuyes();
        if (!active) return;
        setCuyes(todos);
        if (partoId) {
          const [parto, crias] = await Promise.all([repo.getParto(partoId), repo.listCriasByParto(partoId)]);
          if (active && parto) setInput({ ...parto, crias: crias.map((cria) => cria.id) });
        }
      })
      .catch((e) => active && setErrors([e instanceof Error ? e.message : String(e)]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [partoId]);

  const change = (patch: Partial<PartoInput>) => setInput((prev) => ({ ...prev, ...patch }));
  const numberValue = (value: unknown) => (String(value ?? '').trim() === '' ? null : Number(value));

  const submit = async () => {
    if (savingRef.current || loading) return;
    setNotice(null);
    const validation = validateParto(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setErrors([]);
    try {
      const repo = await getDomainRepository();
      const result = partoId
        ? await repo.updateParto(partoId, validation.value)
        : await repo.createParto(validation.value);
      if (!result.changed) {
        setNotice('Sin cambios para guardar.');
        return;
      }
      navigate(`/trabajo/animales/${animalId}`);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      savingRef.current = false;
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
          <IonTitle>{editing ? 'Editar parto' : 'Registrar parto'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow="Base de trabajo"
            title={editing ? 'Editar parto' : 'Registrar parto'}
            description="Añade datos reproductivos y vincula las crías nacidas. Los campos vacíos permanecen sin registrar."
          />
          {loading ? (
            <PageState kind="loading" title="Cargando parto…" />
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <SectionCard title="Datos del parto">
                <div className="form-grid">
                  <div className="form-grid__full">
                    <IonInput
                      label="Fecha de parto"
                      labelPlacement="stacked"
                      fill="outline"
                      type="date"
                      value={input.fechaParto ?? ''}
                      onIonInput={(e) => change({ fechaParto: String(e.detail.value ?? '') || null })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('fecha'))} />
                  </div>
                  <div>
                    <IonInput
                      label="Número de parto (NUPAR)"
                      labelPlacement="stacked"
                      fill="outline"
                      type="number"
                      inputmode="numeric"
                      value={input.numeroParto ?? ''}
                      onIonInput={(e) => change({ numeroParto: numberValue(e.detail.value) })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('parto'))} />
                  </div>
                  <div>
                    <IonInput
                      label="Nacidos vivos"
                      labelPlacement="stacked"
                      fill="outline"
                      type="number"
                      inputmode="numeric"
                      value={input.nacidosVivos ?? ''}
                      onIonInput={(e) => change({ nacidosVivos: numberValue(e.detail.value) })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('vivos'))} />
                  </div>
                  <div>
                    <IonInput
                      label="Nacidos muertos"
                      labelPlacement="stacked"
                      fill="outline"
                      type="number"
                      inputmode="numeric"
                      value={input.nacidosMuertos ?? ''}
                      onIonInput={(e) => change({ nacidosMuertos: numberValue(e.detail.value) })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('muertos'))} />
                  </div>
                  <div className="form-grid__full">
                    <IonInput
                      label="Tamaño de camada"
                      labelPlacement="stacked"
                      fill="outline"
                      type="number"
                      inputmode="numeric"
                      value={input.tamanoCamadaNacida ?? ''}
                      onIonInput={(e) => change({ tamanoCamadaNacida: numberValue(e.detail.value) })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('camada'))} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Crías vinculadas al parto"
                description="Se crea un registro parto_crias por cada cría seleccionada."
              >
                <IonList className="app-list">
                  {cuyes
                    .filter((cuyo) => cuyo.id !== input.madreId)
                    .map((cuyo) => (
                      <IonItem key={cuyo.id}>
                        <IonCheckbox
                          slot="start"
                          checked={input.crias.includes(cuyo.id)}
                          onIonChange={(e) =>
                            change({
                              crias: e.detail.checked
                                ? [...input.crias, cuyo.id]
                                : input.crias.filter((id) => id !== cuyo.id),
                            })
                          }
                          disabled={saving}
                        />
                        <IonLabel>
                          {cuyo.codigoIdentificacion}
                          <p>{cuyo.sexo === 'M' ? 'Macho' : cuyo.sexo === 'H' ? 'Hembra' : 'Sexo sin registrar'}</p>
                        </IonLabel>
                      </IonItem>
                    ))}
                </IonList>
                <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('cría'))} />
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

export default FormularioParto;
