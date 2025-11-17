// ===============================
// 🧾 REGISTRO DE USUARIO
// ===============================

import { auth, db } from "./firebaseconfig.js"; 
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- Elementos del DOM ---
const formRegistro = document.getElementById("formRegistro");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");
const loader = document.getElementById("loader");

// 👁️ Mostrar / Ocultar contraseña
togglePassword.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  togglePassword.textContent = type === "password" ? "MOSTRAR" : "OCULTAR";
});

// 🔄 Mostrar / Ocultar loader
function mostrarLoader(mostrar) {
  loader.style.display = mostrar ? "flex" : "none";
}

// 📝 Registrar usuario
formRegistro.addEventListener("submit", async (e) => {
  e.preventDefault();

  // --- Obtener valores del formulario ---
  const nombre = document.getElementById("nombre").value.trim();
  const grado = document.getElementById("grado").value.trim() || "";
  const nivel = document.getElementById("nivel").value;
  const rol = document.getElementById("rol").value;
  const correo = document.getElementById("email").value.trim();
  const password = passwordInput.value.trim();

  // --- Validaciones básicas ---
  if (!nombre || !correo || !password) {
    alert("⚠️ Completa todos los campos obligatorios.");
    return;
  }
  if (password.length < 6) {
    alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  try {
    mostrarLoader(true); // Mostrar spinner

    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, correo, password);
    const user = userCredential.user;

    // Actualizar perfil del usuario con su nombre
    await updateProfile(user, { displayName: nombre });

    // Guardar datos en Firestore
    await setDoc(doc(db, "usuarios", user.uid), {
      uid: user.uid,
      nombre,
      correo,
      rol,
      grado,
      nivel,
      fechaRegistro: serverTimestamp()
    });

    mostrarLoader(false);
    alert(`✅ Registro exitoso. Bienvenido/a ${nombre}.`);
    formRegistro.reset();
    window.location.href = "login.html";

  } catch (error) {
    mostrarLoader(false);
    console.error("Error en el registro:", error);

    let mensaje = "❌ Ocurrió un error al registrarte.";
    switch (error.code) {
      case "auth/email-already-in-use":
        mensaje = "⚠️ Este correo ya está registrado.";
        break;
      case "auth/invalid-email":
        mensaje = "⚠️ El correo ingresado no es válido.";
        break;
      case "auth/weak-password":
        mensaje = "⚠️ La contraseña es demasiado débil.";
        break;
    }

    alert(mensaje);
  }
});
