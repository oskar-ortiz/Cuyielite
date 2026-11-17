import '@capacitor/core';
import './data/sqlitePocPlugin';

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { initializeAuthSession } from './data/auth.session';

const container = document.getElementById('root');
const root = createRoot(container!);

initializeAuthSession()
  .catch(() => undefined)
  .finally(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
