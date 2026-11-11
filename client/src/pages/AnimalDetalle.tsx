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

import { getDomainRepository } from '../data/work.domain.factory';
import type { ConflictKey } from '../data/work.domain.repository';
import type { Cuyo, Evento, Parto, Pesaje } from '../data/work.domain.validation';
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
  const [conflicts, setConflicts] = useState<ConflictKey[]>([]);
  const [backHref, setBackHref] = useState('/trabajo/galpones');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => getDomainRepository())
      .then(async (repo) => {
        const [animal, todos, partosData, pesajesData, eventosData, pozas, conflictos] = await Promise.all([
          repo.getCuyo(animalId),
          repo.listAllCuyes(),
          repo.listPartosByCuyo(animalId),
          repo.listPesajesByCuyo(animalId),
          repo.listEventosByCuyo(animalId),
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
        setConflicts(conflictos);
        if (poza) setBackHref(`/trabajo/galpones/${poza.galponId}`);
        // El estado de sincronización se consulta aparte para no bloquear la lectura local.
        void getWorkSyncRepository()
          .status()
          .catch(() => null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [animalId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useIonViewWillEnter(() => load());

  const conflicto = (entity: string, id: string) =>
    conflicts.some((item) => item.entity === entity && item.recordId === id);
  const nameOf = (id: string | null) =>
    id ? (allCuyes.find((item) => item.id === id)?.codigoIdentificacion ?? 'Referencia pendiente') : null;

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
              <IonButton routerLink={`/trabajo/animales/${animalId}/editar`}>Editar</IonButton>
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
                <IonButton fill="clear" size="small" routerLink="/trabajo/conflictos">
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
                <IonLabel>Último peso</IonLabel>
                <IonLabel slot="end">{cuyo.ultimoPesoG ? `${cuyo.ultimoPesoG} g` : 'Sin registrar'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Categoría</IonLabel>
                <IonLabel slot="end">{cuyo.categoriaMl ?? 'Sin registrar'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Padre</IonLabel>
                <IonLabel slot="end">{nameOf(cuyo.padreId) ?? 'Sin registrar'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>Madre</IonLabel>
                <IonLabel slot="end">{nameOf(cuyo.madreId) ?? 'Sin registrar'}</IonLabel>
              </IonItem>
            </IonList>

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
                  {conflicto('partos', parto.id) && <IonChip color="danger">Conflicto</IonChip>}
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
                  {conflicto('pesajes', pesaje.id) && <IonChip color="danger">Conflicto</IonChip>}
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
                  {conflicto('eventos', evento.id) && <IonChip color="danger">Conflicto</IonChip>}
                </IonItem>
              ))}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AnimalDetalle;
