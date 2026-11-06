import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';

import ConflictosTrabajo from './pages/ConflictosTrabajo';
import CrearGalpon from './pages/CrearGalpon';
import CrearPoza from './pages/CrearPoza';
import EditarGalpon from './pages/EditarGalpon';
import EditarPoza from './pages/EditarPoza';
import GalponDetalle from './pages/GalponDetalle';
import Galpones from './pages/Galpones';
import ModoInicio from './pages/ModoInicio';
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
        <Route path="/trabajo/conflictos" element={<ConflictosTrabajo />} />
        <Route path="/galpones/nuevo" element={<CrearGalpon />} />
        <Route path="/galpones/:id" element={<GalponDetalle />} />
        <Route path="/trabajo/galpones/:id" element={<GalponDetalle mode="trabajo" />} />
        <Route path="/galpones/:id/editar" element={<EditarGalpon />} />
        <Route path="/galpones/:id/pozas/nueva" element={<CrearPoza />} />
        <Route path="/galpones/:id/pozas/:pozaId/editar" element={<EditarPoza />} />
        <Route path="/sqlite-poc" element={<SqlitePoc />} />
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
