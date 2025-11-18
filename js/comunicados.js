// ===============================
// 📢 MÓDULO DE COMUNICADOS (ACTUALIZADO FINAL)
// ===============================

import { auth, db } from "./firebaseconfig.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =====================================
// 🔹 ELEMENTOS DEL DOM
// =====================================
const form = document.getElementById("form-comunicado");
const listaComunicados = document.getElementById("lista-comunicados");
const formularioSection = document.getElementById("formulario-section");

// Modal
const modalEditar = document.getElementById("modalEditar");
const nuevoTexto = document.getElementById("nuevoTexto");
const btnGuardarCambios = document.getElementById("guardarCambios");
const btnCancelarEdicion = document.getElementById("cancelarEdicion");

let idComunicadoEditando = null;
let rolUsuario = null;

// =====================================
// 🔹 CACHE LOCAL
// =====================================
let cacheComunicados = [];

if (localStorage.getItem("comunicados_cache")) {
  const data = JSON.parse(localStorage.getItem("comunicados_cache"));
  cacheComunicados = data.comunicados || [];
  renderizarComunicados(cacheComunicados);
}

// =====================================
// 🔹 DETECTAR USUARIO Y ROL
// =====================================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Obtener rol desde Firestore
  const snap = await getDoc(doc(db, "usuarios", user.uid));

  if (snap.exists()) {
    rolUsuario = snap.data().rol;
    controlarAccesos(rolUsuario);
  }

  iniciarLecturaComunicados();
});

// =====================================
// 🔹 CONTROL DE ACCESO
// =====================================
function controlarAccesos(rol) {
  if (rol === "Administrativo" || rol === "Subdirector") {
    formularioSection.classList.remove("oculto");
  } else {
    formularioSection.classList.add("oculto");
  }
}

// =====================================
// 🔹 LECTURA AUTOMÁTICA FIRESTORE
// =====================================
function iniciarLecturaComunicados() {
  const ref = collection(db, "comunicados");

  onSnapshot(ref, (snapshot) => {
    const nuevos = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    // Ordenar por fecha
    nuevos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    cacheComunicados = nuevos;
    renderizarComunicados(cacheComunicados);

    localStorage.setItem(
      "comunicados_cache",
      JSON.stringify({ comunicados: nuevos, timestamp: Date.now() })
    );
  });
}

// =====================================
// 🔹 RENDERIZAR COMUNICADOS
// =====================================
function renderizarComunicados(lista) {
  listaComunicados.innerHTML = "";

  if (lista.length === 0) {
    listaComunicados.innerHTML = "<p class='vacio'>No hay comunicados aún.</p>";
    return;
  }

  lista.forEach((item) => {
    const div = document.createElement("div");
    div.className = "comunicado";

    div.innerHTML = `
      <div class="contenido">
        <h3>${item.titulo}</h3>
        <p>${item.descripcion}</p>
        <span class="fecha">📅 ${item.fecha}</span><br>
        <span class="creado">👤 Creado por: ${item.creadoPor || "Desconocido"}</span>
      </div>

      <div class="acciones">
        ${
          rolUsuario === "Administrativo" || rolUsuario === "Subdirector"
            ? `
           <button class="edit-btn">✏️</button>
           <button class="delete-btn">🗑️</button>
        `
            : ""
        }
      </div>
    `;

    // Solo permitir editar/eliminar a roles autorizados
    if (rolUsuario === "Administrativo" || rolUsuario === "Subdirector") {
      div.querySelector(".edit-btn").onclick = () => abrirModalEdicion(item);
      div.querySelector(".delete-btn").onclick = () => eliminarComunicado(item.id);
    }

    listaComunicados.appendChild(div);
  });
}

// =====================================
// 🔹 AGREGAR COMUNICADO
// =====================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Solo permitir agregar si el rol es válido
  if (rolUsuario !== "Administrativo" && rolUsuario !== "Subdirector") {
    return alert("No tienes permiso para agregar comunicados.");
  }

  const titulo = form.titulo.value.trim();
  const descripcion = form.descripcion.value.trim();
  const fecha = form.fecha.value;

  if (!titulo || !descripcion || !fecha) {
    alert("Completa todos los campos");
    return;
  }

  await addDoc(collection(db, "comunicados"), {
    titulo,
    descripcion,
    fecha,
    creadoPor: auth.currentUser.email,
    fechaRegistro: serverTimestamp()
  });

  form.reset();
});

// =====================================
// 🔹 ELIMINAR COMUNICADO
// =====================================
async function eliminarComunicado(id) {
  if (!confirm("¿Eliminar comunicado?")) return;
  await deleteDoc(doc(db, "comunicados", id));
}

// =====================================
// 🔹 ABRIR MODAL PARA EDITAR
// =====================================
function abrirModalEdicion(comunicado) {
  idComunicadoEditando = comunicado.id;

  nuevoTexto.value =
    `Título: ${comunicado.titulo}\n\n` +
    `Descripción:\n${comunicado.descripcion}\n\n` +
    `Fecha: ${comunicado.fecha}`;

  modalEditar.classList.add("mostrar");
}

// =====================================
// 🔹 GUARDAR EDICIÓN
// =====================================
btnGuardarCambios.onclick = async () => {
  if (!idComunicadoEditando) return;

  const texto = nuevoTexto.value.trim();
  if (!texto) return alert("El comunicado no puede quedar vacío.");

  const lineas = texto.split("\n");

  const titulo = lineas[0].replace("Título: ", "").trim();
  const descripcion = lineas[2].trim();
  const fecha = lineas[4].replace("Fecha: ", "").trim();

  await updateDoc(doc(db, "comunicados", idComunicadoEditando), {
    titulo,
    descripcion,
    fecha
  });

  modalEditar.classList.remove("mostrar");
};

// =====================================
// 🔹 CANCELAR EDICIÓN
// =====================================
btnCancelarEdicion.onclick = () => {
  modalEditar.classList.remove("mostrar");
};
