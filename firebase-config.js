// Suas configurações do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDyyEsEPJjCw3YAprH03OlWlovATy4SAFI",
  authDomain: "palletsystem-6ff16.firebaseapp.com",
  projectId: "palletsystem-6ff16",
  storageBucket: "palletsystem-6ff16.firebasestorage.app",
  messagingSenderId: "395589767694",
  appId: "1:395589767694:web:59e6797705a3e89fdca25f"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Criar conexão com o banco
const db = firebase.firestore();

// Disponibilizar pra todo mundo usar
window.db = db;

console.log('✅ Firebase conectado');
