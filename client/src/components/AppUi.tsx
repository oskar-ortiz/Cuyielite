/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { IonButton, IonChip, IonContent, IonIcon, IonLabel, IonSpinner } from '@ionic/react';
import {
  alertCircleOutline,
  briefcaseOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
  flaskOutline,
  informationCircleOutline,
  syncOutline,
  timeOutline,
  warningOutline,
} from 'ionicons/icons';
import type { ReactNode } from 'react';

export type StatusTone = 'primary' | 'success' | 'warning' | 'danger' | 'medium';

const toneIcons = {
  primary: informationCircleOutline,
  success: checkmarkCircleOutline,
  warning: warningOutline,
  danger: alertCircleOutline,
  medium: informationCircleOutline,
};

export function PageFrame({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <main className={narrow ? 'page-frame page-frame--narrow' : 'page-frame'}>{children}</main>;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-intro">
      <div>
        {eyebrow && <p className="page-intro__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <div className="page-intro__description">{description}</div>}
      </div>
      {actions && <div className="page-intro__actions">{actions}</div>}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = '',
  ariaLabel,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section className={`section-card ${className}`.trim()} aria-label={ariaLabel}>
      {(title || description || actions) && (
        <header className="section-card__header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <div className="section-card__description">{description}</div>}
          </div>
          {actions && <div className="section-card__actions">{actions}</div>}
        </header>
      )}
      <div className="section-card__body">{children}</div>
    </section>
  );
}

export function StatusChip({
  tone = 'medium',
  icon,
  children,
}: {
  tone?: StatusTone;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <IonChip className={`status-chip status-chip--${tone}`}>
      <IonIcon icon={icon ?? toneIcons[tone]} aria-hidden="true" />
      <IonLabel>{children}</IonLabel>
    </IonChip>
  );
}

export function ModeChip({ work, readOnly = false }: { work: boolean; readOnly?: boolean }) {
  return (
    <StatusChip tone={work ? 'primary' : 'warning'} icon={work ? briefcaseOutline : flaskOutline}>
      {work ? (readOnly ? 'Base de trabajo · solo consulta' : 'Base de trabajo') : 'Datos de demostración'}
    </StatusChip>
  );
}

export function ConnectivityChip({ online }: { online: boolean }) {
  return online ? null : (
    <StatusChip tone="warning" icon={cloudOfflineOutline}>
      Sin conexión
    </StatusChip>
  );
}

export function PageState({
  kind,
  title,
  children,
  action,
}: {
  kind: 'loading' | 'empty' | 'error' | 'offline';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const icon =
    kind === 'error' ? alertCircleOutline : kind === 'offline' ? cloudOfflineOutline : informationCircleOutline;
  return (
    <div className={`page-state page-state--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' ? (
        <IonSpinner name="crescent" aria-hidden="true" />
      ) : (
        <IonIcon icon={icon} aria-hidden="true" />
      )}
      <h2>{title}</h2>
      {children && <div className="page-state__detail">{children}</div>}
      {action && <div className="page-state__action">{action}</div>}
    </div>
  );
}

export function InlineNotice({
  tone = 'primary',
  children,
  role,
}: {
  tone?: StatusTone;
  children: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div className={`inline-notice inline-notice--${tone}`} role={role}>
      <IonIcon icon={toneIcons[tone]} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function PendingChip({ count }: { count: number }) {
  return count > 0 ? (
    <StatusChip tone="warning" icon={timeOutline}>
      {count === 1 ? '1 cambio pendiente' : `${count} cambios pendientes`}
    </StatusChip>
  ) : null;
}

export function SyncChip({ count }: { count: number }) {
  return count > 0 ? (
    <StatusChip tone="primary" icon={syncOutline}>
      {count === 1 ? '1 cambio por enviar' : `${count} cambios por enviar`}
    </StatusChip>
  ) : null;
}

export function FieldErrors({ id, errors }: { id?: string; errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div id={id} className="field-errors" role="alert">
      {errors.map((error, index) => (
        <p key={`${index}-${error}`}>
          <IonIcon icon={alertCircleOutline} aria-hidden="true" />
          {error}
        </p>
      ))}
    </div>
  );
}

export function FormActions({
  saving,
  label = 'Guardar',
  cancel,
}: {
  saving: boolean;
  label?: string;
  cancel?: ReactNode;
}) {
  return (
    <div className="form-actions">
      {cancel}
      <IonButton type="submit" disabled={saving} aria-busy={saving}>
        {saving ? (
          <>
            <IonSpinner name="dots" aria-hidden="true" /> Guardando…
          </>
        ) : (
          label
        )}
      </IonButton>
    </div>
  );
}

export function AppContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <IonContent fullscreen className={`app-content ${className}`.trim()}>
      {children}
    </IonContent>
  );
}
