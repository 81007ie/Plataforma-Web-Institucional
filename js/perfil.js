// perfil.js (FINAL CORREGIDO)
// - 5 usuarios por página
// - Subdirector VE solo usuarios del mismo nivel (y no ve Administrativos)
// - Buscador para Administrativo + Subdirector (nombre, rol, grado, nivel)
// - CRUD solo para Administrativo (editar / eliminar). No crear.
// - Modal de edición: correo readonly (no se actualiza en Auth).
// - 5 comunicados recientes visibles para todos.

import { auth, db } from "./firebaseconfig.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ---------- DOM ----------
const rolUsuarioSpan = document.getElementById("rol-usuario");
const btnCerrar = document.getElementById("btnCerrar");

const buscador = document.getElementById("buscador");

const tablaBody = document.getElementById("tabla-usuarios");
const tablaSection = document.getElementById("seccion-usuarios"); // <---- ESTE ID YA ESTÁ PRESENTE EN EL HTML CORREGIDO
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const chipsContainer = document.getElementById("paginacion-chips");

const listaComunicadosCont = document.getElementById("lista-comunicados");

// Modal (edición)
const modal = document.getElementById("modal-usuario");
const modalTitle = document.getElementById("modal-title");
const nombreInput = document.getElementById("nombre-input");
const correoInput = document.getElementById("correo-input");
const rolInput = document.getElementById("rol-input");
const gradoInput = document.getElementById("grado-input");
const nivelInput = document.getElementById("nivel-input");
const guardarBtn = document.getElementById("guardar-btn");
const cancelarBtn = document.getElementById("cancelar-btn");

// ---------- Estado ----------
let usuarioActual = null;
let usuariosTodos = [];
let usuariosFiltrados = [];
let paginaActual = 1;
const POR_PAGINA = 5;
let totalPaginas = 1;

// ---------- Roles ----------
const ROLES = ["Administrativo", "Subdirector", "Profesor", "Auxiliar", "Toe"];

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"'/]/g, (ch) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;" };
    return map[ch];
  });
}

// ---------- AUTH ----------
onAuthStateChanged(auth, async (u) => {
  if (!u) return (window.location.href = "login.html");

  try {
    const snap = await getDoc(doc(db, "usuarios", u.uid));
    if (!snap.exists()) {
      Swal.fire("Error", "Perfil no encontrado.", "error");
      return;
    }

    usuarioActual = { id: snap.id, ...snap.data() };
    rolUsuarioSpan.textContent = usuarioActual.rol || "";

    // llenar tarjeta información
    const infoNombre = document.getElementById("info-nombre");
    const infoRol = document.getElementById("info-rol");
    const infoCorreo = document.getElementById("info-correo");
    const infoGradoLine = document.getElementById("info-grado-line");
    const infoNivelLine = document.getElementById("info-nivel-line");
    const infoGrado = document.getElementById("info-grado");
    const infoNivel = document.getElementById("info-nivel");

    if (infoNombre) infoNombre.textContent = usuarioActual.nombre || "-";
    if (infoRol) infoRol.textContent = usuarioActual.rol || "-";
    if (infoCorreo) infoCorreo.textContent = usuarioActual.correo || "-";

    if (usuarioActual.rol === "Administrativo") {
      if (infoGradoLine) infoGradoLine.style.display = "none";
      if (infoNivelLine) infoNivelLine.style.display = "none";
    } else {
      if (infoGradoLine) infoGradoLine.style.display = "block";
      if (infoNivelLine) infoNivelLine.style.display = "block";
      if (infoGrado) infoGrado.textContent = usuarioActual.grado || "-";
      if (infoNivel) infoNivel.textContent = usuarioActual.nivel || "-";
    }

    // ⛔ OCULTAR TABLA PARA ROLES SIN PERMISOS
    if (!["Administrativo", "Subdirector"].includes(usuarioActual.rol)) {
      if (tablaSection) tablaSection.style.display = "none";
      buscador.style.display = "none";
    } else {
      buscador.style.display = "inline-block";
      if (tablaSection) tablaSection.style.display = "block";
    }

    await cargarUsuariosYComunicados();

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo obtener tu perfil.", "error");
  }
});

// ---------- CERRAR SESIÓN ----------
btnCerrar.onclick = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

