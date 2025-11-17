import { auth, db } from "./firebaseconfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  doc, getDoc, collection, getDocs, query, orderBy, limit,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ============================
// 🔸 ELEMENTOS DEL DOM
// ============================
const nombreUsuario = document.getElementById("nombreUsuario");
const btnLogout = document.getElementById("btnLogout");
const listaComunicados = document.getElementById("lista-comunicados");

// ============================
// 🔸 AUTENTICACIÓN Y USUARIO
// ============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // 🔹 Intentar obtener usuario desde cache (sessionStorage)
  let userData = sessionStorage.getItem("userData");

  if (userData) {
    userData = JSON.parse(userData);
  } else {
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    if (userDoc.exists()) {
      userData = userDoc.data();
      sessionStorage.setItem("userData", JSON.stringify(userData));
    } else {
      alert("No se encontró tu información en la base de datos.");
      return;
    }
  }

  nombreUsuario.textContent = `👋 Bienvenida(o), ${userData.nombre}`;

  // 🔹 Corregido: verificación de roles
  if (["Profesor", "Auxiliar", "Toe"].includes(userData.rol)) {
    ocultarOpcionesAdmin();
  }
});

// ============================
// 🔸 CERRAR SESIÓN
// ============================
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  sessionStorage.clear(); // limpia cache temporal
  window.location.href = "login.html";
});

// ============================
// 🔸 OCULTAR OPCIONES ADMIN
// ============================
function ocultarOpcionesAdmin() {
  const botonesAdmin = document.querySelectorAll(".btn-admin, .editar, .eliminar");
  botonesAdmin.forEach(btn => btn.style.display = "none");
}

// ============================
// 🔸 CARGAR COMUNICADOS (con cache + persistencia)
// ============================
async function cargarComunicados() {
  try {
    // 1️⃣ Buscar en cache temporal (sessionStorage)
    let cache = sessionStorage.getItem("comunicados");
    if (cache) {
      renderizarComunicados(JSON.parse(cache));
      return;
    }

    // 2️⃣ Leer máximo 5 comunicados desde Firestore (usando cache offline si está disponible)
    const q = query(collection(db, "comunicados"), orderBy("fecha", "desc"), limit(5));
    const snapshot = await getDocs(q);
    const comunicados = snapshot.docs.map(doc => doc.data());

    // 3️⃣ Guardar en cache temporal
    sessionStorage.setItem("comunicados", JSON.stringify(comunicados));

    // 4️⃣ Renderizar
    renderizarComunicados(comunicados);

  } catch (error) {
    console.error("Error al cargar comunicados:", error);
    listaComunicados.innerHTML = "<li>Error al cargar comunicados.</li>";
  }
}

// ============================
// 🔸 FUNCIÓN PARA MOSTRAR COMUNICADOS
// ============================
function renderizarComunicados(comunicados) {
  listaComunicados.innerHTML = "";

  if (!comunicados || comunicados.length === 0) {
    listaComunicados.innerHTML = "<li>No hay comunicados por el momento.</li>";
    return;
  }

  comunicados.forEach(data => {
    let fechaFormateada = "";
    if (data.fecha) {
      let fechaOriginal;

      if (data.fecha.toDate) {
        fechaOriginal = data.fecha.toDate();
      } else if (data.fecha.seconds) {
        fechaOriginal = new Date(data.fecha.seconds * 1000);
      } else {
        fechaOriginal = new Date(data.fecha + "T00:00:00");
      }

      fechaFormateada = fechaOriginal.toLocaleDateString("es-PE", {
        timeZone: "America/Lima",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    const li = document.createElement("li");
    li.classList.add("comunicado-item");
    li.innerHTML = `
      <strong>${data.titulo}</strong>
      <em>${fechaFormateada}</em>
      <p>${data.descripcion}</p>
    `;
    listaComunicados.appendChild(li);
  });
}

// ============================
// 🔸 EJECUTAR AL CARGAR LA PÁGINA
// ============================
window.addEventListener("DOMContentLoaded", () => {
  cargarComunicados();
});
