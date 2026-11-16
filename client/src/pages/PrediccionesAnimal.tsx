import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
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
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { PageFrame } from '../components/AppUi';
import { AUTH_MODE } from '../data/api.config';
import { ensureAccessToken, snapshot } from '../data/auth.session';
import { predictionErrorMessage } from '../data/ml.errors';
import { getMlTransport, type CandidataResult, type HembraResult } from '../data/ml.transport';
import { getDomainRepository } from '../data/work.domain.factory';
import type { Cuyo } from '../data/work.domain.validation';

import './galpones.css';

interface EvaluationResult {
  estado_evaluacion: 'DEFINITIVA' | 'PROVISIONAL' | 'DATOS_INSUFICIENTES' | 'EVIDENCIA_NO_VALIDADA';
  caracter: 'CONFIRMADO' | 'PROPUESTO' | null;
  clase: 'ELITE' | 'NORMAL' | 'DESCARTE' | null;
  estado_calidad: string;
  motivos: string[];
  campos_faltantes: string[];
  evidencia_pendiente: string[];
  fundamentos: {
    regla_id: string;
    caracter: 'CONFIRMADO' | 'PROPUESTO';
    causa_fecha: string | null;
    fecha_limite: string | null;
    motivo: string;
  }[];
  categoria_persistida: boolean;
  alertas: { id: string; estado: string; regla_id: string | null; fecha_limite: string | null }[];
}

interface EvidenceRow {
  campo: string;
  valor: string | null;
  estado: 'DECLARADA' | 'REVISADA' | 'RECHAZADA';
  origen: string;
  revisada_at: string | null;
}

function estadoLabel(value: EvaluationResult['estado_evaluacion']): string {
  if (value === 'DEFINITIVA') return 'Confirmada';
  if (value === 'PROVISIONAL') return 'Provisional';
  if (value === 'EVIDENCIA_NO_VALIDADA') return 'Evidencia sin revisar';
  return 'Datos insuficientes';
}

function compact(values: Record<string, string | number | null>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== '') result[key] = value;
  }
  return result;
}

