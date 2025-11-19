// ===============================
// 🔥 MÓDULO DE USUARIOS — FINAL
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
    <input id="buscador" placeholder="Buscar por nombre, grado, nivel o rol..." class="input"/>

    <table>
      <thead>
        <tr>
          <th>Nombre</th><th>Correo</th><th>Grado</th><th>Nivel</th><th>Rol</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody id="tabla-usuarios"></tbody>
    </table>

    <h2>Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  document.getElementById("buscador")?.addEventListener("input", filtrarTabla);

  const snap = await getDocs(collection(db, "usuarios"));
  listaUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  mostrarUsuarios(listaUsuarios);
  await cargarComunicados();
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
          ${
            usuarioActual.rol === "Administrativo"
              ? `
                <button class="edit" onclick="window.__editarUsuario('${u.id}')">Editar</button>
                <button class="delete" onclick="window.__eliminarUsuario('${u.id}')">Eliminar</button>
              `
              : ""
          }
        </td>
      </tr>
    `)
    .join("");
}

// ===============================
// 🔹 FILTRAR TABLA (AGREGA GRADO)
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
// 🟣 RENDER SUBDIRECTOR
// ===============================
async function renderSubdirector() {
  contenido.innerHTML = `
    <div class="info">
      <p><b>Nombre:</b> ${escapeHtml(usuarioActual.nombre)}</p>
      <p><b>Rol:</b> ${escapeHtml(usuarioActual.rol)}</p>
      <p><b>Correo:</b> ${escapeHtml(usuarioActual.correo)}</p>
    </div>

    <h2>Usuarios</h2>
    <input id="buscador-sub" placeholder="Buscar por nombre, grado, nivel o rol..." class="input"/>

    <table>
      <thead>
        <tr><th>Nombre</th><th>Correo</th><th>Grado</th><th>Nivel</th><th>Rol</th></tr>
      </thead>
      <tbody id="tabla-usuarios"></tbody>
    </table>

    <h2>Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  const snap = await getDocs(collection(db, "usuarios"));
  const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const sinAdmins = todos.filter(u => (u.rol || "").toLowerCase() !== "administrativo");

  mostrarUsuarios(sinAdmins);

  document.getElementById("buscador-sub")?.addEventListener("input", e => {
    const term = e.target.value.toLowerCase();
    const filtrados = sinAdmins.filter(u =>
      (u.nombre || "").toLowerCase().includes(term) ||
      (u.grado || "").toLowerCase().includes(term) ||
      (u.nivel || "").toLowerCase().includes(term) ||
      (u.rol || "").toLowerCase().includes(term)
    );
    mostrarUsuarios(filtrados);
  });

  await cargarComunicados();
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
