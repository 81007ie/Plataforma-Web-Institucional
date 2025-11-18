// ===============================
// perfil.js FINAL (VERSIÓN ESTABLE)
// ===============================
import { auth, db } from "./firebaseconfig.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ==================================================
// DOM
// ==================================================
const main = document.getElementById("main-content");
const modal = document.getElementById("modal-usuario");

const nombreInput = document.getElementById("nombre-input");
const correoInput = document.getElementById("correo-input");
const nivelInput = document.getElementById("nivel-input");
const gradoInput = document.getElementById("grado-input");

const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");

// ==================================================
// Variables
// ==================================================
let cacheUsuarios = [];
let cacheComunicados = [];

let usuarioActual = null;
let usuarioEnEdicion = null;

const LS_KEY_USUARIOS = "cacheUsuarios_perfil_v1";

// ==================================================
// PERMISOS
// ==================================================
const PERMISOS = {
  Administrativo: { verUsuarios: true, crud: true, verBuscador: true, verComunicados: "limitados" },
  Subdirector:    { verUsuarios: true, crud: false, verBuscador: true, verComunicados: "limitados" },
  Profesor:       { verUsuarios: false, crud: false, verBuscador: false, verComunicados: "limitados" },
  Auxiliar:       { verUsuarios: false, crud: false, verBuscador: false, verComunicados: "limitados" },
  Toe:            { verUsuarios: false, crud: false, verBuscador: false, verComunicados: "limitados" }
};

// ==================================================
// SMALL UTILITIES
// ==================================================
function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ==================================================
// CACHÉ LOCAL
// ==================================================
function guardarCacheUsuarios() {
  localStorage.setItem(LS_KEY_USUARIOS, JSON.stringify(cacheUsuarios));
}

function cargarCacheUsuarios() {
  const raw = localStorage.getItem(LS_KEY_USUARIOS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) || [];
  } catch {
    return null;
  }
}

// ==================================================
// AUTH
// ==================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (!snap.exists()) {
    alert("No se encontró tu perfil.");
    return;
  }

  usuarioActual = snap.data();
  prepararEventos();
  cargarVista();
});

// ==================================================
// EVENTOS GLOBALES
// ==================================================
function prepararEventos() {
  const btnCerrar = document.getElementById("btnCerrar");
  if (btnCerrar) {
    btnCerrar.onclick = async () => {
      await signOut(auth);
      localStorage.clear();
      window.location.href = "login.html";
    };
  }

  btnCancelar.onclick = cerrarModal;
  btnGuardar.onclick = guardarUsuario;
}

// ==================================================
// CARGAR VISTA PRINCIPAL
// ==================================================
async function cargarVista() {
  main.innerHTML = `
    <h1>Perfil</h1>

    <div class="perfil-box">
      <p><strong>Nombre:</strong> ${escapeHtml(usuarioActual.nombre)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(usuarioActual.correo)}</p>
      <p><strong>Rol:</strong> ${escapeHtml(usuarioActual.rol)}</p>
    </div>
  `;

  const permisos = PERMISOS[usuarioActual.rol];

  if (permisos.verUsuarios) {
    await cargarUsuarios(permisos);
  }

  await cargarComunicados(permisos.verComunicados);
}

// ==================================================
// CARGAR USUARIOS
// ==================================================
async function cargarUsuarios(permisos) {
  main.innerHTML += `
    <h2>Lista de Usuarios</h2>

    ${permisos.verBuscador ? `<input id="buscador" class="input-buscar" type="text" placeholder="Buscar usuarios...">` : ""}

    <table class="tabla">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Rol</th>
          <th>Nivel</th>
          <th>Grado</th>
          ${permisos.crud ? "<th>Acciones</th>" : ""}
        </tr>
      </thead>
      <tbody id="tablaUsuarios"></tbody>
    </table>
  `;

  // 1. cargar cache del localStorage
  const local = cargarCacheUsuarios();
  if (local?.length) {
    cacheUsuarios = local;
    renderUsuarios(cacheUsuarios, permisos);
  }

  // 2. obtener Firestore (sea primera carga o refresco)
  const snap = await getDocs(collection(db, "usuarios"));
  cacheUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  guardarCacheUsuarios();
  renderUsuarios(cacheUsuarios, permisos);

  // 3. activamos el buscador
  if (permisos.verBuscador) activarBuscador(permisos);
}

