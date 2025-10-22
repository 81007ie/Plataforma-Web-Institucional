import { auth, db } from "./firebaseconfig.js"; 
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const formRegistro = document.getElementById("formRegistro");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

// 👁️ Mostrar/ocultar contraseña
togglePassword.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  togglePassword.textContent = type === "password" ? "MOSTRAR" : "OCULTAR";
});

// 📝 Registrar usuario
formRegistro.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value.trim();
  const grado = document.getElementById("grado").value.trim() || "";
  const nivel = document.getElementById("nivel").value;
  const correo = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (password.length < 6) {
    alert("⚠️ La contraseña debe tener al menos 6 caracteres");
    return;
  }

  try {
    // Crear usuario en Auth
    const userCredential = await createUserWithEmailAndPassword(auth, correo, password);
    const user = userCredential.user;

    // Actualizar nombre de perfil
    await updateProfile(user, { displayName: nombre });

    // Guardar en Firestore
    await setDoc(doc(db, "usuarios", user.uid), {
      uid: user.uid,
      nombre,
      correo,
      rol: "Profesor", // por defecto
      grado,
      nivel,
      fechaRegistro: serverTimestamp()
    });

    alert("✅ Registro exitoso. Ahora puedes iniciar sesión.");
    window.location.href = "login.html";

  } catch (error) {
    console.error("Error en el registro:", error);
    let mensaje = "Ocurrió un error al registrarte.";
    if (error.code === "auth/email-already-in-use") mensaje = "⚠️ Este correo ya está registrado.";
    else if (error.code === "auth/invalid-email") mensaje = "⚠️ Correo inválido.";
    else if (error.code === "auth/weak-password") mensaje = "⚠️ Contraseña débil.";
    alert(mensaje);
  }
});
