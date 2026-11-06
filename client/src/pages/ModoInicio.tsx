import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const ModoInicio: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>CuyiElite</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <h1>Elegir modo</h1>
      <section aria-labelledby="modo-demo">
        <h2 id="modo-demo">Demostración</h2>
        <p>Explora y edita los datos de prueba. Esta base permanece separada del trabajo.</p>
        <IonButton routerLink="/galpones">Entrar a demostración</IonButton>
      </section>
      <section aria-labelledby="modo-trabajo">
        <h2 id="modo-trabajo">Trabajo</h2>
        <p>
          Consulta la base local de trabajo. Las altas, ediciones y la sincronización llegarán en próximas entregas.
        </p>
        <IonButton routerLink="/trabajo/galpones" fill="outline">
          Entrar a trabajo
        </IonButton>
      </section>
    </IonContent>
  </IonPage>
);

export default ModoInicio;