// ---------- CARGAR USUARIOS Y COMUNICADOS ----------
async function cargarUsuariosYComunicados() {
  try {
    const q = query(collection(db, "usuarios"), orderBy("nombre"));
    const snap = await getDocs(q);

    usuariosTodos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (usuarioActual.rol === "Subdirector") {
      const nivelSub = usuarioActual.nivel || "";
      usuariosTodos = usuariosTodos.filter(u =>
        u.rol !== "Administrativo" && (u.nivel || "") === nivelSub
      );
    }

    usuariosFiltrados = [...usuariosTodos];
    totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
    paginaActual = 1;

    renderPagina(paginaActual);
    cargarComunicados();

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudieron cargar usuarios.", "error");
  }
}

// ---------- RENDER PÁGINA ----------
function renderPagina(page) {
  totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
  if (page < 1) page = 1;
  if (page > totalPaginas) page = totalPaginas;
  paginaActual = page;

  const start = (page - 1) * POR_PAGINA;
  const end = start + POR_PAGINA;
  const pageItems = usuariosFiltrados.slice(start, end);

  tablaBody.innerHTML = "";

  if (!["Administrativo", "Subdirector"].includes(usuarioActual.rol)) {
    return;
  }

  if (pageItems.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px;">No hay usuarios</td></tr>`;
  } else {
    for (const u of pageItems) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.nombre || "-")}</td>
        <td>${escapeHtml(u.correo || "-")}</td>
        <td>${escapeHtml(u.rol || "-")}</td>
        <td>${escapeHtml(u.grado || "-")}</td>
        <td>${escapeHtml(u.nivel || "-")}</td>
        <td style="text-align:center;">
          ${
            usuarioActual.rol === "Administrativo"
              ? `<button class="edit" data-id="${u.id}">Editar</button>
                 <button class="delete" data-id="${u.id}">Eliminar</button>`
              : `<button class="ver" data-id="${u.id}">Ver</button>`
          }
        </td>
      `;
      tablaBody.appendChild(tr);
    }
  }

  renderChips();

  btnPrev.disabled = paginaActual <= 1;
  btnNext.disabled = paginaActual >= totalPaginas;

  tablaBody.querySelectorAll(".edit").forEach(btn => {
    btn.onclick = async (e) => {
      const id = e.currentTarget.dataset.id;
      const u = usuariosTodos.find(x => x.id === id) || {};
      openEditModal(id, u);
    };
  });

  tablaBody.querySelectorAll(".delete").forEach(btn => {
    btn.onclick = async (e) => {
      const id = e.currentTarget.dataset.id;
      const u = usuariosTodos.find(x => x.id === id);
      const res = await Swal.fire({
        title: `Eliminar ${u?.nombre || "usuario"}?`,
        text: "Esta acción es irreversible.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Eliminar"
      });
      if (!res.isConfirmed) return;

      try {
        await deleteDoc(doc(db, "usuarios", id));

        usuariosTodos = usuariosTodos.filter(x => x.id !== id);
        usuariosFiltrados = usuariosFiltrados.filter(x => x.id !== id);

        totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
        if (paginaActual > totalPaginas) paginaActual = totalPaginas;

        renderPagina(paginaActual);
        Swal.fire("Eliminado", "Usuario eliminado correctamente.", "success");
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "No se pudo eliminar.", "error");
      }
    };
  });

  tablaBody.querySelectorAll(".ver").forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      const u = usuariosTodos.find(x => x.id === id) || {};
      Swal.fire({
        title: escapeHtml(u.nombre || "Usuario"),
        html: `
          <b>Correo:</b> ${escapeHtml(u.correo || "-")}<br/>
          <b>Rol:</b> ${escapeHtml(u.rol || "-")}<br/>
          <b>Grado:</b> ${escapeHtml(u.grado || "-")}<br/>
          <b>Nivel:</b> ${escapeHtml(u.nivel || "-")}
        `
      });
    };
  });
}

// ---------- MODAL (Añadido: Se necesitan funciones para abrir/cerrar) ----------
// Funciones necesarias para que los event listeners .edit y guardarBtn funcionen
function openEditModal(id, u) {
    modal.dataset.userid = id;
    modalTitle.textContent = "Editar Usuario: " + (u.nombre || "");
    nombreInput.value = u.nombre || "";
    correoInput.value = u.correo || "";
    rolInput.value = u.rol || ROLES[0];
    gradoInput.value = u.grado || "";
    nivelInput.value = u.nivel || "";
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

// ---------- CHIPS ----------
function renderChips() {
  chipsContainer.innerHTML = "";

  if (!["Administrativo", "Subdirector"].includes(usuarioActual.rol)) return;

  const visibleWindow = 2;
  const pages = [];

  pages.push(1);
  const left = Math.max(2, paginaActual - visibleWindow);
  const right = Math.min(totalPaginas - 1, paginaActual + visibleWindow);

  if (left > 2) pages.push("left-ellipsis");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPaginas - 1) pages.push("right-ellipsis");
  if (totalPaginas > 1) pages.push(totalPaginas);

  for (const p of pages) {
    if (p === "left-ellipsis" || p === "right-ellipsis") {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = "…";
      chipsContainer.appendChild(span);
    } else {
      const btn = document.createElement("button");
      btn.className = "chip" + (p === paginaActual ? " active" : "");
      btn.textContent = p;
      btn.onclick = () => {
        if (p !== paginaActual) renderPagina(p);
      };
      chipsContainer.appendChild(btn);
    }
  }
}

// ---------- BUSCADOR ----------
buscador.addEventListener("input", () => {
  if (!["Administrativo", "Subdirector"].includes(usuarioActual.rol)) return;

  const term = buscador.value.trim().toLowerCase();

  if (!term) {
    usuariosFiltrados = [...usuariosTodos];
  } else {
    usuariosFiltrados = usuariosTodos.filter(u =>
      (u.nombre || "").toLowerCase().includes(term) ||
      (u.rol || "").toLowerCase().includes(term) ||
      (u.grado || "").toLowerCase().includes(term) ||
      (u.nivel || "").toLowerCase().includes(term)
    );
  }

  totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
  renderPagina(1);
});

// ---------- PREV / NEXT ----------
btnPrev.onclick = () => {
  if (paginaActual > 1) renderPagina(paginaActual - 1);
};
btnNext.onclick = () => {
  if (paginaActual < totalPaginas) renderPagina(paginaActual + 1);
};

// ---------- GUARDAR EDICIÓN ----------
guardarBtn.onclick = async () => {
  if (usuarioActual.rol !== "Administrativo") {
    Swal.fire("Permiso denegado", "No tienes permiso para editar.", "warning");
    return;
  }

  const id = modal.dataset.userid;
  if (!id) {
    closeModal();
    return;
  }

  const payload = {
    nombre: nombreInput.value.trim(),
    correo: correoInput.value.trim(),
    rol: rolInput.value,
    grado: gradoInput.value.trim(),
    nivel: nivelInput.value.trim()
  };

  try {
    await updateDoc(doc(db, "usuarios", id), payload);

    usuariosTodos = usuariosTodos.map(u => u.id === id ? { id, ...payload } : u);
    usuariosFiltrados = usuariosFiltrados.map(u => u.id === id ? { id, ...payload } : u);

    Swal.fire("Actualizado", "Usuario actualizado correctamente.", "success");
    closeModal();
    renderPagina(paginaActual);
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo actualizar.", "error");
  }
};

cancelarBtn.onclick = () => closeModal();

// ---------- COMUNICADOS ----------
async function cargarComunicados() {
  try {
    const q = query(collection(db, "comunicados"), orderBy("fechaRegistro", "desc"), limit(5));
    const snap = await getDocs(q);

    listaComunicadosCont.innerHTML = "";

    if (snap.empty) {
      listaComunicadosCont.innerHTML = "<p>No hay comunicados.</p>";
      return;
    }

    snap.forEach(d => {
      const c = d.data();
      const div = document.createElement("div");
      div.className = "comunicado-item"; // 🎯 CORRECCIÓN APLICADA AQUÍ para usar la clase CSS correcta
      div.innerHTML = `
        <h4>${escapeHtml(c.titulo || '-')}</h4>
        <p>${escapeHtml(c.descripcion || '-')}</p>
        <small>${escapeHtml(c.fecha || '')}</small>
      `;
      listaComunicadosCont.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    listaComunicadosCont.innerHTML = "<p>Error cargando comunicados.</p>";
  }
}

(function init() {
  // Por defecto, se oculta el buscador hasta que se cargue el perfil del usuario
  // La lógica en onAuthStateChanged se encarga de mostrar/ocultar según el rol.
  buscador.style.display = "none";

  // 🚨 NECESARIO AÑADIR LAS FUNCIONES AL INICIO DEL ARCHIVO
  // Tu código original no incluía las funciones openEditModal y closeModal
  // pero son llamadas por los botones .edit y cancelar/guardar.
})();