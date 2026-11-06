import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronSync', {
  context: (token: string) => ipcRenderer.invoke('sync:context', token),
  push: (token: string, body: unknown) => ipcRenderer.invoke('sync:push', token, body),
});
