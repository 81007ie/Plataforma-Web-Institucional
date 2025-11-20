// perfil.js
import { auth, db } from "./firebaseconfig.js";
import {
  collection,
  getDocs,
  addDoc,
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
const titulo = document.getElementById("titulo-pantalla");

const buscador = document.getElementById("buscador");
const nuevoUsuarioBtn = document.getElementById("nuevo-usuario-btn");

const tablaBody = document.getElementById("tabla-usuarios");

const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const chipsContainer = document.getElementById("paginacion-chips");

const listaComunicadosCont = document.getElementById("lista-comunicados");

// modal
const modal = document.getElementById("modal-usuario");
const modalTitle = document.getElementById("modal-title") || document.createElement("div");
const nombreInput = document.getElementById("nombre-input");
const correoInput = document.getElementById("correo-input");
const rolInput = document.getElementById("rol-input");
const gradoInput = document.getElementById("grado-input");
const nivelInput = document.getElementById("nivel-input");

const guardarBtn = document.getElementById("guardar-btn");
const cancelarBtn = document.getElementById("cancelar-btn");

// ---------- Estado ----------
let usuarioActual = null;
let usuariosTodos = [];      // todos los usuarios traídos desde Firestore
let usuariosFiltrados = [];  // resultado tras búsqueda / filtro (lo que paginamos)
let paginaActual = 1;
const POR_PAGINA = 5;
let totalPaginas = 1;

// ---------- Roles exactos según nos diste ----------
const ROLES = ["Administrativo", "Subdirector", "Profesor", "Auxiliar", "Toe"];

// ---------- Helpers ----------
function openModal(mode = "edit", userId = null) {
  modal.setAttribute("aria-hidden", "false");
  modal.dataset.mode = mode;
  modal.dataset.userid = userId || "";
  modalTitle && (modalTitle.textContent = mode === "create" ? "Nuevo Usuario" : "Editar Usuario");
  if (mode === "create") {
    nombreInput.value = "";
    correoInput.value = "";
    rolInput.value = ROLES[2] || "Profesor";
    gradoInput.value = "";
    nivelInput.value = "";
  }
}
function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  modal.dataset.mode = "";
  modal.dataset.userid = "";
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"'/]/g, (ch) => {
    const map = { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;" };
    return map[ch];
  });
}

// ---------- AUTH ----------
onAuthStateChanged(auth, async (u) => {
  if (!u) return (window.location.href = "login.html");

  // traemos doc del usuario en "usuarios" para obtener rol y datos
  const snap = await getDoc(doc(db, "usuarios", u.uid));
  if (!snap.exists()) {
    Swal.fire("Error", "Perfil no encontrado.", "error");
    return;
  }
  usuarioActual = { id: snap.id, ...snap.data() };

  // mostrar rol en la UI
  rolUsuarioSpan.textContent = usuarioActual.rol || "";

  //mostrar ifnromacion del usuario
  // ===== Mostrar información del usuario en la tarjeta =====
document.getElementById("info-nombre").textContent = usuarioActual.nombre || "-";
document.getElementById("info-rol").textContent = usuarioActual.rol || "-";
document.getElementById("info-correo").textContent = usuarioActual.correo || "-";

// Si es Administrativo → ocultar grado y nivel
if (usuarioActual.rol === "Administrativo") {
  document.getElementById("info-grado-line").style.display = "none";
  document.getElementById("info-nivel-line").style.display = "none";
} else {
  document.getElementById("info-grado").textContent = usuarioActual.grado || "-";
  document.getElementById("info-nivel").textContent = usuarioActual.nivel || "-";
}


  // mostrar botones según rol
  if (usuarioActual.rol === "Administrativo") {
    nuevoUsuarioBtn.style.display = "inline-block";
  } else {
    nuevoUsuarioBtn.style.display = "none";
  }

  // inicializar datos (usuarios + comunicados)
  await cargarUsuariosYComunicados();
});

