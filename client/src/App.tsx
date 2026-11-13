import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';

import AnimalDetalle from './pages/AnimalDetalle';
import Animales from './pages/Animales';
import AsistenteTrabajo from './pages/AsistenteTrabajo';
import ConflictosTrabajo from './pages/ConflictosTrabajo';
import CrearGalpon from './pages/CrearGalpon';
import CrearPoza from './pages/CrearPoza';
import EditarGalpon from './pages/EditarGalpon';
import EditarPoza from './pages/EditarPoza';
import FormularioCuyo from './pages/FormularioCuyo';
import FormularioEvento from './pages/FormularioEvento';
import FormularioParto from './pages/FormularioParto';
import FormularioPesaje from './pages/FormularioPesaje';
import GalponDetalle from './pages/GalponDetalle';
import Galpones from './pages/Galpones';
import ModoInicio from './pages/ModoInicio';
import PrediccionesAnimal from './pages/PrediccionesAnimal';
import SincronizacionTrabajo from './pages/SincronizacionTrabajo';
import SqlitePoc from './pages/SqlitePoc';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <Route path="/" element={<ModoInicio />} />
        <Route path="/galpones" element={<Galpones />} />
        <Route path="/trabajo/galpones" element={<Galpones mode="trabajo" />} />
        <Route path="/trabajo/galpones/nuevo" element={<CrearGalpon mode="trabajo" />} />
        <Route path="/trabajo/sincronizacion" element={<SincronizacionTrabajo />} />
        <Route path="/trabajo/conflictos" element={<ConflictosTrabajo />} />
        <Route path="/trabajo/conflictos/:entity/:recordId" element={<ConflictosTrabajo />} />
        <Route path="/trabajo/galpones/:galponId/pozas/:pozaId/animales" element={<Animales mode="trabajo" />} />
        <Route path="/trabajo/galpones/:galponId/pozas/:pozaId/animales/nuevo" element={<FormularioCuyo />} />
        <Route path="/trabajo/animales/:animalId" element={<AnimalDetalle />} />
        <Route path="/trabajo/animales/:animalId/editar" element={<FormularioCuyo />} />
        <Route path="/trabajo/animales/:animalId/partos/nuevo" element={<FormularioParto />} />
        <Route path="/trabajo/animales/:animalId/partos/:partoId/editar" element={<FormularioParto />} />
        <Route path="/trabajo/animales/:animalId/pesajes/nuevo" element={<FormularioPesaje />} />
        <Route path="/trabajo/animales/:animalId/pesajes/:pesajeId/editar" element={<FormularioPesaje />} />
        <Route path="/trabajo/animales/:animalId/eventos/nuevo" element={<FormularioEvento />} />
        <Route path="/trabajo/animales/:animalId/eventos/:eventoId/editar" element={<FormularioEvento />} />
        <Route path="/trabajo/animales/:animalId/predicciones" element={<PrediccionesAnimal />} />
        <Route path="/trabajo/asistente" element={<AsistenteTrabajo />} />
        <Route path="/galpones/nuevo" element={<CrearGalpon />} />
        <Route path="/galpones/:id" element={<GalponDetalle />} />
        <Route path="/trabajo/galpones/:id" element={<GalponDetalle mode="trabajo" />} />
        <Route path="/trabajo/galpones/:id/editar" element={<EditarGalpon mode="trabajo" />} />
        <Route path="/trabajo/galpones/:id/pozas/nueva" element={<CrearPoza mode="trabajo" />} />
        <Route path="/trabajo/galpones/:id/pozas/:pozaId/editar" element={<EditarPoza mode="trabajo" />} />
        <Route path="/galpones/:id/editar" element={<EditarGalpon />} />
        <Route path="/galpones/:id/pozas/nueva" element={<CrearPoza />} />
        <Route path="/galpones/:id/pozas/:pozaId/editar" element={<EditarPoza />} />
        <Route path="/sqlite-poc" element={<SqlitePoc />} />
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
