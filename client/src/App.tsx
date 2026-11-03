import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Navigate, Route } from 'react-router-dom';

import CrearGalpon from './pages/CrearGalpon';
import CrearPoza from './pages/CrearPoza';
import GalponDetalle from './pages/GalponDetalle';
import Galpones from './pages/Galpones';
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
        <Route path="/" element={<Navigate to="/galpones" replace />} />
        <Route path="/galpones" element={<Galpones />} />
        <Route path="/galpones/nuevo" element={<CrearGalpon />} />
        <Route path="/galpones/:id" element={<GalponDetalle />} />
        <Route path="/galpones/:id/pozas/nueva" element={<CrearPoza />} />
        <Route path="/sqlite-poc" element={<SqlitePoc />} />
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
