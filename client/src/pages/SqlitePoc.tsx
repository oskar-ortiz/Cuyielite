import { registerPlugin } from '@capacitor/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import React, { useState } from 'react';

interface SqlitePocPlugin {
  saveValue(options: { value: string }): Promise<{ ok: boolean }>;
  readValue(): Promise<{ value: string | null }>;
}

const SqlitePocPlugin = registerPlugin<SqlitePocPlugin>('SqlitePoc');

const SqlitePoc: React.FC = () => {
  const [saved, setSaved] = useState<string | null>(null);
  const [read, setRead] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('sin probar');

  const generateValue = () => 'poc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const save = async () => {
    const value = generateValue();
    try {
      const r = await SqlitePocPlugin.saveValue({ value });
      if (r.ok) {
        setSaved(value);
        setStatus('guardado');
      } else {
        setStatus('error al guardar');
      }
    } catch (e) {
      setStatus('error: ' + String(e));
    }
  };

  const load = async () => {
    try {
      const r = await SqlitePocPlugin.readValue();
      setRead(r.value);
      setStatus('leído');
    } catch (e) {
      setStatus('error: ' + String(e));
    }
  };

  const match = saved !== null && read !== null && saved === read;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/galpones" />
          </IonButtons>
          <IonTitle>PoC SQLite</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p>Valor guardado: {saved ?? '(ninguno)'}</p>
        <p>Valor leído: {read ?? '(ninguno)'}</p>
        <p>Coinciden (solo esta ejecución): {match ? 'sí' : 'no'}</p>
        <button onClick={save}>Guardar valor</button> <button onClick={load}>Leer valor</button>
        <p>Estado: {status}</p>
      </IonContent>
    </IonPage>
  );
};

export default SqlitePoc;
