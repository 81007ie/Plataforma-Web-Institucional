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

// =========================
// DOM
// =========================
const main = document.getElementById("main-content");
const modal = document.getElementById("modal-usuario");

const nombreInput = document.getElementById("nombre-input");
const correoInput = document.getElementById("correo-input");
const nivelInput = document.getElementById("nivel-input");
const gradoInput = document.getElementById("grado-input");

const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");

// =========================
let cacheUsuarios = [];
let cacheComunicados = [];
let usuarioActual = null;
let usuarioEnEdicion = null;

// =========================
// ROLES Y PERMISOS
// =========================
const PERMISOS = {
  Administrativo: {
    verUsuarios: true,
    crud: true,
    verBuscador: true,
    verComunicados: "todos"
  },
  Subdirector: {
    verUsuarios: true,
    crud: false,
    verBuscador: true,
    verComunicados: "todos"
  },
  Profesor: {
    verUsuarios: false,
    crud: false,
    verBuscador: false,
    verComunicados: "limitados"
  },
  Auxiliar: {
    verUsuarios: false,
    crud: false,
    verBuscador: false,
    verComunicados: "limitados"
  },
  Toe: {
    verUsuarios: false,
    crud: false,
    verBuscador: false,
    verComunicados: "limitados"
  }
};

// =========================
// AUTENTICACIÓN
// =========================
onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (!snap.exists()) return alert("No se encontró tu perfil");

  usuarioActual = snap.data();

  cargarVista();
  prepararBotones();
});

// =========================
// CONFIGURAR EVENTOS
// =========================
function prepararBotones() {
  document.getElementById("btnCerrar").onclick = async () => {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "login.html";
  };

  btnCancelar.onclick = () => cerrarModal();
  btnGuardar.onclick = () => guardarUsuario();
}

// =========================
// CARGAR VISTA SEGÚN ROL
// =========================
async function cargarVista() {
  const permisos = PERMISOS[usuarioActual.rol];

  // PERFIL
  main.innerHTML = `
    <h1>Perfil</h1>
    <div class="perfil-box">
      <p><strong>Nombre:</strong> ${usuarioActual.nombre}</p>
      <p><strong>Correo:</strong> ${usuarioActual.correo}</p>
      <p><strong>Rol:</strong> ${usuarioActual.rol}</p>
    </div>
  `;

  if (permisos.verUsuarios) await cargarUsuarios(permisos);

  await cargarComunicados(permisos.verComunicados);
}

// =========================
// CARGAR USUARIOS
// =========================
async function cargarUsuarios(permisos) {
  main.innerHTML += `
    <h2>Lista de Usuarios</h2>

    ${permisos.verBuscador ? `
      <input id="buscador" class="input-buscar" type="text" placeholder="Buscar usuarios...">
    ` : ""}

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

  // Carga inicial desde Firestore (o IndexedDB si ya está cacheado)
  if (!cacheUsuarios.length) {
    const snap = await getDocs(collection(db, "usuarios"));
    cacheUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  renderUsuarios(cacheUsuarios, permisos);

  // =========================
  // Buscador – ahora estable (no se rompe)
  // =========================
  if (permisos.verBuscador) {
    const input = document.getElementById("buscador");
    input.addEventListener("input", (e) => {
      const txt = e.target.value.toLowerCase();

      const filtrados = cacheUsuarios.filter(u =>
        u.nombre.toLowerCase().includes(txt) ||
        u.correo.toLowerCase().includes(txt) ||
        (u.nivel || "").toLowerCase().includes(txt) ||
        (u.rol || "").toLowerCase().includes(txt)
      );

      renderUsuarios(filtrados, permisos);
    });
  }
}

// =========================
// RENDER USUARIOS
// =========================
function renderUsuarios(lista, permisos) {
  const tbody = document.getElementById("tablaUsuarios");
  tbody.innerHTML = "";

  lista.forEach(u => {
    tbody.innerHTML += `
      <tr>
        <td>${u.nombre}</td>
        <td>${u.correo}</td>
        <td>${u.rol}</td>
        <td>${u.nivel || "-"}</td>
        <td>${u.grado || "-"}</td>
        ${
          permisos.crud
            ? `<td>
                <button class="btn-edit" data-id="${u.id}">Editar</button>
                <button class="btn-delete" data-id="${u.id}">Eliminar</button>
              </td>`
            : ""
        }
      </tr>
    `;
  });

  if (permisos.crud) {
    // Botón editar
    document.querySelectorAll(".btn-edit").forEach(btn => {
      btn.onclick = () => abrirModal(btn.dataset.id);
    });

    // Botón eliminar
    document.querySelectorAll(".btn-delete").forEach(btn => {
      btn.onclick = () => eliminarUsuario(btn.dataset.id);
    });
  }
}

// =========================
// MODAL USUARIO
// =========================
function abrirModal(id) {
  usuarioEnEdicion = cacheUsuarios.find(u => u.id === id);

  nombreInput.value = usuarioEnEdicion.nombre;
  correoInput.value = usuarioEnEdicion.correo;
  nivelInput.value = usuarioEnEdicion.nivel || "";
  gradoInput.value = usuarioEnEdicion.grado || "";

  modal.style.display = "flex";
}

function cerrarModal() {
  modal.style.display = "none";
}

async function guardarUsuario() {
  const ref = doc(db, "usuarios", usuarioEnEdicion.id);

  await updateDoc(ref, {
    nombre: nombreInput.value,
    correo: correoInput.value,
    nivel: nivelInput.value,
    grado: gradoInput.value
  });

  // Actualizar cache local
  Object.assign(usuarioEnEdicion, {
    nombre: nombreInput.value,
    correo: correoInput.value,
    nivel: nivelInput.value,
    grado: gradoInput.value
  });

  const permisos = PERMISOS[usuarioActual.rol];
  renderUsuarios(cacheUsuarios, permisos);

  cerrarModal();
}

// =========================
// ELIMINAR USUARIO
// =========================
async function eliminarUsuario(id) {
  if (!confirm("¿Eliminar usuario?")) return;

  await deleteDoc(doc(db, "usuarios", id));

  cacheUsuarios = cacheUsuarios.filter(u => u.id !== id);

  const permisos = PERMISOS[usuarioActual.rol];
  renderUsuarios(cacheUsuarios, permisos);
}

// =========================
// COMUNICADOS
// =========================
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
    const snap = await getDocs(
      query(collection(db, "comunicados"), orderBy("fecha", "desc"))
    );

    cacheComunicados = snap.docs.map(d => d.data());
  }

  let lista =
    tipo === "limitados" ? cacheComunicados.slice(0, 5) : cacheComunicados;

  const tbody = document.getElementById("tablaComunicados");
  tbody.innerHTML = "";

  lista.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.titulo}</td>
        <td>${c.descripcion || "-"}</td>
        <td>${c.fecha}</td>
      </tr>
    `;
  });
}
