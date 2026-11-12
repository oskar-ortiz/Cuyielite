import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
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
} from '@ionic/react';
import { useRef, useState } from 'react';

import { assistantErrorMessage } from '../data/ml.errors';
import { getMlTransport, type AssistantResult } from '../data/ml.transport';
import './galpones.css';

const AsistenteTrabajo: React.FC = () => {
  const [token, setToken] = useState('');
  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState('5');
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(0);

  const submit = async () => {
    if (!token.trim()) {
      setError('Ingresa el token de laboratorio para consultar.');
      return;
    }
    if (question.trim().length < 3) {
      setError('La pregunta debe tener al menos 3 caracteres.');
      return;
    }
    const requestId = ++requestRef.current;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = (await getMlTransport().assistantQuery(token.trim(), {
        pregunta: question,
        top_k: Number(topK),
      })) as AssistantResult;
      if (requestRef.current === requestId) setResult(data);
    } catch (e) {
      if (requestRef.current === requestId) setError(assistantErrorMessage(e));
    } finally {
      if (requestRef.current === requestId) setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/trabajo/galpones" text="Trabajo" />
          </IonButtons>
          <IonTitle>Asistente</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <p className="estado-vacio">
          Consulta los manuales indexados. La respuesta y sus fuentes provienen del servidor; no se generan fuentes
          localmente.
        </p>
        <IonInput
          label="Token de laboratorio"
          labelPlacement="stacked"
          type="password"
          value={token}
          onIonInput={(e) => setToken(String(e.detail.value ?? ''))}
          autocomplete="off"
        />
        <IonTextarea
          label="Pregunta"
          labelPlacement="stacked"
          value={question}
          onIonInput={(e) => setQuestion(String(e.detail.value ?? ''))}
          maxlength={500}
          autoGrow
        />
        <IonSelect
          label="Resultados"
          labelPlacement="stacked"
          value={topK}
          onIonChange={(e) => setTopK(String(e.detail.value))}
        >
          <IonSelectOption value="3">3</IonSelectOption>
          <IonSelectOption value="5">5</IonSelectOption>
          <IonSelectOption value="10">10</IonSelectOption>
        </IonSelect>
        {error && <p className="estado-vacio">{error}</p>}
        <IonButton
          expand="block"
          onClick={() => void submit().catch((e) => setError(assistantErrorMessage(e)))}
          disabled={busy}
        >
          {busy ? 'Consultando…' : 'Preguntar'}
        </IonButton>
        {result && (
          <IonCard>
            <IonCardContent>
              <h3>Respuesta</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{result.respuesta}</p>
              <h4>Fuentes</h4>
              {result.fuentes.length === 0 ? (
                <p className="estado-vacio">El asistente no devolvió fuentes para esta respuesta.</p>
              ) : (
                <IonList>
                  {result.fuentes.map((fuente, index) => (
                    <IonItem key={`${index}-${fuente}`}>
                      <IonLabel>{fuente}</IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AsistenteTrabajo;