const PrediccionesAnimal: React.FC = () => {
  const { animalId = '' } = useParams<{ animalId: string }>();
  const [cuyo, setCuyo] = useState<Cuyo | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'hembra' | 'candidata' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hembraResult, setHembraResult] = useState<HembraResult | null>(null);
  const [candidataResult, setCandidataResult] = useState<CandidataResult | null>(null);
  const [candidata, setCandidata] = useState({
    nupar_madre: '',
    tcnv: '',
    peso_nacimiento_g: '',
    peso_destete_g: '',
    dias_destete: '',
    peso_monta_g: '',
    ojos: '',
  });
  const [hembra, setHembra] = useState({
    partos_acumulados: '',
    abortos: '',
    fecha_ultimo_parto: '',
    peso_monta_g: '',
  });
  const requestRef = useRef(0);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [busyEval, setBusyEval] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const canWrite = snapshot().canWrite;

  const accessToken = useCallback(async (): Promise<string> => {
    if (AUTH_MODE === 'pilot') return ensureAccessToken();
    const value = token.trim();
    if (!value) throw new Error('Ingresa el token de laboratorio para consultar.');
    return value;
  }, [token]);

  const loadContext = useCallback(async () => {
    try {
      const bearer = await accessToken();
      const context = (await getMlTransport().evaluationContext(bearer, animalId)) as {
        evidencias?: EvidenceRow[];
      };
      setEvidence(context.evidencias ?? []);
      setEvalError(null);
    } catch (error) {
      setEvalError(error instanceof Error ? error.message : String(error));
    }
  }, [accessToken, animalId]);

  const runEvaluation = useCallback(
    async (kind: 'reproductora' | 'candidata', declareOnly = false) => {
      setBusyEval(true);
      setEvalError(null);
      try {
        const bearer = await accessToken();
        const transport = getMlTransport();
        if (declareOnly) {
          const fields: Record<string, string> =
            kind === 'reproductora' ? { abortos: hembra.abortos } : { ...candidata };
          for (const [campo, valor] of Object.entries(fields)) {
            if (valor === '' || valor === undefined) continue;
            await transport.declareEvidence(bearer, animalId, { campo, valor });
          }
          await loadContext();
          return;
        }
        const result = (
          kind === 'reproductora'
            ? await transport.evaluateReproductora(bearer, animalId, {})
            : await transport.evaluateCandidata(bearer, animalId, {})
        ) as EvaluationResult;
        setEvaluation(result);
        await loadContext();
      } catch (error) {
        setEvalError(predictionErrorMessage(error));
      } finally {
        setBusyEval(false);
      }
    },
    [accessToken, animalId, candidata, hembra.abortos, loadContext],
  );

  const review = useCallback(
    async (campo: string) => {
      setBusyEval(true);
      setEvalError(null);
      try {
        const bearer = await accessToken();
        await getMlTransport().reviewEvidence(bearer, animalId, { campo, decision: 'REVISADA' });
        await loadContext();
      } catch (error) {
        setEvalError(predictionErrorMessage(error));
      } finally {
        setBusyEval(false);
      }
    },
    [accessToken, animalId, loadContext],
  );

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getDomainRepository())
      .then((repo) => repo.getCuyo(animalId))
      .then((data) => active && setCuyo(data))
      .catch(() => active && setCuyo(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      requestRef.current = -1;
    };
  }, [animalId]);

  const run = useCallback(
    async (kind: 'hembra' | 'candidata') => {
      if (!token.trim()) {
        setError('Ingresa el token de laboratorio para consultar.');
        return;
      }
      const requestId = ++requestRef.current;
      setBusy(kind);
      setError(null);
      if (kind === 'hembra') setHembraResult(null);
      else setCandidataResult(null);
      try {
        const transport = getMlTransport();
        if (kind === 'hembra') {
          const body = compact({ cuy_id: animalId, ...hembra });
          const data = (await transport.predictHembra(token.trim(), body)) as HembraResult;
          if (requestRef.current === requestId) setHembraResult(data);
        } else {
          const body = compact({ cuy_id: animalId, ...candidata });
          const data = (await transport.predictCandidata(token.trim(), body)) as CandidataResult;
          if (requestRef.current === requestId) setCandidataResult(data);
        }
      } catch (e) {
        if (requestRef.current === requestId) setError(predictionErrorMessage(e));
      } finally {
        if (requestRef.current === requestId) setBusy(null);
      }
    },
    [animalId, token, hembra, candidata],
  );

  const aplicable = cuyo?.sexo === 'H' && cuyo.estado === 'ACTIVO';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/trabajo/animales/${animalId}`} text="Animal" />
          </IonButtons>
          <IonTitle>Predicciones</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        {loading && <p className="estado-vacio">Cargando animal…</p>}
        {!loading && !cuyo && <p className="estado-vacio">El animal no existe en la base local.</p>}
        {!loading && cuyo && (
          <>
            <PageFrame>
              <div className="marcado-demo">
                <IonChip color="primary">{cuyo.codigoIdentificacion}</IonChip>
                {aplicable ? (
                  <IonChip color="success">Aplicable</IonChip>
                ) : (
                  <IonChip color="warning">No aplicable o datos insuficientes</IonChip>
                )}
              </div>
              <p className="estado-vacio">
                La evaluación usa sexo y estado del servidor central y las variables que ingreses. No cambia estado
                productivo, categoría ni alertas. Solo se evalúan datos publicados; los cambios locales pendientes no se
                incluyen.
              </p>
              <IonInput
                fill="outline"
                label="Token de laboratorio"
                labelPlacement="stacked"
                type="password"
                value={token}
                onIonInput={(e) => setToken(String(e.detail.value ?? ''))}
                autocomplete="off"
              />
              {error && <p className="estado-vacio">{error}</p>}

              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>Reproductora</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonList>
                    <IonItem>
                      <IonInput
                        fill="outline"
                        label="Partos acumulados"
                        labelPlacement="stacked"
                        type="number"
                        value={hembra.partos_acumulados}
                        onIonInput={(e) => setHembra({ ...hembra, partos_acumulados: String(e.detail.value ?? '') })}
                      />
                    </IonItem>
                    <IonItem>
                      <IonInput
                        fill="outline"
                        label="Abortos (vacío = desconocido)"
                        labelPlacement="stacked"
                        type="number"
                        value={hembra.abortos}
                        onIonInput={(e) => setHembra({ ...hembra, abortos: String(e.detail.value ?? '') })}
                      />
                    </IonItem>
                    <IonItem>
                      <IonInput
                        fill="outline"
                        label="Fecha del último parto"
                        labelPlacement="stacked"
                        type="date"
                        value={hembra.fecha_ultimo_parto}
                        onIonInput={(e) => setHembra({ ...hembra, fecha_ultimo_parto: String(e.detail.value ?? '') })}
                      />
                    </IonItem>
                    <IonItem>
                      <IonInput
                        fill="outline"
                        label="Peso de monta (g)"
                        labelPlacement="stacked"
                        inputmode="decimal"
                        value={hembra.peso_monta_g}
                        onIonInput={(e) => setHembra({ ...hembra, peso_monta_g: String(e.detail.value ?? '') })}
                      />
                    </IonItem>
                  </IonList>
                  <IonButton expand="block" onClick={() => void run('hembra')} disabled={busy !== null || !aplicable}>
                    {busy === 'hembra' ? 'Evaluando…' : 'Evaluar reproductora'}
                  </IonButton>
                  {hembraResult && (
                    <div>
                      <h3>Clase de reglas: {hembraResult.clase}</h3>
                      <p>Calidad: {hembraResult.estado_calidad}</p>
                      {hembraResult.estado_calidad.includes('REVISAR') && (
                        <IonChip color="warning">Datos insuficientes: requiere revisión</IonChip>
                      )}
                      <ul>
                        {hembraResult.motivos.map((motivo) => (
                          <li key={motivo}>{motivo}</li>
                        ))}
                      </ul>
                      <p>
                        Fecha de descarte sugerida:{' '}
                        {hembraResult.fecha_descarte_sugerida ?? 'sin fecha (dato no disponible)'}. Es informativa y no
                        ejecuta ningún descarte.
                      </p>
                      <p>
                        Peso de monta en rango 900–1000 g:{' '}
                        {hembraResult.peso_monta_en_rango_900_1000 === null
                          ? 'sin dato'
                          : hembraResult.peso_monta_en_rango_900_1000
                            ? 'sí'
                            : 'no'}
                      </p>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>

              <IonCard>
                <IonCardHeader>
                  <IonCardTitle> Candidata</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonList>
                    {(
                      [
                        ['nupar_madre', 'NUPAR de la madre', 'numeric'],
                        ['tcnv', 'TCNV', 'numeric'],
                        ['peso_nacimiento_g', 'Peso al nacimiento (g)', 'decimal'],
                        ['peso_destete_g', 'Peso al destete (g)', 'decimal'],
                        ['dias_destete', 'Días al destete', 'numeric'],
                        ['peso_monta_g', 'Peso de monta (g)', 'decimal'],
                      ] as const
                    ).map(([field, label, mode]) => (
                      <IonItem key={field}>
                        <IonInput
                          fill="outline"
                          label={label}
                          labelPlacement="stacked"
                          inputmode={mode}
                          value={candidata[field]}
                          onIonInput={(e) => setCandidata({ ...candidata, [field]: String(e.detail.value ?? '') })}
                        />
                      </IonItem>
                    ))}
                    <IonItem>
                      <IonSelect
                        cancelText="Cancelar"
                        okText="Aceptar"
                        fill="outline"
                        label="Ojos"
                        labelPlacement="stacked"
                        value={candidata.ojos}
                        onIonChange={(e) => setCandidata({ ...candidata, ojos: String(e.detail.value ?? '') })}
                      >
                        <IonSelectOption value="">Sin registrar</IonSelectOption>
                        <IonSelectOption value="1">1 / Negro</IonSelectOption>
                        <IonSelectOption value="2">2 / Rojo</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                  </IonList>
                  <IonButton
                    expand="block"
                    onClick={() => void run('candidata')}
                    disabled={busy !== null || !aplicable}
                  >
                    {busy === 'candidata' ? 'Evaluando…' : 'Evaluar candidata'}
                  </IonButton>
                  {candidataResult && (
                    <div>
                      <h3>Clase de reglas: {candidataResult.clase}</h3>
                      <p>Calidad: {candidataResult.estado_calidad}</p>
                      {candidataResult.estado_calidad.includes('REVISAR') && (
                        <IonChip color="warning">Datos insuficientes: requiere revisión</IonChip>
                      )}
                      <ul>
                        {candidataResult.motivos.map((motivo) => (
                          <li key={motivo}>{motivo}</li>
                        ))}
                      </ul>
                      <h4>Apoyo exploratorio del modelo</h4>
                      {candidataResult.apoyo_modelo === null ? (
                        <p>Sin apoyo del modelo para esta consulta. La clase principal sigue siendo la de reglas.</p>
                      ) : (
                        <div>
                          <p>
                            Clase estimada: {candidataResult.apoyo_modelo.clase} (no calibrada; no reemplaza la regla)
                          </p>
                          <ul>
                            {Object.entries(candidataResult.apoyo_modelo.probabilidades).map(([key, value]) => (
                              <li key={key}>
                                {key}: {(value * 100).toFixed(1)}%
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>Evaluación oficial y evidencia</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <p className="texto-ayuda">
                    Solo una evaluación confirmada cambia la categoría. Lo provisional, lo insuficiente y la evidencia
                    sin revisar no se guardan como categoría oficial.
                  </p>
                  {evalError && <p className="estado-vacio">{evalError}</p>}
                  <IonList>
                    {evidence.length === 0 && (
                      <IonItem>
                        <IonLabel>Sin evidencia registrada para este animal.</IonLabel>
                      </IonItem>
                    )}
                    {evidence.map((item) => (
                      <IonItem key={item.campo}>
                        <IonLabel>
                          <h3>{item.campo}</h3>
                          <p>
                            {item.valor ?? 'sin valor'} · {item.estado}
                            {item.revisada_at ? ` · revisada ${item.revisada_at.slice(0, 10)}` : ''}
                          </p>
                        </IonLabel>
                        {canWrite && item.estado === 'DECLARADA' && (
                          <IonButton
                            slot="end"
                            size="small"
                            disabled={busyEval}
                            onClick={() => void review(item.campo)}
                          >
                            Revisar
                          </IonButton>
                        )}
                      </IonItem>
                    ))}
                  </IonList>
                  {canWrite ? (
                    <div className="marcado-demo">
                      <IonButton
                        fill="outline"
                        disabled={busyEval}
                        onClick={() => void runEvaluation('reproductora', true)}
                      >
                        Declarar abortos
                      </IonButton>
                      <IonButton disabled={busyEval} onClick={() => void runEvaluation('reproductora')}>
                        {busyEval ? 'Evaluando…' : 'Evaluar y guardar (reproductora)'}
                      </IonButton>
                      <IonButton
                        fill="outline"
                        disabled={busyEval}
                        onClick={() => void runEvaluation('candidata', true)}
                      >
                        Declarar criterios de candidata
                      </IonButton>
                      <IonButton disabled={busyEval} onClick={() => void runEvaluation('candidata')}>
                        Evaluar y guardar (candidata)
                      </IonButton>
                    </div>
                  ) : (
                    <p className="texto-ayuda">
                      La cuenta actual solo puede consultar: no declara evidencia ni evalúa.
                    </p>
                  )}
                  {evaluation && (
                    <div>
                      <div className="marcado-demo">
                        <IonChip color={evaluation.estado_evaluacion === 'DEFINITIVA' ? 'success' : 'warning'}>
                          {estadoLabel(evaluation.estado_evaluacion)}
                        </IonChip>
                        {evaluation.caracter === 'PROPUESTO' && (
                          <IonChip color="warning">Propuesta pendiente de validación</IonChip>
                        )}
                      </div>
                      <p>
                        Clase de reglas: {evaluation.clase ?? 'sin clase'} · calidad: {evaluation.estado_calidad}
                      </p>
                      <p>
                        Categoría oficial {evaluation.categoria_persistida ? 'actualizada' : 'no modificada'}. Alertas
                        oficiales activas: {evaluation.alertas.length}.
                      </p>
                      <ul>
                        {evaluation.motivos.map((motivo, index) => (
                          <li key={`${index}-${motivo}`}>{motivo}</li>
                        ))}
                      </ul>
                      {evaluation.fundamentos.map((fundamento) => (
                        <p key={fundamento.regla_id}>
                          {fundamento.caracter === 'CONFIRMADO' ? 'Fundamento confirmado' : 'Fundamento propuesto'}:{' '}
                          {fundamento.motivo}
                          {fundamento.causa_fecha
                            ? ` · causa ${fundamento.causa_fecha}`
                            : ' · fecha del cuarto parto pendiente de validar'}
                          {fundamento.fecha_limite ? ` · límite ${fundamento.fecha_limite}` : ''}
                        </p>
                      ))}
                      {evaluation.evidencia_pendiente.length > 0 && (
                        <p className="texto-ayuda">
                          Evidencia pendiente de revisión: {evaluation.evidencia_pendiente.join(', ')}.
                        </p>
                      )}
                      {evaluation.estado_evaluacion === 'PROVISIONAL' && (
                        <p className="texto-ayuda">
                          Resultado provisional: no reemplaza la categoría anterior ni genera una alerta oficial.
                        </p>
                      )}
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
              {!aplicable && (
                <p className="estado-vacio">
                  El registro local no permite evaluar: se requiere hembra con estado ACTIVO. El servidor vuelve a
                  comprobar sexo y supervivencia.
                </p>
              )}
            </PageFrame>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default PrediccionesAnimal;
