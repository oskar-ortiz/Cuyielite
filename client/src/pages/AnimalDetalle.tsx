import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  addOutline,
  alertCircleOutline,
  calendarOutline,
  createOutline,
  locationOutline,
  scaleOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  InlineNotice,
  ModeChip,
  PageFrame,
  PageIntro,
  PageState,
  SectionCard,
  StatusChip,
  type StatusTone,
} from '../components/AppUi';
import { snapshot } from '../data/auth.session';
import type { AlertaDerivada, CategoriaDerivada } from '../data/work.derived.apply';
import { getDerivedReader } from '../data/work.derived.repository';
import { getDomainRepository } from '../data/work.domain.factory';
import type { ConflictKey, PozaRef } from '../data/work.domain.repository';
import type { Cuyo, Evento, PartoCria, Parto, Pesaje } from '../data/work.domain.validation';
import { getWorkSyncRepository } from '../data/work.sync.repository';

interface PartoConCrias {
  parto: Parto;
  crias: Cuyo[];
}

function evaluationStateLabel(evaluation: CategoriaDerivada) {
  if (evaluation.estadoEvaluacion === 'DEFINITIVA') return 'Confirmada';
  if (evaluation.estadoEvaluacion === 'PROVISIONAL') return 'Provisional';
  if (evaluation.estadoEvaluacion === 'EVIDENCIA_NO_VALIDADA') return 'Evidencia sin revisar';
  return 'Datos insuficientes';
}

function categoryTone(evaluation: CategoriaDerivada): StatusTone {
  if (evaluation.estadoEvaluacion !== 'DEFINITIVA') return 'warning';
  if (evaluation.clase === 'DESCARTE') return 'danger';
  if (evaluation.clase === 'ELITE') return 'success';
  return 'medium';
}

