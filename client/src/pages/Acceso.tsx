import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useState } from 'react';

import { AUTH_MODE } from '../data/api.config';
import { changePassword, initializeAuthSession, login, logout, snapshot } from '../data/auth.session';
import type { AuthSnapshot } from '../data/auth.types';
import './galpones.css';

const Acceso: React.FC = () => {
  const [auth, setAuth] = useState<AuthSnapshot>(() => snapshot());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  const load = useCallback(() => {
    setOnline(navigator.onLine);
    initializeAuthSession()
      .then(() => setAuth(snapshot()))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  useIonViewWillEnter(() => load());

  const submitLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const next = await login(username, password);
      setAuth(next);
      setPassword('');
      setNotice('Sesión iniciada. La base de Trabajo, el dispositivo y el ámbito no cambiaron.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  const submitLogout = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await logout();
      setAuth(snapshot());
      setUsername('');
      setPassword('');
      setNotice('Sesión cerrada. Los datos locales y la outbox se conservaron.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await changePassword(currentPassword, newPassword);
      setAuth(snapshot());
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Contraseña actualizada. Inicia sesión de nuevo.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = auth.role === 'admin' ? 'Administrador' : auth.role === 'viewer' ? 'Consulta' : 'Sin sesión';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/trabajo/galpones" text="Trabajo" />
          </IonButtons>
          <IonTitle>Acceso · Trabajo</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="marcado-demo">
          <IonChip color="primary">Base de trabajo</IonChip>
          {!online && <IonChip color="warning">Sin conexión</IonChip>}
          <IonChip color={auth.role === 'admin' ? 'success' : 'medium'}>{roleLabel}</IonChip>
        </div>

        {AUTH_MODE === 'lab' ? (
          <section>
            <h1>Modo laboratorio</h1>
            <p>
              Esta compilación usa el token de laboratorio. El acceso de piloto se habilita con
              <code> VITE_AUTH_MODE=pilot </code>y un backend con autenticación configurada.
            </p>
            <IonButton routerLink="/trabajo/sincronizacion">Ir a sincronización</IonButton>
          </section>
        ) : (
          <>
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}

            {auth.user ? (
              <section aria-label="Sesión actual">
                <h1>Sesión activa</h1>
                <IonList>
                  <IonItem>
                    <IonLabel>Cuenta</IonLabel>
                    <IonLabel slot="end">{auth.user.username}</IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Rol</IonLabel>
                    <IonLabel slot="end">{roleLabel}</IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Ámbito</IonLabel>
                    <IonLabel slot="end">{auth.scopeId}</IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Instalación</IonLabel>
                    <IonLabel slot="end">{auth.deviceId?.slice(0, 8)}</IonLabel>
                  </IonItem>
                  <IonItem>
                    <IonLabel>Vigencia offline</IonLabel>
                    <IonLabel slot="end">
                      {auth.offlineUntil ? new Date(auth.offlineUntil).toLocaleString() : 'Sin dato'}
                    </IonLabel>
                  </IonItem>
                </IonList>
                <p className="texto-ayuda">
                  El cierre de sesión no borra filas, cursores, recibos ni outbox. Cambiar de cuenta conserva el mismo
                  dispositivo y ámbito.
                </p>
                <IonButton onClick={submitLogout} disabled={loading}>
                  Cerrar sesión / cambiar usuario
                </IonButton>
                <IonButton fill="outline" routerLink="/trabajo/galpones">
                  Continuar en Trabajo
                </IonButton>
                <IonButton fill="outline" routerLink="/trabajo/sincronizacion">
                  Ir a sincronización
                </IonButton>

                <h2>Cambiar contraseña</h2>
                <IonInput
                  label="Contraseña actual"
                  type="password"
                  value={currentPassword}
                  onIonInput={(event) => setCurrentPassword(event.detail.value ?? '')}
                />
                <IonInput
                  label="Contraseña nueva (mínimo 12)"
                  type="password"
                  value={newPassword}
                  onIonInput={(event) => setNewPassword(event.detail.value ?? '')}
                />
                <IonButton fill="outline" onClick={submitPassword} disabled={loading}>
                  Actualizar contraseña
                </IonButton>
              </section>
            ) : (
              <section aria-label="Iniciar sesión">
                <h1>Iniciar sesión</h1>
                <p>Usa tu cuenta personal. El dispositivo y el ámbito del Centro Lope se conservan.</p>
                <IonInput
                  label="Usuario"
                  autocomplete="username"
                  value={username}
                  onIonInput={(event) => setUsername(event.detail.value ?? '')}
                />
                <IonInput
                  label="Contraseña"
                  type="password"
                  autocomplete="current-password"
                  value={password}
                  onIonInput={(event) => setPassword(event.detail.value ?? '')}
                />
                <IonButton expand="block" onClick={submitLogin} disabled={loading || !username || !password}>
                  {loading ? 'Ingresando…' : 'Ingresar'}
                </IonButton>
                <p className="texto-ayuda">
                  Sin sesión, Trabajo queda en modo consulta y la outbox no se envía. El administrador puede restablecer
                  una contraseña; no hay registro público.
                </p>
              </section>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Acceso;
