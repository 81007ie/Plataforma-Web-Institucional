import { auth, db } from "./firebaseconfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔹 Elementos del DOM
const nombreUsuario = document.getElementById("nombreUsuario");
const btnLogout = document.getElementById("btnLogout");
const listaComunicados = document.getElementById("lista-comunicados");

// 🔹 Detectar autenticación
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userDoc = await getDoc(doc(db, "usuarios", user.uid));

  if (userDoc.exists()) {
    const data = userDoc.data();
    nombreUsuario.textContent = `👋 Bienvenida(o), ${data.nombre}`;
    // Si es profesor, ocultar opciones de administrador
    if (data.rol === "Profesor") ocultarOpcionesAdmin();
  } else {
    alert("No se encontró tu información en la base de datos.");
  }
});

// 🔹 Cerrar sesión
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// 🔹 Función para ocultar elementos de admin
function ocultarOpcionesAdmin() {
  const botonesAdmin = document.querySelectorAll(".btn-admin, .editar, .eliminar");
  botonesAdmin.forEach(btn => btn.style.display = "none");
}

// 🔹 Función para cargar comunicados
async function cargarComunicados() {
  try {
    const q = query(collection(db, "comunicados"), orderBy("fecha", "desc"));
    const snapshot = await getDocs(q);

    listaComunicados.innerHTML = "";

    if (snapshot.empty) {
      listaComunicados.innerHTML = "<li>No hay comunicados por el momento.</li>";
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();

      // 🗓️ Ajuste correcto de fecha para zona horaria Lima (evita mostrar un día antes)
      let fechaFormateada = "";
      if (data.fecha) {
        let fechaOriginal;

        if (data.fecha.toDate) {
          // Si es Timestamp de Firestore
          fechaOriginal = data.fecha.toDate();
        } else {
          // Si es un string tipo "2025-10-16"
          fechaOriginal = new Date(data.fecha + "T00:00:00"); // Evita desfase
        }

        // Formato natural en español (ej: "16 de octubre de 2025")
        fechaFormateada = fechaOriginal.toLocaleDateString("es-PE", {
          timeZone: "America/Lima",
          day: "numeric",
          month: "long",
          year: "numeric"
        });
      }

      // 📰 Crear comunicado
      const li = document.createElement("li");
      li.classList.add("comunicado-item");
      li.innerHTML = `
        <strong>${data.titulo}</strong>
        <em>${fechaFormateada}</em>
        <p>${data.descripcion}</p>
      `;
      listaComunicados.appendChild(li);
    });

  } catch (error) {
    console.error("Error al cargar comunicados:", error);
    listaComunicados.innerHTML = "<li>Error al cargar comunicados.</li>";
  }
}

// 🔹 Ejecutar al cargar la página
window.addEventListener("DOMContentLoaded", () => {
  cargarComunicados();
});