// cerrar sesión
btnCerrar.onclick = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

// ---------- CARGAR USUARIOS (y comunicados) ----------
async function cargarUsuariosYComunicados() {
  try {
    // Traemos TODOS los usuarios (aceptable para ~100 usuarios)
    const q = query(collection(db, "usuarios"), orderBy("nombre"));
    const snap = await getDocs(q);

    usuariosTodos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Si current user es SUBDIRECTOR -> quitar Administrativos (no deben verlos)
    if (usuarioActual.rol === "Subdirector") {
      usuariosTodos = usuariosTodos.filter(u => u.rol !== "Administrativo");
    }

    // Inicialmente, usuariosFiltrados = usuariosTodos
    usuariosFiltrados = [...usuariosTodos];

    // calcular páginas
    totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
    paginaActual = 1;

    renderPagina(paginaActual);

    // comunicados (5 recientes) — visibles para todos
    cargarComunicados();
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudieron cargar usuarios.", "error");
  }
}

// ---------- RENDER (tabla + chips) ----------
function renderPagina(page) {
  // seguridad
  if (!Array.isArray(usuariosFiltrados)) usuariosFiltrados = [];

  totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
  if (page < 1) page = 1;
  if (page > totalPaginas) page = totalPaginas;
  paginaActual = page;

  // slice
  const start = (page - 1) * POR_PAGINA;
  const end = start + POR_PAGINA;
  const pageItems = usuariosFiltrados.slice(start, end);

  // render tabla
  tablaBody.innerHTML = "";
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
        <td>
          ${usuarioActual.rol === "Administrativo" ? `
            <button class="edit" data-id="${u.id}">Editar</button>
            <button class="delete" data-id="${u.id}">Eliminar</button>
          ` : `
            <button class="ver" data-id="${u.id}">Ver</button>
          `}
        </td>
      `;
      tablaBody.appendChild(tr);
    }
  }

  // attach eventos de fila
  tablaBody.querySelectorAll(".edit").forEach(btn => {
    btn.onclick = async (e) => {
      const id = e.currentTarget.dataset.id;
      // cargar datos al modal
      const s = usuariosTodos.find(x => x.id === id) || (await (await getDoc(doc(db,"usuarios",id))).data());
      nombreInput.value = s.nombre || "";
      correoInput.value = s.correo || "";
      rolInput.value = s.rol || ROLES[2];
      gradoInput.value = s.grado || "";
      nivelInput.value = s.nivel || "";
      openModal("edit", id);
    };
  });

  tablaBody.querySelectorAll(".delete").forEach(btn => {
    btn.onclick = async (e) => {
      const id = e.currentTarget.dataset.id;
      const usuario = usuariosTodos.find(x => x.id === id);
      const answer = await Swal.fire({
        title: `Eliminar ${usuario?.nombre || "usuario"}`,
        text: "Esta acción es irreversible.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Eliminar"
      });
      if (!answer.isConfirmed) return;
      try {
        await deleteDoc(doc(db, "usuarios", id));
        // actualizar local
        usuariosTodos = usuariosTodos.filter(x => x.id !== id);
        usuariosFiltrados = usuariosFiltrados.filter(x => x.id !== id);
        totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
        if (paginaActual > totalPaginas) paginaActual = totalPaginas;
        renderPagina(paginaActual);
        Swal.fire("Eliminado", "Usuario eliminado correctamente", "success");
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "No se pudo eliminar", "error");
      }
    };
  });

  tablaBody.querySelectorAll(".ver").forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      const usuario = usuariosTodos.find(x => x.id === id);
      Swal.fire({
        title: usuario?.nombre || "Usuario",
        html: `
          <b>Correo:</b> ${escapeHtml(usuario?.correo || "-")}<br/>
          <b>Rol:</b> ${escapeHtml(usuario?.rol || "-")}<br/>
          <b>Grado:</b> ${escapeHtml(usuario?.grado || "-")}<br/>
          <b>Nivel:</b> ${escapeHtml(usuario?.nivel || "-")}
        `
      });
    };
  });

  // render chips compactos
  renderChips();

  // prev / next disabled
  btnPrev.disabled = paginaActual <= 1;
  btnNext.disabled = paginaActual >= totalPaginas;
}

function renderChips() {
  chipsContainer.innerHTML = "";
  const visibleWindow = 2; // números a cada lado
  const pages = [];

  // always include 1
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

// ---------- BUSCADOR (nombre | rol | grado | nivel) ----------
buscador.addEventListener("input", () => {
  const t = buscador.value.trim().toLowerCase();

  // solo Administrativo y Subdirector pueden usar buscador (ya escondido para otros)
  if (!["Administrativo", "Subdirector"].includes(usuarioActual?.rol)) return;

  if (!t) {
    usuariosFiltrados = [...usuariosTodos];
  } else {
    usuariosFiltrados = usuariosTodos.filter(u => {
      return (
        (u.nombre || "").toLowerCase().includes(t) ||
        (u.rol || "").toLowerCase().includes(t) ||
        (u.grado || "").toLowerCase().includes(t) ||
        (u.nivel || "").toLowerCase().includes(t)
      );
    });
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

// ---------- Nuevo usuario (Admin) ----------
nuevoUsuarioBtn.onclick = () => {
  openModal("create", null);
};

// ---------- Modal acciones ----------
cancelarBtn.onclick = () => closeModal();

guardarBtn.onclick = async () => {
  const mode = modal.dataset.mode || "edit";
  const id = modal.dataset.userid || null;

  const payload = {
    nombre: nombreInput.value.trim(),
    correo: correoInput.value.trim(),
    rol: rolInput.value,
    grado: gradoInput.value.trim(),
    nivel: nivelInput.value.trim()
  };

  try {
    if (mode === "create") {
      const ref = await addDoc(collection(db, "usuarios"), payload);
      // añadir localmente (si subdirector no debería ver administrativos, manejar)
      usuariosTodos.unshift({ id: ref.id, ...payload });
      if (!(usuarioActual.rol === "Subdirector" && payload.rol === "Administrativo")) {
        usuariosFiltrados.unshift({ id: ref.id, ...payload });
      }
      Swal.fire("Creado", "Usuario creado correctamente", "success");
    } else {
      // editar
      await updateDoc(doc(db, "usuarios", id), payload);
      // actualizar localmente
      usuariosTodos = usuariosTodos.map(u => u.id === id ? { id, ...payload } : u);
      usuariosFiltrados = usuariosFiltrados.map(u => u.id === id ? { id, ...payload } : u);
      Swal.fire("Actualizado", "Usuario actualizado", "success");
    }

    // recalcular páginas y render
    totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA));
    renderPagina(1);
    closeModal();
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "No se pudo guardar el usuario", "error");
  }
};

// ---------- Comunicados (5 recientes) ----------
async function cargarComunicados() {
  try {
    // query 5 comunicados ordenados por fechaRegistro desc
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
      div.className = "comunicado";
      div.innerHTML = `<h4>${escapeHtml(c.titulo || '-')}</h4>
        <p>${escapeHtml(c.descripcion || '-')}</p>
        <small>${escapeHtml(c.fecha || '')}</small>`;
      listaComunicadosCont.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    listaComunicadosCont.innerHTML = "<p>Error cargando comunicados.</p>";
  }
}

// ---------- Load inicial ----------
async function init() {
  // esconder buscador inicialmente para roles no permitidos
  buscador.style.display = "none";

  // detectar qué roles pueden buscar (Admin + Subdirector)
  // el onAuthStateChanged arriba ya inicializa y llama a cargarUsuariosYComunicados,
  // pero si queremos mostrar/ocultar el buscador se hace en ese flujo
}

// init()
init();
