import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getConflictRepository } from '../data/work.sync.conflict.repository';
import type { ConflictCase } from '../data/work.sync.conflicts';
import {
  conflictFields,
  editableFields,
  formatConflictValue,
  inputValue,
  isConflictEntity,
  type ConflictField,
} from '../data/work.sync.conflicts.config';

type Decision = 'central' | 'retry' | null;
type Edits = Record<string, string>;

function initialEdits(item: ConflictCase): Edits {
  return Object.fromEntries(
    editableFields(item.review.entity).map((field) => [field.key, inputValue(field, item.local[field.key])]),
  );
}

const ConflictosTrabajo: React.FC = () => {
  const params = useParams<{ entity?: string; recordId?: string }>();
  const focusEntity = isConflictEntity(params.entity) ? params.entity : null;
  const focusRecordId = focusEntity && params.recordId ? params.recordId : null;
  const [cases, setCases] = useState<ConflictCase[]>([]);
  const [selected, setSelected] = useState<ConflictCase | null>(null);
  const [edits, setEdits] = useState<Edits | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const savingRef = useRef(false);
  const focusRef = useRef('');

  const choose = useCallback((item: ConflictCase) => {
    setSelected(item);
    setEdits(initialEdits(item));
    setDecision(null);
    setError(null);
    setNotice(null);
  }, []);

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
        setEdits(null);
        setDecision(null);
        const focusKey = `${focusEntity ?? ''}:${focusRecordId ?? ''}`;
        if (focusEntity && focusRecordId && focusRef.current !== focusKey) {
          focusRef.current = focusKey;
          const match = result.find(
            (item) => item.review.entity === focusEntity && item.review.recordId === focusRecordId,
          );
          if (match) choose(match);
          else setNotice('Ese conflicto ya no está pendiente. Revisa la lista actualizada.');
        }
      })
      .catch((cause) => {
        if (requestId === requestIdRef.current) setError(String(cause));
      })
      .finally(() => {
        inFlightRef.current = false;
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [choose, focusEntity, focusRecordId]);

  useEffect(() => {
    load();
    return () => {
      requestIdRef.current = -1;
    };
  }, [load]);
  useIonViewWillEnter(() => load());

  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  const update = (key: string, value: string) => {
    setEdits((current) => (current ? { ...current, [key]: value } : current));
  };

  const confirm = async () => {
    if (!selected || !edits || !decision || saving || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const repository = getConflictRepository();
      const result =
        decision === 'central'
          ? await repository.keepCentral(selected.review)
          : await repository.retry(selected.review, edits);
      setNotice(
        result.operationId
          ? 'Cambio local guardado para el próximo envío. Aún no está confirmado por el servidor.'
          : 'Se conservó la versión central.',
      );
      setSelected(null);
      setEdits(null);
      setDecision(null);
      load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setDecision(null);
      if (/cambió|ya no está|no existe|no coincide/i.test(message)) load();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const renderEditor = (item: ConflictCase, field: ConflictField, value: string) => {
    if (field.kind === 'reference') {
      const options = item.references?.[field.reference!] ?? [];
      return (
        <IonSelect
          aria-label={field.label}
          label={field.label}
          value={value}
          onIonChange={(event) => update(field.key, event.detail.value ?? '')}
          disabled={saving}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          {options.map((option) => (
            <IonSelectOption key={option.id} value={option.id}>
              {option.label}
            </IonSelectOption>
          ))}
        </IonSelect>
      );
    }
    if (field.kind === 'select') {
      return (
        <IonSelect
          aria-label={field.label}
          label={field.label}
          value={value}
          onIonChange={(event) => update(field.key, event.detail.value ?? '')}
          disabled={saving}
        >
          <IonSelectOption value="">Sin registrar</IonSelectOption>
          {field.options?.map((option) => (
            <IonSelectOption key={option.value} value={option.value}>
              {option.label}
            </IonSelectOption>
          ))}
        </IonSelect>
      );
    }
    if (field.kind === 'textarea') {
      return (
        <IonTextarea
          aria-label={field.label}
          label={field.label}
          value={value}
          maxlength={field.maxLength}
          autoGrow
          onIonInput={(event) => update(field.key, event.detail.value ?? '')}
          disabled={saving}
        />
      );
    }
    return (
      <IonInput
        aria-label={field.label}
        label={field.label}
        type={field.kind === 'date' ? 'date' : field.kind === 'integer' ? 'number' : 'text'}
        inputmode={field.kind === 'decimal' ? 'decimal' : undefined}
        min={field.kind === 'integer' ? String(field.min ?? 0) : undefined}
        maxlength={field.kind === 'text' ? field.maxLength : undefined}
        value={value}
        onIonInput={(event) => update(field.key, event.detail.value ?? '')}
        disabled={saving}
      />
    );
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
        <div className="marcado-demo">
          <IonChip color="primary">Base de trabajo</IonChip>
          {!online && <IonChip color="warning">Sin conexión</IonChip>}
        </div>
        <p>
          Revisa cada diferencia antes de elegir qué datos conservar. Las fechas y los pesos se muestran con su unidad;
          «Sin dato» distingue un valor vacío de un cero.
        </p>
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
                  <h2>{item.summary}</h2>
                  <p>
                    {item.review.entity === 'parto_crias' ? 'Vínculo cría–parto' : item.review.entity} · versión central{' '}
                    {item.review.expectedServerVersion}
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
            <h2>Comparar {selected.review.entity === 'parto_crias' ? 'vínculo' : selected.summary}</h2>
            <p>
              Versión central {selected.review.expectedServerVersion}
              {selected.central.deleted_at ? ' (eliminada)' : ''}
            </p>
            <IonList>
              {conflictFields(selected.review.entity).map((field) => (
                <IonItem key={field.key}>
                  <IonLabel>
                    <h3>{field.label}</h3>
                    {field.kind === 'derived' ? (
                      <>
                        <p>
                          Servidor:{' '}
                          {selected.missingServerFields.includes(field.key)
                            ? 'No incluido en el recibo'
                            : formatConflictValue(field, selected.central.data[field.key], selected.references)}
                        </p>
                        <p>Dispositivo: solo servidor</p>
                      </>
                    ) : (
                      <>
                        <p>
                          Servidor: {formatConflictValue(field, selected.central.data[field.key], selected.references)}
                        </p>
                        <p>Dispositivo: {formatConflictValue(field, selected.local[field.key], selected.references)}</p>
                      </>
                    )}
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
            {!selected.central.deleted_at && (
              <>
                <h3>Valores para reintentar</h3>
                <p>
                  Se conservan las referencias y dependencias de la versión central. Solo se reenvían los campos que
                  edites aquí.
                </p>
                {editableFields(selected.review.entity).map((field) =>
                  renderEditor(selected, field, edits[field.key] ?? ''),
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
                setEdits(null);
                setDecision(null);
                setError(null);
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
                  {saving ? 'Resolviendo…' : 'Confirmar decisión'}
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
