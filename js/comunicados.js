// ===============================
// 📢 MÓDULO DE COMUNICADOS
// ===============================

import { auth, db } from "./firebaseconfig.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =====================================
// 🔹 ELEMENTOS DEL DOM
// =====================================
const form = document.getElementById("form-comunicado");
const listaComunicados = document.getElementById("lista-comunicados");
const formularioSection = document.getElementById("formulario-section");

// Modal del HTML
const modalEditar = document.getElementById("modalEditar");
const nuevoTexto = document.getElementById("nuevoTexto");
const btnGuardarCambios = document.getElementById("guardarCambios");
const btnCancelarEdicion = document.getElementById("cancelarEdicion");

let idComunicadoEditando = null;

// =====================================
// 🔹 CACHE LOCAL
// =====================================
let cacheComunicados = [];
let ultimoCache = 0;

if (localStorage.getItem("comunicados_cache")) {
  const data = JSON.parse(localStorage.getItem("comunicados_cache"));
  cacheComunicados = data.comunicados || [];
  ultimoCache = data.timestamp || 0;
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

  const storedUser = JSON.parse(localStorage.getItem("usuario"));

  if (storedUser?.rol) {
    controlarAccesos(storedUser.rol);
  }

  iniciarLecturaComunicados();
});

// =====================================
// 🔹 ACCESO POR ROL
// =====================================
function controlarAccesos(rol) {
  if (rol === "Administrativo" || rol === "Subdirector") {
    formularioSection.classList.remove("oculto");
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
        <span class="fecha">📅 ${item.fecha}</span>
      </div>
      <div class="acciones">
        <button class="edit-btn">✏️</button>
        <button class="delete-btn">🗑️</button>
      </div>
    `;

    div.querySelector(".edit-btn").onclick = () => abrirModalEdicion(item);
    div.querySelector(".delete-btn").onclick = () =>
      eliminarComunicado(item.id);

    listaComunicados.appendChild(div);
  });
}

// =====================================
// 🔹 AGREGAR COMUNICADO
// =====================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

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
// 🔹 ABRIR MODAL DE EDICIÓN
// =====================================
function abrirModalEdicion(comunicado) {
  idComunicadoEditando = comunicado.id;

  nuevoTexto.value =
    `Título: ${comunicado.titulo}\n\nDescripción:\n${comunicado.descripcion}\n\nFecha: ${comunicado.fecha}`;

  modalEditar.style.display = "flex";
}

// =====================================
// 🔹 GUARDAR CAMBIOS
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

  modalEditar.style.display = "none";
};

// =====================================
// 🔹 CANCELAR
// =====================================
btnCancelarEdicion.onclick = () => {
  modalEditar.style.display = "none";
};
