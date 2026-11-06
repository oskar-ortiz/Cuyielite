import { createCapacitorElectronApp } from '@capawesome/capacitor-electron';

import config from './capacitor.electron.config';

// El runtime de Capawesome carga su preload interno, registra los plugins del
// manifest (SqlitePoc y SyncLab) y sirve el bundle empaquetado. No se debe
// reemplazar con un BrowserWindow propio: eso omite el puente de plugins.
createCapacitorElectronApp(config);
