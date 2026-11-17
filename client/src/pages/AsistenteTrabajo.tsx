import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { bookOutline, sendOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';

import { InlineNotice, PageFrame, PageIntro, SectionCard } from '../components/AppUi';
import { AUTH_MODE } from '../data/api.config.js';
import { ensureAccessToken } from '../data/auth.session.js';
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
    if (busy) return;
    // En el piloto la consulta usa la sesión iniciada; el token manual queda
    // reservado al modo laboratorio, como en el resto de pantallas de ML.
    let bearer: string;
    try {
      bearer = AUTH_MODE === 'pilot' ? await ensureAccessToken() : token.trim();
    } catch {
      bearer = '';
    }
    if (!bearer) {
      setError(
        AUTH_MODE === 'pilot'
          ? 'Inicia sesión para consultar el asistente.'
          : 'Ingresa el token de laboratorio para consultar.',
      );
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
      const data = (await getMlTransport().assistantQuery(bearer, {
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
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            title="Asistente"
            description="Consulta los manuales indexados. Cada respuesta conserva las fuentes devueltas por el servidor."
          />
          <SectionCard title="Tu consulta" description="Escribe una pregunta concreta sobre el manejo de cuyes.">
            {AUTH_MODE === 'lab' ? (
              <IonInput
                fill="outline"
                label="Token de laboratorio"
                labelPlacement="stacked"
                type="password"
                value={token}
                onIonInput={(e) => setToken(String(e.detail.value ?? ''))}
                autocomplete="off"
              />
            ) : (
              <p className="texto-ayuda">La consulta usa la sesión activa del piloto.</p>
            )}
            <IonTextarea
              fill="outline"
              label="Pregunta"
              labelPlacement="stacked"
              value={question}
              onIonInput={(e) => setQuestion(String(e.detail.value ?? ''))}
              maxlength={500}
              autoGrow
            />
            <IonSelect
              cancelText="Cancelar"
              okText="Aceptar"
              fill="outline"
              label="Resultados"
              labelPlacement="stacked"
              value={topK}
              onIonChange={(e) => setTopK(String(e.detail.value))}
            >
              <IonSelectOption value="3">3</IonSelectOption>
              <IonSelectOption value="5">5</IonSelectOption>
              <IonSelectOption value="10">10</IonSelectOption>
            </IonSelect>
            {error && (
              <InlineNotice tone="danger" role="alert">
                {error}
              </InlineNotice>
            )}
            <IonButton
              expand="block"
              onClick={() => void submit().catch((e) => setError(assistantErrorMessage(e)))}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <IonSpinner name="dots" aria-hidden="true" />
              ) : (
                <IonIcon slot="start" icon={sendOutline} aria-hidden="true" />
              )}
              {busy ? 'Consultando…' : 'Preguntar'}
            </IonButton>
          </SectionCard>
          {result && (
            <SectionCard title="Respuesta">
              <p className="assistant-answer">{result.respuesta}</p>
              <h3>Fuentes</h3>
              {result.fuentes.length === 0 ? (
                <p className="estado-vacio">El asistente no devolvió fuentes para esta respuesta.</p>
              ) : (
                <IonList className="app-list assistant-sources" aria-label="Fuentes de la respuesta">
                  {result.fuentes.map((fuente, index) => (
                    <IonItem key={`${index}-${fuente}`}>
                      <IonIcon slot="start" icon={bookOutline} aria-hidden="true" />
                      <IonLabel className="ion-text-wrap">{fuente}</IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </SectionCard>
          )}
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default AsistenteTrabajo;
