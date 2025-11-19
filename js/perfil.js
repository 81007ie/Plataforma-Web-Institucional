// ===============================
// 🔥 MÓDULO DE USUARIOS — FINAL + PAGINACIÓN
// ===============================

import { auth, db } from "./firebaseconfig.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  startAt,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ===============================
// 🔹 DOM
// ===============================
const contenido = document.getElementById("contenido");
const tituloPantalla = document.getElementById("titulo-pantalla");
const modal = document.getElementById("modal-usuario");
const guardarBtn = document.getElementById("guardar-btn");
const cancelarBtn = document.getElementById("cancelar-btn");

let usuarioActual = null;
let listaUsuarios = [];

let pagina = 1;
const tamanioPagina = 10;

let lastVisible = null;
let firstVisible = null;

// ===============================
// 🔹 AUTENTICACIÓN
// ===============================
onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    Swal.fire("Error", "No se encontraron tus datos.", "error");
    return;
  }

  usuarioActual = snap.data();
  tituloPantalla.textContent = `Perfil — ${usuarioActual.rol}`;

  // BOTÓN DE CERRAR SESIÓN
  document.getElementById("btnCerrar")?.addEventListener("click", async () => {
    const res = await Swal.fire({
      title: "Cerrar sesión",
      text: "¿Deseas cerrar sesión?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar"
    });

    if (res.isConfirmed) {
      await signOut(auth);
      localStorage.clear();
      window.location.href = "login.html";
    }
  });

  // RENDER SEGÚN ROL
  if (usuarioActual.rol === "Administrativo") {
    await renderAdmin();
  } else if (usuarioActual.rol === "Subdirector") {
    await renderSubdirector();
  } else {
    await renderSoloComunicados();
  }
});

// ===============================
// 🔵 RENDER ADMINISTRATIVO
// ===============================
async function renderAdmin() {
  contenido.innerHTML = `
    <div class="info">
      <p><b>Nombre:</b> ${escapeHtml(usuarioActual.nombre)}</p>
      <p><b>Rol:</b> ${escapeHtml(usuarioActual.rol)}</p>
      <p><b>Correo:</b> ${escapeHtml(usuarioActual.correo)}</p>
    </div>

    <h2>Usuarios</h2>
    <input id="buscador" placeholder="Buscar..." class="input"/>

    <table>
      <thead>
        <tr>
          <th>Nombre</th><th>Correo</th><th>Grado</th><th>Nivel</th><th>Rol</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody id="tabla-usuarios"></tbody>
    </table>

    <div class="paginacion">
      <button id="btn-prev" disabled>Anterior</button>
      <span id="pagina-texto">Página 1</span>
      <button id="btn-next">Siguiente</button>
    </div>

    <h2>Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  document.getElementById("buscador")?.addEventListener("input", filtrarTabla);

  await cargarPagina(); // 👈 Primera carga con paginación
  await cargarComunicados();

  document.getElementById("btn-prev").addEventListener("click", paginaAnterior);
  document.getElementById("btn-next").addEventListener("click", paginaSiguiente);
}

// ===============================
// 🔹 PAGINACIÓN — CARGAR PÁGINA
// ===============================
async function cargarPagina(next = false, prev = false) {
  let q;

  if (prev && firstVisible) {
    q = query(
      collection(db, "usuarios"),
      orderBy("nombre"),
      startAt(firstVisible),
      limit(tamanioPagina)
    );
  } else if (next && lastVisible) {
    q = query(
      collection(db, "usuarios"),
      orderBy("nombre"),
      startAfter(lastVisible),
      limit(tamanioPagina)
    );
  } else {
    q = query(
      collection(db, "usuarios"),
      orderBy("nombre"),
      limit(tamanioPagina)
    );
  }

  const snap = await getDocs(q);

  if (snap.empty) return;

  listaUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  firstVisible = snap.docs[0];
  lastVisible  = snap.docs[snap.docs.length - 1];

  mostrarUsuarios(listaUsuarios);

  document.getElementById("pagina-texto").textContent = `Página ${pagina}`;
  document.getElementById("btn-prev").disabled = pagina === 1;
}

async function paginaSiguiente() {
  pagina++;
  await cargarPagina(true, false);
}

async function paginaAnterior() {
  if (pagina > 1) {
    pagina--;
    await cargarPagina(false, true);
  }
}

// ===============================
// 🔹 MOSTRAR USUARIOS
// ===============================
function mostrarUsuarios(lista) {
  const tbody = document.getElementById("tabla-usuarios");
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No hay usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = lista
    .map(u => `
      <tr>
        <td>${escapeHtml(u.nombre || "-")}</td>
        <td>${escapeHtml(u.correo || "-")}</td>
        <td>${escapeHtml(u.grado || "-")}</td>
        <td>${escapeHtml(u.nivel || "-")}</td>
        <td>${escapeHtml(u.rol || "-")}</td>
        <td>
                <button class="edit" onclick="window.__editarUsuario('${u.id}')">Editar</button>
                <button class="delete" onclick="window.__eliminarUsuario('${u.id}')">Eliminar</button>
        </td>
      </tr>
    `)
    .join("");
}

// ===============================
// 🔹 FILTRAR TABLA
// ===============================
function filtrarTabla(e) {
  const term = e.target.value.toLowerCase();

  const filtrada = listaUsuarios.filter(u =>
    (u.nombre || "").toLowerCase().includes(term) ||
    (u.grado || "").toLowerCase().includes(term) ||
    (u.nivel || "").toLowerCase().includes(term) ||
    (u.rol || "").toLowerCase().includes(term)
  );

  mostrarUsuarios(filtrada);
}

// ===============================
// 🟣 RENDER SUBDIRECTOR (CON PAGINACIÓN)
// ===============================
async function renderSubdirector() {
  contenido.innerHTML = `
    <div class="info">
      <p><b>Nombre:</b> ${escapeHtml(usuarioActual.nombre)}</p>
      <p><b>Rol:</b> ${escapeHtml(usuarioActual.rol)}</p>
      <p><b>Correo:</b> ${escapeHtml(usuarioActual.correo)}</p>
    </div>

    <h2>Usuarios</h2>
    <input id="buscador-sub" placeholder="Buscar..." class="input"/>

    <table>
      <thead>
        <tr><th>Nombre</th><th>Correo</th><th>Grado</th><th>Nivel</th><th>Rol</th></tr>
      </thead>
      <tbody id="tabla-usuarios"></tbody>
    </table>

    <div class="paginacion">
      <button id="btn-prev" disabled>Anterior</button>
      <span id="pagina-texto">Página 1</span>
      <button id="btn-next">Siguiente</button>
    </div>

    <h2>Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  document.getElementById("buscador-sub")?.addEventListener("input", filtrarTabla);

  await cargarPagina();
  await cargarComunicados();

  document.getElementById("btn-prev").addEventListener("click", paginaAnterior);
  document.getElementById("btn-next").addEventListener("click", paginaSiguiente);
}

