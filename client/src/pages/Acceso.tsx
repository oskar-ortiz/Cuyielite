import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useCallback, useState } from 'react';

import { ConnectivityChip, InlineNotice, ModeChip, PageFrame, PageIntro, SectionCard } from '../components/AppUi';
import { AUTH_MODE } from '../data/api.config';
import { changePassword, initializeAuthSession, login, logout, snapshot } from '../data/auth.session';
import type { AuthSnapshot } from '../data/auth.types';

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
      <IonContent fullscreen className="app-content">
        <PageFrame narrow>
          <PageIntro
            eyebrow="Base de trabajo"
            title="Acceso"
            description="Inicia sesión con tu cuenta personal. El dispositivo y el ámbito del centro se conservan."
          />
          <div className="context-bar">
            <div className="context-status">
              <ModeChip work readOnly={!auth.user} />
              <ConnectivityChip online={online} />
              <IonChip color={auth.role === 'admin' ? 'success' : 'medium'}>{roleLabel}</IonChip>
            </div>
          </div>

          {AUTH_MODE === 'lab' ? (
            <SectionCard title="Modo laboratorio">
              <p>
                Esta compilación usa el token de laboratorio. El acceso de piloto se habilita con
                <code> VITE_AUTH_MODE=pilot </code>y un backend con autenticación configurada.
              </p>
              <IonButton routerLink="/trabajo/sincronizacion">Ir a sincronización</IonButton>
            </SectionCard>
          ) : (
            <>
              {error && (
                <InlineNotice tone="danger" role="alert">
                  {error}
                </InlineNotice>
              )}
              {notice && (
                <InlineNotice tone="success" role="status">
                  {notice}
                </InlineNotice>
              )}

              {auth.user ? (
                <SectionCard title="Sesión activa">
                  <dl className="data-list">
                    <div>
                      <dt>Cuenta</dt>
                      <dd>{auth.user.username}</dd>
                    </div>
                    <div>
                      <dt>Rol</dt>
                      <dd>{roleLabel}</dd>
                    </div>
                    <div>
                      <dt>Ámbito</dt>
                      <dd>{auth.scopeId}</dd>
                    </div>
                    <div>
                      <dt>Instalación</dt>
                      <dd>{auth.deviceId?.slice(0, 8)}</dd>
                    </div>
                    <div>
                      <dt>Vigencia offline</dt>
                      <dd>{auth.offlineUntil ? new Date(auth.offlineUntil).toLocaleString() : 'Sin dato'}</dd>
                    </div>
                  </dl>
                  <p className="texto-ayuda">
                    El cierre de sesión no borra filas, cursores, recibos ni outbox. Cambiar de cuenta conserva el mismo
                    dispositivo y ámbito.
                  </p>
                  <div className="form-actions">
                    <IonButton onClick={submitLogout} disabled={loading}>
                      {loading ? 'Cerrando…' : 'Cerrar sesión / cambiar usuario'}
                    </IonButton>
                    <IonButton fill="outline" routerLink="/trabajo/galpones">
                      Continuar en Trabajo
                    </IonButton>
                    <IonButton fill="outline" routerLink="/trabajo/sincronizacion">
                      Ir a sincronización
                    </IonButton>
                  </div>

                  <h2>Cambiar contraseña</h2>
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitPassword();
                    }}
                  >
                    <IonInput
                      label="Contraseña actual"
                      labelPlacement="stacked"
                      fill="outline"
                      type="password"
                      autocomplete="current-password"
                      value={currentPassword}
                      onIonInput={(event) => setCurrentPassword(event.detail.value ?? '')}
                      disabled={loading}
                    />
                    <IonInput
                      label="Contraseña nueva (mínimo 12)"
                      labelPlacement="stacked"
                      fill="outline"
                      type="password"
                      autocomplete="new-password"
                      value={newPassword}
                      onIonInput={(event) => setNewPassword(event.detail.value ?? '')}
                      disabled={loading}
                    />
                    <div className="form-actions">
                      <IonButton type="submit" disabled={loading}>
                        {loading ? 'Actualizando…' : 'Actualizar contraseña'}
                      </IonButton>
                    </div>
                  </form>
                </SectionCard>
              ) : (
                <SectionCard title="Iniciar sesión">
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitLogin();
                    }}
                  >
                    <p>Usa tu cuenta personal. El dispositivo y el ámbito del Centro Lope se conservan.</p>
                    <IonInput
                      label="Usuario"
                      labelPlacement="stacked"
                      fill="outline"
                      autocomplete="username"
                      value={username}
                      onIonInput={(event) => setUsername(event.detail.value ?? '')}
                      disabled={loading}
                      required
                    />
                    <IonInput
                      label="Contraseña"
                      labelPlacement="stacked"
                      fill="outline"
                      type="password"
                      autocomplete="current-password"
                      value={password}
                      onIonInput={(event) => setPassword(event.detail.value ?? '')}
                      disabled={loading}
                      required
                    />
                    <p className="texto-ayuda">
                      Sin sesión, Trabajo queda en modo consulta y la outbox no se envía. El administrador puede
                      restablecer una contraseña; no hay registro público.
                    </p>
                    <div className="form-actions">
                      <IonButton type="submit" disabled={loading || !username || !password}>
                        {loading ? 'Ingresando…' : 'Ingresar'}
                      </IonButton>
                    </div>
                  </form>
                </SectionCard>
              )}
            </>
          )}
        </PageFrame>
      </IonContent>
    </IonPage>
  );
};

export default Acceso;
