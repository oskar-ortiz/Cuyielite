import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

import './Home.css';

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>CuyiElite</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">CuyiElite</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div id="container">
          <strong>CuyiElite</strong>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
