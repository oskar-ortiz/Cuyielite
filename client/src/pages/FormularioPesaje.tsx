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
import { validatePesaje, type Evento, type Parto, type PesajeInput } from '../data/work.domain.validation';

const fieldHints = ['fecha', 'peso', 'etapa', 'parto', 'evento', 'animal'];

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
  const savingRef = useRef(false);
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
    if (savingRef.current || loading) return;
    setNotice(null);
    const validation = validatePesaje(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    savingRef.current = true;
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
          <IonTitle>{editing ? 'Editar pesaje' : 'Registrar pesaje'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow="Base de trabajo"
            title={editing ? 'Editar pesaje' : 'Registrar pesaje'}
            description="Registra el peso y, si aplica, asócialo a un parto o evento. Un pesaje admite a lo sumo uno de esos vínculos."
          />
          {loading ? (
            <PageState kind="loading" title="Cargando pesaje…" />
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <SectionCard title="Datos del pesaje">
                <div className="form-grid">
                  <div className="form-grid__full">
                    <IonInput
                      label="Fecha de pesaje"
                      labelPlacement="stacked"
                      fill="outline"
                      type="date"
                      value={input.fechaPesaje ?? ''}
                      onIonInput={(e) => change({ fechaPesaje: String(e.detail.value ?? '') || null })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('fecha'))} />
                  </div>
                  <div className="form-grid__full">
                    <IonInput
                      label="Peso en gramos"
                      labelPlacement="stacked"
                      fill="outline"
                      inputmode="decimal"
                      value={input.pesoGramos}
                      onIonInput={(e) => change({ pesoGramos: String(e.detail.value ?? '') })}
                      disabled={saving}
                      required
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('peso'))} />
                  </div>
                  <div className="form-grid__full">
                    <IonInput
                      label="Etapa"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.etapa ?? ''}
                      onIonInput={(e) => change({ etapa: String(e.detail.value ?? '') || null })}
                      maxlength={20}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('etapa'))} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Vínculo opcional">
                <div className="form-grid">
                  <div>
                    <IonSelect
                      label="Parto"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.partoId ?? ''}
                      onIonChange={(e) =>
                        change({ partoId: (e.detail.value || null) as string | null, eventoId: null })
                      }
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin vínculo</IonSelectOption>
                      {partos.map((parto) => (
                        <IonSelectOption key={parto.id} value={parto.id}>
                          {parto.fechaParto ?? parto.id}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('parto'))} />
                  </div>
                  <div>
                    <IonSelect
                      label="Evento"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.eventoId ?? ''}
                      onIonChange={(e) =>
                        change({ eventoId: (e.detail.value || null) as string | null, partoId: null })
                      }
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin vínculo</IonSelectOption>
                      {eventos.map((evento) => (
                        <IonSelectOption key={evento.id} value={evento.id}>
                          {evento.tipo} · {evento.fecha ?? 'sin fecha'}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('evento'))} />
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

export default FormularioPesaje;
