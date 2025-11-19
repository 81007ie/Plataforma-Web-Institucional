
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
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// DOM
const contenido = document.getElementById("contenido");
const tituloPantalla = document.getElementById("titulo-pantalla");
const modal = document.getElementById("modal-profesor");
const guardarBtn = document.getElementById("guardar-btn");
const cancelarBtn = document.getElementById("cancelar-btn");

// Estado
let usuarioActual = null;
let listaUsuarios = []; // cache local cuando corresponda

// Escuchar sesión
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    await Swal.fire("Sesión", "Debes iniciar sesión.", "info");
    window.location.href = "login.html";
    return;
  }

  // obtener perfil del usuario desde Firestore (documento cuyo id = uid)
  const userRef = doc(db, "usuarios", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await Swal.fire("Error", "No se encontraron tus datos.", "error");
    return;
  }

  usuarioActual = userSnap.data();
  tituloPantalla.textContent = `Perfil — ${usuarioActual.rol}`;

  // logout con confirmación
  document.getElementById("btnCerrar").addEventListener("click", async () => {
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

  // Render según rol
  if (usuarioActual.rol === "Administrativo") {
    await renderAdmin();
  } else if (usuarioActual.rol === "Subdirector") {
    await renderSubdirector();
  } else {
    await renderSoloComunicados();
  }
});

/* ===========================
   RENDER ADMINISTRATIVO
   - Ve TODOS los usuarios
   - Puede editar/eliminar SOLO profesores
   - Buscador
   - 5 comunicados
   =========================== */
async function renderAdmin() {
  contenido.innerHTML = `
    <div class="info">
      <p><b>Nombre:</b> ${usuarioActual.nombre}</p>
      <p><b>Rol:</b> ${usuarioActual.rol}</p>
      <p><b>Registrado:</b> ${usuarioActual.fechaRegistro || "-"}</p>
    </div>

    <h2>Usuarios</h2>
    <input id="buscador" placeholder="Buscar por nombre, correo, nivel..." />

    <table>
      <thead>
        <tr><th>Nombre</th><th>Correo</th><th>Grado</th><th>Nivel</th><th>Rol</th><th>Acciones</th></tr>
      </thead>
      <tbody id="tabla-usuarios"></tbody>
    </table>

    <h2>5 Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  document.getElementById("buscador").addEventListener("input", filtrarTabla);

  // Cargar todos los usuarios (una sola lectura)
  const snap = await getDocs(collection(db, "usuarios"));
  listaUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  mostrarUsuarios(listaUsuarios);
  await cargarComunicados();
}

function mostrarUsuarios(lista) {
  const tbody = document.getElementById("tabla-usuarios");
  if (!tbody) return;
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No hay usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(u => {
    // mostrar botones de acción SOLO si el usuario es Profesor (según requisito)
    const acciones = u.rol === "Profesor"
      ? `<button class="edit" onclick="window.__editarUsuario('${u.id}')">Editar</button>
         <button class="delete" onclick="window.__eliminarUsuario('${u.id}')">Eliminar</button>`
      : `<span style="color:#777;font-size:13px;">Sin acciones</span>`;

    return `
      <tr>
        <td>${escapeHtml(u.nombre || "-")}</td>
        <td>${escapeHtml(u.correo || "-")}</td>
        <td>${escapeHtml(u.grado || "-")}</td>
        <td>${escapeHtml(u.nivel || "-")}</td>
        <td>${escapeHtml(u.rol || "-")}</td>
        <td>${acciones}</td>
      </tr>
    `;
  }).join("");
}

function filtrarTabla(e) {
  const term = e.target.value.toLowerCase();
  const filtrada = listaUsuarios.filter(u =>
    (u.nombre || "").toLowerCase().includes(term) ||
    (u.correo || "").toLowerCase().includes(term) ||
    (u.nivel || "").toLowerCase().includes(term)
  );
  mostrarUsuarios(filtrada);
}

/* ===========================
   RENDER SUBDIRECTOR
   - Ve todos los usuarios excepto los Administrativos
   - Solo lectura
   - 5 comunicados
   =========================== */
async function renderSubdirector() {
  contenido.innerHTML = `
    <div class="info">
      <p><b>Nombre:</b> ${usuarioActual.nombre}</p>
      <p><b>Rol:</b> ${usuarioActual.rol}</p>
    </div>

    <h2>Usuarios (sin Administrativos)</h2>
    <table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Grado</th><th>Nivel</th><th>Rol</th></tr></thead>
      <tbody id="tabla-usuarios"></tbody>
    </table>

    <h2>5 Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  // Obtener todos los usuarios y filtrar administratives localmente (una sola lectura)
  const snap = await getDocs(collection(db, "usuarios"));
  const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sinAdmins = todos.filter(u => (u.rol || "").toLowerCase() !== "administrativo");

  // Mostrar
  const tbody = document.getElementById("tabla-usuarios");
  tbody.innerHTML = sinAdmins.length === 0
    ? `<tr><td colspan="5">No hay usuarios</td></tr>`
    : sinAdmins.map(u => `
        <tr>
          <td>${escapeHtml(u.nombre || "-")}</td>
          <td>${escapeHtml(u.correo || "-")}</td>
          <td>${escapeHtml(u.grado || "-")}</td>
          <td>${escapeHtml(u.nivel || "-")}</td>
          <td>${escapeHtml(u.rol || "-")}</td>
        </tr>
      `).join("");

  await cargarComunicados();
}

/* ===========================
   RENDER PROFESOR / OTROS
   - Solo muestran sus datos y 5 comunicados
   =========================== */
