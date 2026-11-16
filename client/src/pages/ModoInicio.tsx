import { IonButton, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { briefcaseOutline, flaskOutline, lockClosedOutline, pawOutline } from 'ionicons/icons';

import { AppContent, PageFrame, PageIntro, SectionCard } from '../components/AppUi';

const ModoInicio: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>CuyiElite</IonTitle>
      </IonToolbar>
    </IonHeader>
    <AppContent>
      <PageFrame narrow>
        <div className="brand-header" aria-label="CuyiElite, gestión productiva de cuyes">
          <IonIcon className="brand-header__icon" icon={pawOutline} aria-hidden="true" />
          <div>
            <div className="brand-header__name">CuyiElite</div>
            <div className="brand-header__subtitle">Gestión productiva de cuyes</div>
          </div>
        </div>
        <PageIntro
          title="Elegir modo"
          description="Selecciona la base que vas a utilizar. Podrás cambiar de modo sin mezclar los registros."
        />
        <div className="mode-grid">
          <SectionCard className="mode-card" ariaLabel="Modo demostración">
            <IonIcon className="mode-card__icon" icon={flaskOutline} aria-hidden="true" />
            <h2 id="modo-demo">Demostración</h2>
            <p>Explora la aplicación y practica con registros de prueba. Esta base permanece separada del trabajo.</p>
            <IonButton routerLink="/galpones" fill="outline" aria-describedby="modo-demo">
              Entrar a demostración
            </IonButton>
          </SectionCard>
          <SectionCard className="mode-card" ariaLabel="Modo trabajo">
            <IonIcon className="mode-card__icon" icon={briefcaseOutline} aria-hidden="true" />
            <h2 id="modo-trabajo">Trabajo</h2>
            <p>
              Registra galpones, animales y controles productivos. Consulta localmente y sincroniza cuando lo indiques.
            </p>
            <IonButton routerLink="/trabajo/galpones" aria-describedby="modo-trabajo">
              Entrar a trabajo
            </IonButton>
          </SectionCard>
        </div>
        <p className="home-footnote">
          <IonIcon icon={lockClosedOutline} aria-hidden="true" />
          Cada modo conserva sus datos por separado.
        </p>
      </PageFrame>
    </AppContent>
  </IonPage>
);

export default ModoInicio;
