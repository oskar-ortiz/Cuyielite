import {
  IonBackButton,
  IonButton,
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
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getDomainRepository } from '../data/work.domain.factory';
import { validateParto, type Cuyo, type PartoInput } from '../data/work.domain.validation';
import './galpones.css';

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
    setNotice(null);
    const validation = validateParto(input);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
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
      <IonContent className="ion-padding">
        {loading && <p className="estado-vacio">Cargando…</p>}
        <IonInput
          label="Fecha de parto"
          labelPlacement="stacked"
          type="date"
          value={input.fechaParto ?? ''}
          onIonInput={(e) => change({ fechaParto: String(e.detail.value ?? '') || null })}
        />
        <IonInput
          label="Número de parto (NUPAR)"
          labelPlacement="stacked"
          type="number"
          value={input.numeroParto ?? ''}
          onIonInput={(e) => change({ numeroParto: numberValue(e.detail.value) })}
        />
        <IonInput
          label="Nacidos vivos"
          labelPlacement="stacked"
          type="number"
          value={input.nacidosVivos ?? ''}
          onIonInput={(e) => change({ nacidosVivos: numberValue(e.detail.value) })}
        />
        <IonInput
          label="Nacidos muertos"
          labelPlacement="stacked"
          type="number"
          value={input.nacidosMuertos ?? ''}
          onIonInput={(e) => change({ nacidosMuertos: numberValue(e.detail.value) })}
        />
        <IonInput
          label="Tamaño de camada"
          labelPlacement="stacked"
          type="number"
          value={input.tamanoCamadaNacida ?? ''}
          onIonInput={(e) => change({ tamanoCamadaNacida: numberValue(e.detail.value) })}
        />
        <IonList>
          <IonItem lines="full">
            <IonLabel>
              <h2>Crias vinculadas al parto</h2>
              <p>Se crea un registro parto_crias por cada cría seleccionada.</p>
            </IonLabel>
          </IonItem>
          {cuyes
            .filter((cuyo) => cuyo.id !== input.madreId)
            .map((cuyo) => (
              <IonItem key={cuyo.id}>
                <IonCheckbox
                  slot="start"
                  checked={input.crias.includes(cuyo.id)}
                  onIonChange={(e) =>
                    change({
                      crias: e.detail.checked ? [...input.crias, cuyo.id] : input.crias.filter((id) => id !== cuyo.id),
                    })
                  }
                />
                <IonLabel>
                  {cuyo.codigoIdentificacion}
                  <p>{cuyo.sexo === 'M' ? 'Macho' : cuyo.sexo === 'H' ? 'Hembra' : 'Sexo sin registrar'}</p>
                </IonLabel>
              </IonItem>
            ))}
        </IonList>
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

export default FormularioParto;
