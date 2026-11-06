import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getConflictRepository } from '../data/work.sync.conflict.repository';
import type { ConflictCase } from '../data/work.sync.conflicts';

type Decision = 'central' | 'retry' | null;
type Edits = { nombre: string; ubicacion: string; codigo: string; tipo: string; capacidad: string };

function value(data: Record<string, unknown>, key: string): string {
  const item = data[key];
  return item === null || item === undefined ? '' : String(item);
}

function fields(entity: ConflictCase['review']['entity']): [string, string][] {
  return entity === 'galpon'
    ? [
        ['nombre', 'Nombre'],
        ['ubicacion', 'Ubicación'],
      ]
    : [
        ['codigo', 'Código'],
        ['tipo', 'Tipo'],
        ['capacidad_maxima', 'Capacidad máxima'],
      ];
}

function editableValues(item: ConflictCase): Edits {
  return {
    nombre: value(item.local, 'nombre'),
    ubicacion: value(item.local, 'ubicacion'),
    codigo: value(item.local, 'codigo'),
    tipo: value(item.local, 'tipo'),
    capacidad: value(item.local, 'capacidad_maxima'),
  };
}

const ConflictosTrabajo: React.FC = () => {
  const [cases, setCases] = useState<ConflictCase[]>([]);
  const [selected, setSelected] = useState<ConflictCase | null>(null);
  const [edits, setEdits] = useState<Edits | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const load = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => getConflictRepository().list())
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setCases(result);
        setSelected(null);
        setDecision(null);
      })
      .catch((cause) => {
        if (requestId === requestIdRef.current) setError(String(cause));
      })
      .finally(() => {
        inFlightRef.current = false;
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      requestIdRef.current = -1;
    };
  }, [load]);
  useIonViewWillEnter(() => load());

  const choose = (item: ConflictCase) => {
    setSelected(item);
    setEdits(editableValues(item));
    setDecision(null);
    setError(null);
    setNotice(null);
  };

  const confirm = async () => {
    if (!selected || !edits || !decision || saving) return;
    setSaving(true);
    setError(null);
    try {
      const repository = getConflictRepository();
      const result =
        decision === 'central'
          ? await repository.keepCentral(selected.review)
          : await repository.retry(
              selected.review,
              selected.review.entity === 'galpon'
                ? { nombre: edits.nombre, ubicacion: edits.ubicacion.trim() || null }
                : {
                    codigo: edits.codigo,
                    tipo: edits.tipo,
                    capacidad_maxima: edits.capacidad.trim() === '' ? Number.NaN : Number(edits.capacidad),
                  },
            );
      setNotice(
        result.operationId
          ? 'Cambio local guardado para el próximo envío. Aún no está confirmado por el servidor.'
          : 'Se conservó la versión central.',
      );
      load();
    } catch (cause) {
      setError(String(cause));
      setDecision(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/trabajo/galpones" text="Trabajo" />
          </IonButtons>
          <IonTitle>Conflictos de trabajo</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p>Revisa cada diferencia antes de elegir qué datos conservar. La decisión se guarda en este dispositivo.</p>
        <IonButton fill="clear" onClick={load} disabled={saving}>
          Actualizar
        </IonButton>
        {loading && <p>Cargando conflictos…</p>}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {!loading && cases.length === 0 && !error && <p>No hay conflictos pendientes.</p>}
        {!loading && cases.length > 0 && (
          <IonList aria-label="Conflictos pendientes">
            {cases.map((item) => (
              <IonItem key={item.review.conflictOperationId}>
                <IonLabel>
                  <h2>
                    {item.review.entity === 'galpon' ? 'Galpón' : 'Poza'}:{' '}
                    {value(item.local, item.review.entity === 'galpon' ? 'nombre' : 'codigo')}
                  </h2>
                  <p>
                    Versión central {item.review.expectedServerVersion}
                    {item.central.deleted_at ? ' · Eliminado en el servidor' : ''}
                  </p>
                </IonLabel>
                <IonButton slot="end" onClick={() => choose(item)} disabled={saving}>
                  Revisar
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}
        {selected && edits && (
          <section aria-label="Revisión del conflicto">
            <h2>Comparar {selected.review.entity === 'galpon' ? 'galpón' : 'poza'}</h2>
            <p>
              Versión central {selected.review.expectedServerVersion}
              {selected.central.deleted_at ? ' (eliminada)' : ''}
            </p>
            {fields(selected.review.entity).map(([key, label]) => (
              <p key={key}>
                <strong>{label}:</strong> servidor: {value(selected.central.data, key) || 'Sin dato'} · dispositivo:{' '}
                {value(selected.local, key) || 'Sin dato'}
              </p>
            ))}
            {!selected.central.deleted_at && (
              <>
                <h3>Valores para reintentar</h3>
                {selected.review.entity === 'galpon' ? (
                  <>
                    <IonInput
                      label="Nombre"
                      value={edits.nombre}
                      maxlength={120}
                      onIonInput={(event) => setEdits({ ...edits, nombre: event.detail.value ?? '' })}
                    />
                    <IonInput
                      label="Ubicación"
                      value={edits.ubicacion}
                      maxlength={255}
                      onIonInput={(event) => setEdits({ ...edits, ubicacion: event.detail.value ?? '' })}
                    />
                  </>
                ) : (
                  <>
                    <IonInput
                      label="Código"
                      value={edits.codigo}
                      maxlength={50}
                      onIonInput={(event) => setEdits({ ...edits, codigo: event.detail.value ?? '' })}
                    />
                    <IonInput
                      label="Tipo"
                      value={edits.tipo}
                      maxlength={50}
                      onIonInput={(event) => setEdits({ ...edits, tipo: event.detail.value ?? '' })}
                    />
                    <IonInput
                      label="Capacidad máxima"
                      type="number"
                      min="0"
                      value={edits.capacidad}
                      onIonInput={(event) => setEdits({ ...edits, capacidad: event.detail.value ?? '' })}
                    />
                  </>
                )}
              </>
            )}
            <IonButton onClick={() => setDecision('central')} disabled={saving}>
              Conservar versión central
            </IonButton>
            {!selected.central.deleted_at && (
              <IonButton onClick={() => setDecision('retry')} disabled={saving}>
                Reintentar cambio local
              </IonButton>
            )}
            <IonButton
              fill="clear"
              onClick={() => {
                setSelected(null);
                setDecision(null);
              }}
              disabled={saving}
            >
              Cancelar
            </IonButton>
            {decision && (
              <div role="group" aria-label="Confirmar decisión">
                <p>
                  {decision === 'central'
                    ? 'Se descartarán los cambios locales pendientes de este registro.'
                    : 'Se creará un cambio local nuevo; se enviará en una sincronización posterior.'}
                </p>
                <IonButton color="danger" onClick={confirm} disabled={saving}>
                  Confirmar decisión
                </IonButton>
                <IonButton fill="clear" onClick={() => setDecision(null)} disabled={saving}>
                  Volver
                </IonButton>
              </div>
            )}
          </section>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ConflictosTrabajo;
