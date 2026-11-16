import { Capacitor, registerPlugin } from '@capacitor/core';

import { SyncLab } from './work.sync.transport';

interface SecureSessionPlugin {
  save(options: { value: string }): Promise<{ ok: boolean }>;
  read(): Promise<{ value: string | null }>;
  clear(): Promise<{ ok: boolean }>;
}

const SecureSession = (() => {
  let plugin: SecureSessionPlugin | null = null;
  return {
    get(): SecureSessionPlugin {
      if (!plugin) plugin = registerPlugin<SecureSessionPlugin>('SecureSession');
      return plugin;
    },
  };
})();
let fallbackValue: string | null = null;

function platform(): string {
  return Capacitor.getPlatform();
}

export async function saveSecureSession(value: string): Promise<void> {
  if (platform() === 'android') {
    await SecureSession.get().save({ value });
    return;
  }
  if (platform() === 'electron') {
    await SyncLab.authSessionSave({ value });
    return;
  }
  // Navegador de pruebas/desarrollo: no se usa localStorage ni SQLite.
  fallbackValue = value;
}

export async function readSecureSession(): Promise<string | null> {
  if (platform() === 'android') {
    return (await SecureSession.get().read()).value;
  }
  if (platform() === 'electron') {
    return (await SyncLab.authSessionRead()).value;
  }
  return fallbackValue;
}

export async function clearSecureSession(): Promise<void> {
  if (platform() === 'android') {
    await SecureSession.get().clear();
    return;
  }
  if (platform() === 'electron') {
    await SyncLab.authSessionClear();
    return;
  }
  fallbackValue = null;
}

export function resetSecureSessionForTests(): void {
  fallbackValue = null;
}
