import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { snapshot } from '../data/auth.session';
import type { AlertaDerivada, CategoriaDerivada } from '../data/work.derived.apply';
import { getDerivedReader } from '../data/work.derived.repository';
import { getDomainRepository } from '../data/work.domain.factory';
import type { ConflictKey } from '../data/work.domain.repository';
import type { Cuyo, Evento, PartoCria, Parto, Pesaje } from '../data/work.domain.validation';
import { getWorkSyncRepository } from '../data/work.sync.repository';
import './galpones.css';

interface PartoConCrias {
  parto: Parto;
  crias: Cuyo[];
}

const AnimalDetalle: React.FC = () => {
  const { animalId = '' } = useParams<{ animalId: string }>();
  const [cuyo, setCuyo] = useState<Cuyo | null>(null);
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

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
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
        const poza = animal?.pozaId ? pozas.find((item) => item.id === animal.pozaId) : undefined;
        setCuyo(animal);
        setAllCuyes(todos);
        setPartos(conCrias);
        setPesajes(pesajesData);
        setEventos(eventosData);
        setVinculos(vinculosData);
        setConflicts(conflictos);
        if (poza) setBackHref(`/trabajo/galpones/${poza.galponId}`);
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
          .catch(() => setDerivedError('No se pudo leer la evaluación derivada de este animal.'));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
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
  const conflictChip = (entity: string, id: string) =>
    conflicto(entity, id) ? (
      <IonButton
        fill="clear"
        size="small"
        routerLink={conflictHref(entity, id)}
        onClick={(event) => event.stopPropagation()}
      >
        <IonChip color="danger">Conflicto</IonChip>
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
          {cuyo && (
            <IonButtons slot="end">
              <IonButton routerLink={`/trabajo/animales/${animalId}/predicciones`}>Predicciones</IonButton>
              {canWrite && <IonButton routerLink={`/trabajo/animales/${animalId}/editar`}>Editar</IonButton>}
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {loading && <p className="estado-vacio">Cargando animal…</p>}
        {!loading && error && <p className="estado-vacio">Error al cargar el animal: {error}</p>}
        {!loading && !error && !cuyo && (
          <p className="estado-vacio">No existe un animal con ese identificador en la base de trabajo.</p>
        )}
        {!loading && !error && cuyo && (
          <>
            <div className="marcado-demo">
              <IonChip color="primary">Base de trabajo</IonChip>
              {(!cuyo.sexo || !cuyo.fechaNacimiento || !cuyo.pozaId) && (
                <IonChip color="warning">Dato incompleto</IonChip>
              )}
              {conflicto('cuyes', cuyo.id) && (
                <IonButton fill="clear" size="small" routerLink={conflictHref('cuyes', cuyo.id)}>
                  <IonChip color="danger">Conflicto pendiente</IonChip>
                </IonButton>
              )}
            </div>

            <IonList>
              <IonItem>
                <IonLabel>Chapa</IonLabel>
                <IonLabel slot="end">{cuyo.codigoIdentificacion}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Sexo</IonLabel>
                <IonLabel slot="end">
                  {cuyo.sexo === 'M' ? 'Macho' : cuyo.sexo === 'H' ? 'Hembra' : 'Sin registrar'}
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Nacimiento</IonLabel>
                <IonLabel slot="end">{cuyo.fechaNacimiento ?? 'Sin registrar'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Estado</IonLabel>
                <IonLabel slot="end">{cuyo.estado ?? 'Sin registrar'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Último peso (derivado del servidor)</IonLabel>
                <IonLabel slot="end">{cuyo.ultimoPesoG ? `${cuyo.ultimoPesoG} g` : 'Sin registrar'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Categoría (derivada del servidor)</IonLabel>
                <IonLabel slot="end">{cuyo.categoriaMl ?? 'Sin registrar'}</IonLabel>
              </IonItem>{' '}
              <IonItem>
                <IonLabel>Padre</IonLabel>
                <IonLabel slot="end">{nameOf(cuyo.padreId) ?? 'Sin registrar'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Madre</IonLabel>
                <IonLabel slot="end">{nameOf(cuyo.madreId) ?? 'Sin registrar'}</IonLabel>
              </IonItem>
            </IonList>

            <section aria-label="Evaluación del servidor">
              <h2>Evaluación del servidor</h2>
              {derivedError && <p className="texto-ayuda">{derivedError}</p>}
              {!evaluacion && !derivedError && (
                <p className="estado-vacio">
                  Sin evaluación definitiva sincronizada. Solo se guarda la clase de reglas cuando la evaluación es
                  definitiva.
                </p>
              )}
              {evaluacion && (
                <>
                  <div className="marcado-demo">
                    <IonChip
                      color={
                        evaluacion.clase === 'DESCARTE' ? 'danger' : evaluacion.clase === 'ELITE' ? 'success' : 'medium'
                      }
                    >
                      {evaluacion.clase ?? 'Sin clase definitiva'}
                    </IonChip>
                    <IonChip color={evaluacion.estadoEvaluacion === 'DEFINITIVA' ? 'success' : 'warning'}>
                      {evaluacion.estadoEvaluacion === 'DEFINITIVA'
                        ? 'Confirmada'
                        : evaluacion.estadoEvaluacion === 'PROVISIONAL'
                          ? 'Provisional'
                          : evaluacion.estadoEvaluacion === 'EVIDENCIA_NO_VALIDADA'
                            ? 'Evidencia sin revisar'
                            : 'Datos insuficientes'}
                    </IonChip>
                    {evaluacion.caracter === 'PROPUESTO' && (
                      <IonChip color="warning">Propuesta pendiente de validación</IonChip>
                    )}
                    {evaluacion.categoriaEstado === 'HISTORICA' && (
                      <IonChip color="medium">Histórica / no confirmada</IonChip>
                    )}
                  </div>
                  <IonList>
                    <IonItem>
                      <IonLabel>Clase de reglas</IonLabel>
                      <IonLabel slot="end">{evaluacion.clase ?? 'Sin clase'}</IonLabel>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Versión de reglas</IonLabel>
                      <IonLabel slot="end">{evaluacion.reglasVersion ?? 'Sin registrar'}</IonLabel>
                    </IonItem>
                    <IonItem>
                      <IonLabel>Evaluada</IonLabel>
                      <IonLabel slot="end">{evaluacion.evaluadaAt?.slice(0, 10) ?? 'Sin fecha'}</IonLabel>
                    </IonItem>
                  </IonList>
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
                    <p className="texto-ayuda">
                      Faltan datos: {evaluacion.faltantes.join(', ')}. Se muestra como REVISAR, no como clasificación
                      definitiva.
                    </p>
                  )}
                  {evaluacion.evidenciaPendiente.length > 0 && (
                    <p className="texto-ayuda">
                      Evidencia pendiente de revisión: {evaluacion.evidenciaPendiente.join(', ')}. Sin esa revisión no
                      se confirma una categoría oficial.
                    </p>
                  )}
                  {evaluacion.estadoEvaluacion === 'PROVISIONAL' && (
                    <p className="texto-ayuda">
                      Resultado provisional: se apoya en una regla que todavía no está validada. No reemplaza la
                      categoría anterior ni genera una alerta oficial.
                    </p>
                  )}
                  {evaluacion.estadoEvaluacion === 'EVIDENCIA_NO_VALIDADA' && (
                    <p className="texto-ayuda">
                      La evaluación está calculada, pero falta la revisión de la evidencia. No se guardó como categoría
                      oficial.
                    </p>
                  )}
                  <p className="texto-ayuda">
                    La clase proviene solo de las reglas. El apoyo del Random Forest no se guarda como categoría.
                  </p>
                </>
              )}
            </section>

            <section aria-label="Recomendaciones">
              <h2>Recomendaciones</h2>
              {alertas.length === 0 ? (
                <p className="estado-vacio">Sin recomendaciones sincronizadas para este animal.</p>
              ) : (
                <IonList>
                  {alertas.map((alerta) => (
                    <IonItem key={alerta.id}>
                      <IonLabel>
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
                      <IonChip slot="end" color={alerta.estado === 'activa' ? 'warning' : 'medium'}>
                        {alerta.estado}
                      </IonChip>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </section>

            {canWrite && (
              <div className="marcado-demo">
                <IonButton fill="outline" routerLink={`/trabajo/animales/${animalId}/partos/nuevo`}>
                  Registrar parto
                </IonButton>
                <IonButton fill="outline" routerLink={`/trabajo/animales/${animalId}/pesajes/nuevo`}>
                  Registrar pesaje
                </IonButton>
                <IonButton fill="outline" routerLink={`/trabajo/animales/${animalId}/eventos/nuevo`}>
                  Registrar evento
                </IonButton>
              </div>
            )}

            <IonList>
              <IonItem lines="full">
                <IonLabel>
                  <h2>Partos</h2>
                </IonLabel>
              </IonItem>
              {partos.length === 0 && (
                <IonItem>
                  <IonLabel className="estado-vacio">Sin partos registrados.</IonLabel>
                </IonItem>
              )}
              {partos.map(({ parto, crias }) => (
                <IonItem key={parto.id} routerLink={`/trabajo/animales/${animalId}/partos/${parto.id}/editar`}>
                  <IonLabel>
                    <h2>{parto.fechaParto ?? 'Fecha sin registrar'}</h2>
                    <p>
                      NUPAR {parto.numeroParto ?? '—'} · vivos {parto.nacidosVivos ?? '—'} · muertos{' '}
                      {parto.nacidosMuertos ?? '—'} · camada {parto.tamanoCamadaNacida ?? '—'}
                    </p>
                    <p>
                      Crias: {crias.length > 0 ? crias.map((c) => c.codigoIdentificacion).join(', ') : 'sin vínculos'}
                    </p>
                  </IonLabel>
                  {conflictChip('partos', parto.id)}
                </IonItem>
              ))}
            </IonList>

            <IonList>
              <IonItem lines="full">
                <IonLabel>
                  <h2>Pesajes</h2>
                </IonLabel>
              </IonItem>
              {pesajes.length === 0 && (
                <IonItem>
                  <IonLabel className="estado-vacio">Sin pesajes registrados.</IonLabel>
                </IonItem>
              )}
              {pesajes.map((pesaje) => (
                <IonItem key={pesaje.id} routerLink={`/trabajo/animales/${animalId}/pesajes/${pesaje.id}/editar`}>
                  <IonLabel>
                    <h2>{pesaje.pesoGramos} g</h2>
                    <p>
                      {pesaje.fechaPesaje ?? 'Fecha sin registrar'} · {pesaje.etapa ?? 'Etapa sin registrar'}
                    </p>
                  </IonLabel>
                  {conflictChip('pesajes', pesaje.id)}
                </IonItem>
              ))}
            </IonList>

            <IonList>
              <IonItem lines="full">
                <IonLabel>
                  <h2>Eventos</h2>
                </IonLabel>
              </IonItem>
              {eventos.length === 0 && (
                <IonItem>
                  <IonLabel className="estado-vacio">Sin eventos registrados.</IonLabel>
                </IonItem>
              )}
              {eventos.map((evento) => (
                <IonItem key={evento.id} routerLink={`/trabajo/animales/${animalId}/eventos/${evento.id}/editar`}>
                  <IonLabel>
                    <h2>{evento.tipo}</h2>
                    <p>
                      {evento.fecha ?? 'Fecha sin registrar'}
                      {evento.detalle ? ` · ${evento.detalle}` : ''}
                    </p>
                  </IonLabel>
                  {conflictChip('eventos', evento.id)}
                </IonItem>
              ))}
            </IonList>

            <IonList>
              <IonItem lines="full">
                <IonLabel>
                  <h2>Vínculos cría–parto</h2>
                </IonLabel>
              </IonItem>
              {vinculos.length === 0 && (
                <IonItem>
                  <IonLabel className="estado-vacio">Sin vínculos registrados.</IonLabel>
                </IonItem>
              )}
              {vinculos.map((vinculo) => {
                const parto = partos.find((item) => item.parto.id === vinculo.partoId)?.parto;
                return (
                  <IonItem key={vinculo.id}>
                    <IonLabel>
                      <h2>{vinculo.rol}</h2>
                      <p>
                        {parto
                          ? `Parto ${parto.fechaParto ?? 'sin fecha'} · ${parto.id.slice(0, 8)}`
                          : `Parto ${vinculo.partoId.slice(0, 8)}`}
                      </p>
                    </IonLabel>
                    {conflictChip('parto_crias', vinculo.id)}
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AnimalDetalle;
