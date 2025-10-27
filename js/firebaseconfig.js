
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

//plataforma-web-institucional: Firebase web app
const firebaseconfig = {
  apiKey: "AIzaSyB9eqw-2YIGJpUviADaDWiG4CSNzi8N884",
  authDomain: "plataforma-institucional-81007.firebaseapp.com",
  projectId: "plataforma-institucional-81007",
  storageBucket: "plataforma-institucional-81007.firebasestorage.app",
  messagingSenderId: "854008391583",
  appId: "1:854008391583:web:ee3df4ad2d79701fc77faa"
};
// Inicializa Firebase
const app = initializeApp(firebaseconfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Exportar servicios para otros scripts
export { app, auth, db };

