import {
  IonBackButton,
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
import { validateEvento, type Cuyo, type EventoInput } from '../data/work.domain.validation';

const fieldHints = ['tipo', 'fecha', 'macho', 'poza', 'detalle', 'animal'];

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
  const savingRef = useRef(false);
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
    if (savingRef.current || loading) return;
    setNotice(null);
    const validation = validateEvento(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    savingRef.current = true;
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
          <IonTitle>{editing ? 'Editar evento' : 'Registrar evento'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow="Base de trabajo"
            title={editing ? 'Editar evento' : 'Registrar evento'}
            description="Registra un cambio productivo o administrativo del animal. Los valores vacíos permanecen sin registrar."
          />
          {loading ? (
            <PageState kind="loading" title="Cargando evento…" />
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <SectionCard title="Datos del evento">
                <div className="form-grid">
                  <div className="form-grid__full">
                    <IonInput
                      label="Tipo de evento"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.tipo}
                      onIonInput={(e) => change({ tipo: String(e.detail.value ?? '') })}
                      maxlength={30}
                      required
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('tipo'))} />
                  </div>
                  <div className="form-grid__full">
                    <IonInput
                      label="Fecha"
                      labelPlacement="stacked"
                      fill="outline"
                      type="date"
                      value={input.fecha ?? ''}
                      onIonInput={(e) => change({ fecha: String(e.detail.value ?? '') || null })}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('fecha'))} />
                  </div>
                  <div>
                    <IonSelect
                      label="Macho (opcional)"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.machoId ?? ''}
                      onIonChange={(e) => change({ machoId: (e.detail.value || null) as string | null })}
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin registrar</IonSelectOption>
                      {cuyes.map((cuyo) => (
                        <IonSelectOption key={cuyo.id} value={cuyo.id}>
                          {cuyo.codigoIdentificacion}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('macho'))} />
                  </div>
                  <div>
                    <IonTextarea
                      label="Detalle (opcional)"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.detalle ?? ''}
                      onIonInput={(e) => change({ detalle: String(e.detail.value ?? '') || null })}
                      maxlength={255}
                      disabled={saving}
                    />
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('detalle'))} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Pozas del evento (opcional)">
                <div className="form-grid">
                  <div>
                    <IonSelect
                      label="Poza de origen"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.pozaOrigenId ?? ''}
                      onIonChange={(e) => change({ pozaOrigenId: (e.detail.value || null) as string | null })}
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin registrar</IonSelectOption>
                      {pozas.map((poza) => (
                        <IonSelectOption key={poza.id} value={poza.id}>
                          {poza.codigo}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('origen'))} />
                  </div>
                  <div>
                    <IonSelect
                      label="Poza de destino"
                      labelPlacement="stacked"
                      fill="outline"
                      value={input.pozaDestinoId ?? ''}
                      onIonChange={(e) => change({ pozaDestinoId: (e.detail.value || null) as string | null })}
                      disabled={saving}
                    >
                      <IonSelectOption value="">Sin registrar</IonSelectOption>
                      {pozas.map((poza) => (
                        <IonSelectOption key={poza.id} value={poza.id}>
                          {poza.codigo}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    <FieldErrors errors={errors.filter((error) => error.toLowerCase().includes('destino'))} />
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

export default FormularioEvento;