async function renderSoloComunicados() {
  contenido.innerHTML = `
    <div class="info">
      <p><b>Nombre:</b> ${usuarioActual.nombre}</p>
      <p><b>Rol:</b> ${usuarioActual.rol}</p>
      <p><b>Correo:</b> ${usuarioActual.correo || "-"}</p>
      <p><b>Grado:</b> ${usuarioActual.grado || "-"}</p>
      <p><b>Nivel:</b> ${usuarioActual.nivel || "-"}</p>
    </div>

    <h2>5 Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>
  `;

  await cargarComunicados();
}

/* ===========================
   COMUNICADOS (últimos 5)
   - Usa query ordenada por `timestamp` desc y limit 5
   =========================== */
async function cargarComunicados() {
  const tbody = document.getElementById("lista-comunicados");
  if (!tbody) return;

  try {
    const q = query(collection(db, "comunicados"), orderBy("timestamp", "desc"), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="3">No hay comunicados.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs.map(d => {
      const c = d.data();
      return `<tr>
        <td>${escapeHtml(c.titulo || "-")}</td>
        <td>${escapeHtml(c.descripcion || "-")}</td>
        <td>${escapeHtml(c.fecha || "-")}</td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="3">Error al cargar comunicados.</td></tr>`;
  }
}

/* ===========================
   EDITAR / ELIMINAR (solo para Administrativo sobre Profesores)
   - Exponemos funciones a window para onclick en botones generados en innerHTML
   =========================== */
window.__editarUsuario = async function (uid) {
  // buscar en cache listaUsuarios; si no existe, leer el documento
  let usuario = listaUsuarios.find(u => u.id === uid);
  if (!usuario) {
    const snap = await getDoc(doc(collection(db, "usuarios").parent || db, "usuarios", uid)).catch(()=>null);
    // fallback: buscar entre getDocs si no viene en cache (no lo esperamos)
    if (!usuario && snap && snap.exists) usuario = { id: snap.id, ...snap.data() };
  }
  if (!usuario) {
    // fallback: leer documento directo
    const s = await getDoc(doc(db, "usuarios", uid));
    if (!s.exists()) {
      Swal.fire("Error", "Usuario no encontrado.", "error");
      return;
    }
    usuario = { id: s.id, ...s.data() };
  }

  // permitir edición solo si es Profesor
  if ((usuario.rol || "").toLowerCase() !== "profesor") {
    Swal.fire("Acción no permitida", "Solo se pueden editar usuarios con rol Profesor.", "warning");
    return;
  }

  // rellenar modal
  document.getElementById("nombre-input").value = usuario.nombre || "";
  document.getElementById("correo-input").value = usuario.correo || "";
  document.getElementById("grado-input").value = usuario.grado || "";
  document.getElementById("nivel-input").value = usuario.nivel || "";
  modal.dataset.uid = uid;
  modal.setAttribute("aria-hidden", "false");
};

window.__eliminarUsuario = async function (uid) {
  // confirmar
  const docRef = doc(db, "usuarios", uid);
  // leer rol por seguridad
  const s = await getDoc(docRef);
  if (!s.exists()) {
    Swal.fire("Error", "Usuario no encontrado.", "error");
    return;
  }
  const datos = s.data();
  if ((datos.rol || "").toLowerCase() !== "profesor") {
    Swal.fire("Acción no permitida", "Solo se pueden eliminar usuarios con rol Profesor.", "warning");
    return;
  }

  const res = await Swal.fire({
    title: "Eliminar profesor",
    text: "Esta acción es irreversible. ¿Deseas continuar?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar"
  });

  if (!res.isConfirmed) return;

  try {
    await deleteDoc(docRef);
    Swal.fire("Eliminado", "Profesor eliminado correctamente.", "success");
    // actualizar cache y tabla si corresponde
    listaUsuarios = listaUsuarios.filter(u => u.id !== uid);
    const tabla = document.getElementById("tabla-usuarios");
    if (tabla) mostrarUsuarios(listaUsuarios);
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo eliminar.", "error");
  }
};

/* ===========================
   Guardar edición desde modal
   - Validaciones sencillas
   =========================== */
guardarBtn?.addEventListener("click", async () => {
  const uid = modal.dataset.uid;
  if (!uid) return;

  const nombre = document.getElementById("nombre-input").value.trim();
  const correo = document.getElementById("correo-input").value.trim();
  const grado = document.getElementById("grado-input").value.trim();
  const nivel = document.getElementById("nivel-input").value.trim();

  if (!nombre || !correo) {
    Swal.fire("Completa los campos", "Nombre y correo son obligatorios.", "warning");
    return;
  }

  // volver a verificar rol en Firestore antes de actualizar
  const refDoc = doc(db, "usuarios", uid);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) {
    Swal.fire("Error", "Usuario no encontrado.", "error");
    return;
  }
  const dataActual = snap.data();
  if ((dataActual.rol || "").toLowerCase() !== "profesor") {
    Swal.fire("Acción no permitida", "Solo se pueden editar usuarios con rol Profesor.", "warning");
    modal.removeAttribute("data-uid");
    modal.setAttribute("aria-hidden", "true");
    return;
  }

  try {
    await updateDoc(refDoc, { nombre, correo, grado, nivel });
    Swal.fire("Actualizado", "Datos del profesor actualizados.", "success");
    // actualizar cache local si existe
    listaUsuarios = listaUsuarios.map(u => u.id === uid ? { ...u, nombre, correo, grado, nivel } : u);
    const tabla = document.getElementById("tabla-usuarios");
    if (tabla) mostrarUsuarios(listaUsuarios);
    modal.setAttribute("aria-hidden", "true");
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo actualizar.", "error");
  }
});

cancelarBtn?.addEventListener("click", () => {
  modal.setAttribute("aria-hidden", "true");
});

/* ===========================
   Utilidades
   =========================== */
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"'/]/g, (s) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;' };
    return map[s];
  });
}
