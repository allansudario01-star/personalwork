// Configuração do Firebase com script tags (não module)
const firebaseConfig = {
  apiKey: "AIzaSyDyyEsEPJjCw3YAprH03OlWlovATy4SAFI",
  authDomain: "palletsystem-6ff16.firebaseapp.com",
  projectId: "palletsystem-6ff16",
  storageBucket: "palletsystem-6ff16.firebasestorage.app",
  messagingSenderId: "395589767694",
  appId: "1:395589767694:web:59e6797705a3e89fdca25f"
};

// Inicializar Firebase (versão compatível com script tags)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Habilitar persistência offline
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('Persistência falhou - múltiplas abas abertas');
    } else if (err.code == 'unimplemented') {
      console.log('Persistência não disponível');
    }
  });