// ===============================
// 🟢 OTROS ROLES
// ===============================
async function renderSoloComunicados() {
  contenido.innerHTML = `
    <div class="info">
      <p><b>Nombre:</b> ${escapeHtml(usuarioActual.nombre)}</p>
      <p><b>Rol:</b> ${escapeHtml(usuarioActual.rol)}</p>
      <p><b>Correo:</b> ${escapeHtml(usuarioActual.correo || "-")}</p>
      <p><b>Grado:</b> ${escapeHtml(usuarioActual.grado || "-")}</p>
      <p><b>Nivel:</b> ${escapeHtml(usuarioActual.nivel || "-")}</p>
    </div>

    <h2>Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  await cargarComunicados();
}

// ===============================
// 📢 CARGAR COMUNICADOS
// ===============================
async function cargarComunicados() {
  const tbody = document.getElementById("lista-comunicados");
  if (!tbody) return;

  try {
    const qx = query(
      collection(db, "comunicados"),
      orderBy("fechaRegistro", "desc"),
      limit(5)
    );

    const snap = await getDocs(qx);

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="3">No hay comunicados.</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs
      .map(d => {
        const c = d.data();
        return `
          <tr>
            <td>${escapeHtml(c.titulo || "-")}</td>
            <td>${escapeHtml(c.descripcion || "-")}</td>
            <td>${escapeHtml(c.fecha || "-")}</td>
          </tr>
        `;
      })
      .join("");

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="3">Error al cargar comunicados.</td></tr>`;
  }
}

// ===============================
// ✏ EDITAR USUARIO
// ===============================
window.__editarUsuario = async (uid) => {
  let usuario = listaUsuarios.find(u => u.id === uid);

  if (!usuario) {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (!snap.exists()) {
      Swal.fire("Error", "Usuario no encontrado.", "error");
      return;
    }
    usuario = { id: snap.id, ...snap.data() };
  }

  document.getElementById("nombre-input").value = usuario.nombre || "";
  document.getElementById("correo-input").value = usuario.correo || "";
  document.getElementById("grado-input").value = usuario.grado || "";
  document.getElementById("nivel-input").value = usuario.nivel || "";
  modal.dataset.uid = uid;

  modal.setAttribute("aria-hidden", "false");
};

// ===============================
// ❌ ELIMINAR USUARIO
// ===============================
window.__eliminarUsuario = async (uid) => {
  const res = await Swal.fire({
    title: "Eliminar usuario",
    text: "Esta acción es irreversible.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar"
  });

  if (!res.isConfirmed) return;

  try {
    await deleteDoc(doc(db, "usuarios", uid));
    listaUsuarios = listaUsuarios.filter(u => u.id !== uid);
    mostrarUsuarios(listaUsuarios);
    Swal.fire("Eliminado", "Usuario eliminado correctamente.", "success");
  } catch (err) {
    Swal.fire("Error", "No se pudo eliminar.", "error");
  }
};

// ===============================
// 💾 GUARDAR EDICIÓN
// ===============================
guardarBtn?.addEventListener("click", async () => {
  const uid = modal.dataset.uid;
  if (!uid) return;

  const nombre = document.getElementById("nombre-input").value.trim();
  const correo = document.getElementById("correo-input").value.trim();
  const grado = document.getElementById("grado-input").value.trim();
  const nivel = document.getElementById("nivel-input").value.trim();

  if (!nombre || !correo) {
    Swal.fire("Campos requeridos", "Nombre y correo son obligatorios.", "warning");
    return;
  }

  const refDoc = doc(db, "usuarios", uid);

  try {
    await updateDoc(refDoc, { nombre, correo, grado, nivel });

    listaUsuarios = listaUsuarios.map(u =>
      u.id === uid ? { ...u, nombre, correo, grado, nivel } : u
    );

    mostrarUsuarios(listaUsuarios);
    modal.setAttribute("aria-hidden", "true");

    Swal.fire("Actualizado", "Usuario actualizado correctamente.", "success");
  } catch (err) {
    Swal.fire("Error", "No se pudo actualizar.", "error");
  }
});

cancelarBtn?.addEventListener("click", () => {
  modal.setAttribute("aria-hidden", "true");
});

// ===============================
// 🔧 UTILIDAD DE SEGURIDAD
// ===============================
function escapeHtml(str) {
  if (typeof str !== "string") return str;

  return str.replace(/[&<>"'/]/g, (s) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "/": "&#x2F;"
    };
    return map[s];
  });
}