const AnimalDetalle: React.FC = () => {
  const { animalId = '' } = useParams<{ animalId: string }>();
  const [cuyo, setCuyo] = useState<Cuyo | null>(null);
  const [poza, setPoza] = useState<PozaRef | null>(null);
  const [allCuyes, setAllCuyes] = useState<Cuyo[]>([]);
  const [partos, setPartos] = useState<PartoConCrias[]>([]);
  const [pesajes, setPesajes] = useState<Pesaje[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [vinculos, setVinculos] = useState<PartoCria[]>([]);
  const [conflicts, setConflicts] = useState<ConflictKey[]>([]);
  const [backHref, setBackHref] = useState('/trabajo/galpones');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(() => snapshot().canWrite);
  const [evaluacion, setEvaluacion] = useState<CategoriaDerivada | null>(null);
  const [alertas, setAlertas] = useState<AlertaDerivada[]>([]);
  const [derivedError, setDerivedError] = useState<string | null>(null);
  const [derivedLoading, setDerivedLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setDerivedLoading(true);
    setError(null);
    setDerivedError(null);
    setEvaluacion(null);
    setAlertas([]);
    Promise.resolve()
      .then(() => getDomainRepository())
      .then(async (repo) => {
        const [animal, todos, partosData, pesajesData, eventosData, vinculosData, pozas, conflictos] =
          await Promise.all([
            repo.getCuyo(animalId),
            repo.listAllCuyes(),
            repo.listPartosByCuyo(animalId),
            repo.listPesajesByCuyo(animalId),
            repo.listEventosByCuyo(animalId),
            repo.listVinculosByCuyo(animalId),
            repo.listPozas(),
            repo.listConflictKeys(),
          ]);
        const conCrias = await Promise.all(
          partosData.map(async (parto) => ({ parto, crias: await repo.listCriasByParto(parto.id) })),
        );
        const ubicacion = animal?.pozaId ? pozas.find((item) => item.id === animal.pozaId) : undefined;
        setCuyo(animal);
        setPoza(ubicacion ?? null);
        setAllCuyes(todos);
        setPartos(conCrias);
        setPesajes(pesajesData);
        setEventos(eventosData);
        setVinculos(vinculosData);
        setConflicts(conflictos);
        if (ubicacion) setBackHref(`/trabajo/galpones/${ubicacion.galponId}`);
        // El estado de sincronización se consulta aparte para no bloquear la lectura local.
        void getWorkSyncRepository()
          .status()
          .catch(() => null);
      })
      .then(() => {
        // Categoría y alertas son datos derivados de solo lectura: si todavía no
        // llegaron, la ficha sigue operativa con el estado local.
        const reader = getDerivedReader();
        Promise.all([reader.categoria(animalId), reader.alertas(animalId)])
          .then(([categoria, lista]) => {
            setEvaluacion(categoria);
            setAlertas(lista);
            setDerivedError(null);
          })
          .catch(() => setDerivedError('No se pudo leer la evaluación derivada de este animal.'))
          .finally(() => setDerivedLoading(false));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setDerivedLoading(false);
      })
      .finally(() => setLoading(false));
  }, [animalId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useIonViewWillEnter(() => {
    setCanWrite(snapshot().canWrite);
    load();
  });

  const conflicto = (entity: string, id: string) =>
    conflicts.some((item) => item.entity === entity && item.recordId === id);
  const conflictHref = (entity: string, id: string) => `/trabajo/conflictos/${entity}/${id}`;
  const animalLabel = (id: string) => {
    const animal = allCuyes.find((item) => item.id === id);
    return animal ? `${animal.codigoIdentificacion} · ${animal.id.slice(0, 8)}` : `Referencia ${id.slice(0, 8)}`;
  };
  const nameOf = (id: string | null) => (id ? animalLabel(id) : null);
  const conflictAction = (entity: string, id: string) =>
    conflicto(entity, id) ? (
      <IonButton
        color="danger"
        fill="outline"
        size="small"
        routerLink={conflictHref(entity, id)}
        onClick={(event) => event.stopPropagation()}
      >
        <IonIcon slot="start" icon={alertCircleOutline} aria-hidden="true" />
        Conflicto
      </IonButton>
    ) : null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={backHref} text="Volver" />
          </IonButtons>
          <IonTitle>{cuyo?.codigoIdentificacion ?? 'Animal'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-content">
        <PageFrame>
          {loading ? (
            <PageState kind="loading" title="Cargando animal…" />
          ) : error ? (
            <PageState kind="error" title="Error al cargar el animal">
              <p>{error}</p>
            </PageState>
          ) : !cuyo ? (
            <PageState kind="empty" title="No existe un animal con ese identificador en la base de trabajo." />
          ) : (
            <>
              <PageIntro
                eyebrow="Ficha del animal"
                title={cuyo.codigoIdentificacion}
                description="Identificación, genealogía, historial productivo y evaluación en una sola consulta."
                actions={
                  <>
                    <IonButton fill="outline" routerLink={`/trabajo/animales/${animalId}/predicciones`}>
                      <IonIcon slot="start" icon={sparklesOutline} aria-hidden="true" />
                      Predicciones
                    </IonButton>
                    {canWrite && (
                      <IonButton routerLink={`/trabajo/animales/${animalId}/editar`}>
                        <IonIcon slot="start" icon={createOutline} aria-hidden="true" />
                        Editar
                      </IonButton>
                    )}
                  </>
                }
              />

              <div className="context-bar">
                <div className="context-status">
                  <ModeChip work readOnly={!canWrite} />
                  {(!cuyo.sexo || !cuyo.fechaNacimiento || !cuyo.pozaId) && (
                    <StatusChip tone="warning">Dato incompleto</StatusChip>
                  )}
                </div>
                {conflicto('cuyes', cuyo.id) && (
                  <IonButton color="danger" fill="outline" routerLink={conflictHref('cuyes', cuyo.id)}>
                    <IonIcon slot="start" icon={alertCircleOutline} aria-hidden="true" />
                    Conflicto pendiente
                  </IonButton>
                )}
              </div>

              <div className="animal-grid">
                <SectionCard title="Identificación y ubicación">
                  <dl className="data-list">
                    <div>
                      <dt>Chapa</dt>
                      <dd>{cuyo.codigoIdentificacion}</dd>
                    </div>
                    <div>
                      <dt>Sexo</dt>
                      <dd>{cuyo.sexo === 'M' ? 'Macho' : cuyo.sexo === 'H' ? 'Hembra' : 'Sin registrar'}</dd>
                    </div>
                    <div>
                      <dt>Nacimiento</dt>
                      <dd>{cuyo.fechaNacimiento ?? 'Sin registrar'}</dd>
                    </div>
                    <div>
                      <dt>Estado</dt>
                      <dd>{cuyo.estado ?? 'Sin registrar'}</dd>
                    </div>
                    <div>
                      <dt>Poza actual</dt>
                      <dd>
                        <IonIcon icon={locationOutline} aria-hidden="true" /> {poza?.codigo ?? 'Sin registrar'}
                      </dd>
                    </div>
                    <div>
                      <dt>Último peso (derivado del servidor)</dt>
                      <dd>{cuyo.ultimoPesoG !== null ? `${cuyo.ultimoPesoG} g` : 'Sin registrar'}</dd>
                    </div>
                  </dl>
                  <h3>Genealogía</h3>
                  <dl className="data-list">
                    <div>
                      <dt>Padre</dt>
                      <dd>{nameOf(cuyo.padreId) ?? 'Sin registrar'}</dd>
                    </div>
                    <div>
                      <dt>Madre</dt>
                      <dd>{nameOf(cuyo.madreId) ?? 'Sin registrar'}</dd>
                    </div>
                  </dl>
                </SectionCard>

                <SectionCard title="Evaluación del servidor">
                  {derivedLoading ? (
                    <p className="texto-ayuda" role="status">
                      Consultando evaluación sincronizada…
                    </p>
                  ) : derivedError ? (
                    <InlineNotice tone="danger" role="alert">
                      {derivedError}
                    </InlineNotice>
                  ) : !evaluacion ? (
                    <InlineNotice tone="medium">
                      Sin evaluación definitiva sincronizada. Solo se guarda la clase de reglas cuando la evaluación es
                      definitiva.
                    </InlineNotice>
                  ) : (
                    <>
                      <div className="context-status">
                        <StatusChip tone={categoryTone(evaluacion)}>
                          {evaluacion.clase ?? 'Sin clase definitiva'}
                        </StatusChip>
                        <StatusChip tone={evaluacion.estadoEvaluacion === 'DEFINITIVA' ? 'success' : 'warning'}>
                          {evaluationStateLabel(evaluacion)}
                        </StatusChip>
                        {evaluacion.caracter === 'PROPUESTO' && (
                          <StatusChip tone="warning">Propuesta pendiente de validación</StatusChip>
                        )}
                        {evaluacion.categoriaEstado === 'HISTORICA' && (
                          <StatusChip tone="medium">Histórica / no confirmada</StatusChip>
                        )}
                      </div>
                      <dl className="data-list">
                        <div>
                          <dt>Clase de reglas</dt>
                          <dd>{evaluacion.clase ?? 'Sin clase'}</dd>
                        </div>
                        <div>
                          <dt>Categoría (derivada del servidor)</dt>
                          <dd>{cuyo.categoriaMl ?? 'Sin registrar'}</dd>
                        </div>
                        <div>
                          <dt>Versión de reglas</dt>
                          <dd>{evaluacion.reglasVersion ?? 'Sin registrar'}</dd>
                        </div>
                        <div>
                          <dt>Evaluada</dt>
                          <dd>{evaluacion.evaluadaAt?.slice(0, 10) ?? 'Sin fecha'}</dd>
                        </div>
                      </dl>
                      {evaluacion.motivos.length > 0 && (
                        <>
                          <h3>Motivos de la regla</h3>
                          <ul>
                            {evaluacion.motivos.map((motivo, index) => (
                              <li key={`${index}-${motivo}`}>{motivo}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {evaluacion.faltantes.length > 0 && (
                        <InlineNotice tone="warning">
                          Faltan datos: {evaluacion.faltantes.join(', ')}. Se muestra como REVISAR, no como
                          clasificación definitiva.
                        </InlineNotice>
                      )}
                      {evaluacion.evidenciaPendiente.length > 0 && (
                        <InlineNotice tone="warning">
                          Evidencia pendiente de revisión: {evaluacion.evidenciaPendiente.join(', ')}. Sin esa revisión
                          no se confirma una categoría oficial.
                        </InlineNotice>
                      )}
                      {evaluacion.estadoEvaluacion === 'PROVISIONAL' && (
                        <InlineNotice tone="warning">
                          Resultado provisional: se apoya en una regla que todavía no está validada. No reemplaza la
                          categoría anterior ni genera una alerta oficial.
                        </InlineNotice>
                      )}
                      {evaluacion.estadoEvaluacion === 'EVIDENCIA_NO_VALIDADA' && (
                        <InlineNotice tone="warning">
                          La evaluación está calculada, pero falta la revisión de la evidencia. No se guardó como
                          categoría oficial.
                        </InlineNotice>
                      )}
                      <p className="texto-ayuda">
                        La clase proviene solo de las reglas. El apoyo del Random Forest no se guarda como categoría.
                      </p>
                    </>
                  )}
                </SectionCard>

                <SectionCard title="Recomendaciones">
                  {alertas.length === 0 ? (
                    <InlineNotice tone="medium">Sin recomendaciones sincronizadas para este animal.</InlineNotice>
                  ) : (
                    <IonList>
                      {alertas.map((alerta) => (
                        <IonItem key={alerta.id} lines="none">
                          <IonLabel className="ion-text-wrap">
                            <h3>
                              {alerta.estado === 'activa'
                                ? 'Descarte recomendado'
                                : alerta.estado === 'obsoleta'
                                  ? 'Recomendación obsoleta'
                                  : 'Recomendación no confirmada'}
                            </h3>
                            <p>{alerta.motivo ?? 'Sin motivo registrado'}</p>
                            {alerta.causaFecha && <p>Causa registrada el {alerta.causaFecha}</p>}
                            {alerta.fechaLimite && <p>Fecha límite sugerida: {alerta.fechaLimite}</p>}
                            {!alerta.causaFecha && (
                              <p>Fecha del cuarto parto pendiente de validar; no se calcula vencimiento.</p>
                            )}
                            <p>Es una recomendación: no ejecuta el descarte del animal.</p>
                          </IonLabel>
                          <StatusChip tone={alerta.estado === 'activa' ? 'warning' : 'medium'}>
                            {alerta.estado}
                          </StatusChip>
                        </IonItem>
                      ))}
                    </IonList>
                  )}
                </SectionCard>

                {canWrite && (
                  <SectionCard title="Registrar actividad">
                    <div className="animal-actions">
                      <IonButton fill="outline" routerLink={`/trabajo/animales/${animalId}/partos/nuevo`}>
                        <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
                        Registrar parto
                      </IonButton>
                      <IonButton fill="outline" routerLink={`/trabajo/animales/${animalId}/pesajes/nuevo`}>
                        <IonIcon slot="start" icon={scaleOutline} aria-hidden="true" />
                        Registrar pesaje
                      </IonButton>
                      <IonButton fill="outline" routerLink={`/trabajo/animales/${animalId}/eventos/nuevo`}>
                        <IonIcon slot="start" icon={calendarOutline} aria-hidden="true" />
                        Registrar evento
                      </IonButton>
                    </div>
                  </SectionCard>
                )}
              </div>

              {canWrite && (
                <InlineNotice tone="medium">
                  Las evaluaciones se calculan con datos publicados en el servidor; los cambios locales pendientes no se
                  incluyen.
                </InlineNotice>
              )}

              <div className="history-grid history-grid--three">
                <SectionCard className="section-card--flush" title="Partos">
                  <IonList className="app-list">
                    {partos.length === 0 && (
                      <IonItem>
                        <IonLabel className="estado-vacio">Sin partos registrados.</IonLabel>
                      </IonItem>
                    )}
                    {partos.map(({ parto, crias }) => (
                      <IonItem key={parto.id} routerLink={`/trabajo/animales/${animalId}/partos/${parto.id}/editar`}>
                        <IonLabel className="ion-text-wrap">
                          <h3>{parto.fechaParto ?? 'Fecha sin registrar'}</h3>
                          <p>
                            NUPAR {parto.numeroParto ?? '—'} · vivos {parto.nacidosVivos ?? '—'} · muertos{' '}
                            {parto.nacidosMuertos ?? '—'} · camada {parto.tamanoCamadaNacida ?? '—'}
                          </p>
                          <p>
                            Crías:{' '}
                            {crias.length > 0 ? crias.map((c) => c.codigoIdentificacion).join(', ') : 'sin vínculos'}
                          </p>
                        </IonLabel>
                        {conflictAction('partos', parto.id)}
                      </IonItem>
                    ))}
                  </IonList>
                </SectionCard>

                <SectionCard className="section-card--flush" title="Pesajes">
                  <IonList className="app-list">
                    {pesajes.length === 0 && (
                      <IonItem>
                        <IonLabel className="estado-vacio">Sin pesajes registrados.</IonLabel>
                      </IonItem>
                    )}
                    {pesajes.map((pesaje) => (
                      <IonItem key={pesaje.id} routerLink={`/trabajo/animales/${animalId}/pesajes/${pesaje.id}/editar`}>
                        <IonLabel className="ion-text-wrap">
                          <h3>{pesaje.pesoGramos} g</h3>
                          <p>
                            {pesaje.fechaPesaje ?? 'Fecha sin registrar'} · {pesaje.etapa ?? 'Etapa sin registrar'}
                          </p>
                        </IonLabel>
                        {conflictAction('pesajes', pesaje.id)}
                      </IonItem>
                    ))}
                  </IonList>
                </SectionCard>

                <SectionCard className="section-card--flush" title="Eventos">
                  <IonList className="app-list">
                    {eventos.length === 0 && (
                      <IonItem>
                        <IonLabel className="estado-vacio">Sin eventos registrados.</IonLabel>
                      </IonItem>
                    )}
                    {eventos.map((evento) => (
                      <IonItem key={evento.id} routerLink={`/trabajo/animales/${animalId}/eventos/${evento.id}/editar`}>
                        <IonLabel className="ion-text-wrap">
                          <h3>{evento.tipo}</h3>
                          <p>
                            {evento.fecha ?? 'Fecha sin registrar'}
                            {evento.detalle ? ` · ${evento.detalle}` : ''}
                          </p>
                        </IonLabel>
                        {conflictAction('eventos', evento.id)}
                      </IonItem>
                    ))}
                  </IonList>
                </SectionCard>
              </div>

              <SectionCard className="section-card--flush" title="Vínculos cría–parto">
                <IonList className="app-list">
                  {vinculos.length === 0 && (
                    <IonItem>
                      <IonLabel className="estado-vacio">Sin vínculos registrados.</IonLabel>
                    </IonItem>
                  )}
                  {vinculos.map((vinculo) => {
                    const parto = partos.find((item) => item.parto.id === vinculo.partoId)?.parto;
                    return (
                      <IonItem key={vinculo.id}>
                        <IonLabel className="ion-text-wrap">
                          <h3>{vinculo.rol}</h3>
                          <p>
                            {parto
                              ? `Parto ${parto.fechaParto ?? 'sin fecha'} · ${parto.id.slice(0, 8)}`
                              : `Parto ${vinculo.partoId.slice(0, 8)}`}
                          </p>
                        </IonLabel>
                        {conflictAction('parto_crias', vinculo.id)}
                      </IonItem>
                    );
                  })}
                </IonList>
              </SectionCard>

              <InlineNotice tone="medium">
                La evaluación y las recomendaciones son datos derivados de solo lectura.
              </InlineNotice>
            </>
          )}
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default AnimalDetalle;
