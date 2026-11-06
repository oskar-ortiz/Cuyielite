import { createCapacitorElectronApp } from '@capawesome/capacitor-electron';
import { app, ipcMain } from 'electron';
import config from './capacitor.electron.config';

const LAB_URL = 'http://127.0.0.1:8000';

function isLoopback(u: string): boolean {
  try {
    const url = new URL(u);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

async function labFetch(route: string, token: string, init?: RequestInit): Promise<unknown> {
  const url = LAB_URL + route;
  if (!isLoopback(url)) throw new Error('Destino fuera de loopback');
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    redirect: 'error',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

ipcMain.handle('sync:context', async (_event, token: string) => labFetch('/sync/context', token));
ipcMain.handle('sync:push', async (_event, token: string, body: unknown) =>
  labFetch('/sync/push', token, { method: 'POST', body: JSON.stringify(body) }),
);

createCapacitorElectronApp(config);
