// Aguardar o Firebase carregar
document.addEventListener('DOMContentLoaded', function () {
  console.log('Iniciando Firebase...');

  // Suas configurações
  const firebaseConfig = {
    apiKey: "AIzaSyDyyEsEPJjCw3YAprH03OlWlovATy4SAFI",
    authDomain: "palletsystem-6ff16.firebaseapp.com",
    projectId: "palletsystem-6ff16",
    storageBucket: "palletsystem-6ff16.firebasestorage.app",
    messagingSenderId: "395589767694",
    appId: "1:395589767694:web:59e6797705a3e89fdca25f"
  };

  // Inicializar
  firebase.initializeApp(firebaseConfig);

  // Criar db e disponibilizar globalmente
  window.db = firebase.firestore();

  console.log('✅ Firebase conectado!');
});