// ==================================================
// BUSCADOR
// ==================================================
function activarBuscador(permisos) {
  const input = document.getElementById("buscador");
  if (!input) return;

  const filtrar = debounce((txt) => {
    txt = txt.toLowerCase().trim();

    if (!txt)
      return renderUsuarios(cacheUsuarios, permisos);

    const resultado = cacheUsuarios.filter(u =>
      (u.nombre || "").toLowerCase().includes(txt) ||
      (u.correo || "").toLowerCase().includes(txt) ||
      (u.rol || "").toLowerCase().includes(txt) ||
      (u.nivel || "").toLowerCase().includes(txt)
    );

    renderUsuarios(resultado, permisos);
  }, 200);

  input.addEventListener("input", (e) => filtrar(e.target.value));
}

// ==================================================
// RENDER USUARIOS
// ==================================================
function renderUsuarios(lista, permisos) {
  const tbody = document.getElementById("tablaUsuarios");
  tbody.innerHTML = "";

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="${permisos.crud ? 6 : 5}" style="text-align:center">No hay usuarios</td></tr>`;
    return;
  }

  lista.forEach(u => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(u.nombre)}</td>
      <td>${escapeHtml(u.correo)}</td>
      <td>${escapeHtml(u.rol)}</td>
      <td>${escapeHtml(u.nivel || "-")}</td>
      <td>${escapeHtml(u.grado || "-")}</td>
      ${permisos.crud ? `
        <td>
          <button class="btn-edit" data-id="${u.id}">Editar</button>
          <button class="btn-delete" data-id="${u.id}">Eliminar</button>
        </td>
      ` : ""}
    `;

    tbody.appendChild(tr);
  });

  if (permisos.crud) bindCrudBotones(permisos);
}

// ==================================================
// EVENTOS CRUD
// ==================================================
function bindCrudBotones(permisos) {
  document.querySelectorAll(".btn-edit").forEach(btn => {
    btn.onclick = () => abrirModal(btn.dataset.id);
  });

  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = () => eliminarUsuario(btn.dataset.id, permisos);
  });
}

// ==================================================
// MODAL EDITAR
// ==================================================
function abrirModal(id) {
  usuarioEnEdicion = cacheUsuarios.find(u => u.id === id);
  if (!usuarioEnEdicion) return alert("Usuario no encontrado");

  nombreInput.value = usuarioEnEdicion.nombre || "";
  correoInput.value = usuarioEnEdicion.correo || "";
  nivelInput.value = usuarioEnEdicion.nivel || "";
  gradoInput.value = usuarioEnEdicion.grado || "";

  modal.style.display = "flex";
}

function cerrarModal() {
  modal.style.display = "none";
}

// ==================================================
// GUARDAR EDITAR
// ==================================================
async function guardarUsuario() {
  const ref = doc(db, "usuarios", usuarioEnEdicion.id);

  await updateDoc(ref, {
    nombre: nombreInput.value,
    correo: correoInput.value,
    nivel: nivelInput.value,
    grado: gradoInput.value
  });

  // actualizar cache local
  Object.assign(usuarioEnEdicion, {
    nombre: nombreInput.value,
    correo: correoInput.value,
    nivel: nivelInput.value,
    grado: gradoInput.value
  });

  guardarCacheUsuarios();

  const permisos = PERMISOS[usuarioActual.rol];
  renderUsuarios(cacheUsuarios, permisos);

  cerrarModal();
}

// ==================================================
// ELIMINAR USUARIO
// ==================================================
async function eliminarUsuario(id, permisos) {
  if (!confirm("¿Eliminar usuario?")) return;

  await deleteDoc(doc(db, "usuarios", id));

  cacheUsuarios = cacheUsuarios.filter(u => u.id !== id);
  guardarCacheUsuarios();

  renderUsuarios(cacheUsuarios, permisos);
}

// ==================================================
// COMUNICADOS
// ==================================================
async function cargarComunicados(tipo) {
  main.innerHTML += `
    <h2>Comunicados</h2>
    <table class="tabla">
      <thead>
        <tr>
          <th>Título</th>
          <th>Descripción</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody id="tablaComunicados"></tbody>
    </table>
  `;

  if (!cacheComunicados.length) {
    const snap = await getDocs(query(collection(db, "comunicados"), orderBy("fecha", "desc")));
    cacheComunicados = snap.docs.map(d => d.data());
  }

  const lista = tipo === "limitados" ? cacheComunicados.slice(0, 5) : cacheComunicados;

  const tbody = document.getElementById("tablaComunicados");
  tbody.innerHTML = "";

  lista.forEach(c => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(c.titulo)}</td>
      <td>${escapeHtml(c.descripcion)}</td>
      <td>${escapeHtml(c.fecha)}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ===============================
// FIN
// ===============================
