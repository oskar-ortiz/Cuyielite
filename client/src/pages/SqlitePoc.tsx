import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import React, { useState } from 'react';

import { SqlitePoc } from '../data/sqlitePocPlugin';

const sqlite = new SQLiteConnection(CapacitorSQLite);

async function androidSave(value: string): Promise<boolean> {
  const db: SQLiteDBConnection = await sqlite.createConnection('poc', false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('CREATE TABLE IF NOT EXISTS poc (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  await db.run('INSERT INTO poc (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    'poc',
    value,
  ]);
  await db.close();
  await sqlite.closeConnection('poc', false);
  return true;
}

async function androidRead(): Promise<string | null> {
  const db: SQLiteDBConnection = await sqlite.createConnection('poc', false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('CREATE TABLE IF NOT EXISTS poc (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const res = await db.query('SELECT value FROM poc WHERE key = ?', ['poc']);
  await db.close();
  await sqlite.closeConnection('poc', false);
  const rows = res.values ?? [];
  return rows.length ? (rows[0].value as string) : null;
}

const isAndroid = Capacitor.getPlatform() === 'android';

const SqlitePocPage: React.FC = () => {
  const [saved, setSaved] = useState<string | null>(null);
  const [read, setRead] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('sin probar');

  const generateValue = () => 'poc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const save = async () => {
    const value = generateValue();
    try {
      let ok = false;
      if (isAndroid) {
        ok = await androidSave(value);
      } else {
        const r = await SqlitePoc.saveValue({ value });
        ok = r.ok;
      }
      if (ok) {
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
      let value: string | null = null;
      if (isAndroid) {
        value = await androidRead();
      } else {
        const r = await SqlitePoc.readValue();
        value = r.value;
      }
      setRead(value);
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

export default SqlitePocPage;
