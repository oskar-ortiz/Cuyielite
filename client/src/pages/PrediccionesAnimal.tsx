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
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { predictionErrorMessage } from '../data/ml.errors';
import { getMlTransport, type CandidataResult, type HembraResult } from '../data/ml.transport';
import { getDomainRepository } from '../data/work.domain.factory';
import type { Cuyo } from '../data/work.domain.validation';
import './galpones.css';

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
      <IonContent className="ion-padding" fullscreen>
        {loading && <p className="estado-vacio">Cargando animal…</p>}
        {!loading && !cuyo && <p className="estado-vacio">El animal no existe en la base local.</p>}
        {!loading && cuyo && (
          <>
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
                      label="Partos acumulados"
                      labelPlacement="stacked"
                      type="number"
                      value={hembra.partos_acumulados}
                      onIonInput={(e) => setHembra({ ...hembra, partos_acumulados: String(e.detail.value ?? '') })}
                    />
                  </IonItem>
                  <IonItem>
                    <IonInput
                      label="Abortos (vacío = desconocido)"
                      labelPlacement="stacked"
                      type="number"
                      value={hembra.abortos}
                      onIonInput={(e) => setHembra({ ...hembra, abortos: String(e.detail.value ?? '') })}
                    />
                  </IonItem>
                  <IonItem>
                    <IonInput
                      label="Fecha del último parto"
                      labelPlacement="stacked"
                      type="date"
                      value={hembra.fecha_ultimo_parto}
                      onIonInput={(e) => setHembra({ ...hembra, fecha_ultimo_parto: String(e.detail.value ?? '') })}
                    />
                  </IonItem>
                  <IonItem>
                    <IonInput
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
                <IonButton expand="block" onClick={() => void run('candidata')} disabled={busy !== null || !aplicable}>
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
            {!aplicable && (
              <p className="estado-vacio">
                El registro local no permite evaluar: se requiere hembra con estado ACTIVO. El servidor vuelve a
                comprobar sexo y supervivencia.
              </p>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default PrediccionesAnimal;
