// perfil.js (Sustituye todo tu archivo por este)
// ------------------------------------------------
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

// elemento título (asegúrate que existe en el HTML)
const tituloPantallaEl = document.getElementById("tituloPantalla");

// =========================
let cacheUsuarios = [];
let cacheComunicados = [];
let usuarioActual = null;
let usuarioEnEdicion = null;

// nombre de la key en localStorage para persistir la caché de usuarios
const LS_KEY_USUARIOS = "cacheUsuarios_v1";

// =========================
// ROLES Y PERMISOS
// =========================
const PERMISOS = {
  Administrativo: {
    verUsuarios: true,
    crud: true,
    verBuscador: true,
    verComunicados: "limitados"
  },
  Subdirector: {
    verUsuarios: true,
    crud: false,
    verBuscador: true,
    verComunicados: "limitados"
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
// UTIL: debounce
// =========================
function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// =========================
// HELPERS: localStorage persistencia
// =========================
function guardarCacheEnLocal() {
  try {
    localStorage.setItem(LS_KEY_USUARIOS, JSON.stringify(cacheUsuarios));
    console.debug("[perfil] cacheUsuarios guardado en localStorage:", cacheUsuarios.length);
  } catch (e) {
    console.warn("[perfil] no se pudo guardar cache en localStorage:", e);
  }
}

function cargarCacheDesdeLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY_USUARIOS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    console.debug("[perfil] cacheUsuarios cargado desde localStorage:", parsed.length);
    return parsed;
  } catch (e) {
    console.warn("[perfil] error leyendo cache de localStorage:", e);
    return null;
  }
}

// =========================
// AUTENTICACIÓN
// =========================
onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");

  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (!snap.exists()) {
      alert("No se encontró tu perfil");
      return;
    }

    usuarioActual = snap.data();

    cargarVista();
    prepararBotones();
  } catch (e) {
    console.error("[perfil] error al obtener usuarioActual:", e);
  }
});

// =========================
// CONFIGURAR EVENTOS
// =========================
function prepararBotones() {
  const btnCerrar = document.getElementById("btnCerrar");
  if (btnCerrar) {
    btnCerrar.onclick = async () => {
      await signOut(auth);
      localStorage.clear();
      window.location.href = "login.html";
    };
  } else {
    console.warn("[perfil] btnCerrar no encontrado en DOM");
  }

  if (btnCancelar) btnCancelar.onclick = () => cerrarModal();
  if (btnGuardar) btnGuardar.onclick = () => guardarUsuario();
}

// =========================
// CARGAR VISTA SEGÚN ROL
// =========================
async function cargarVista() {
  if (!usuarioActual) {
    console.error("[perfil] usuarioActual no definido");
    return;
  }

  const permisos = PERMISOS[usuarioActual.rol] || PERMISOS["Profesor"];

  // Título dinámico (si existe elemento)
  if (tituloPantallaEl) {
    tituloPantallaEl.textContent = `Perfil ${usuarioActual.rol}`;
  } else {
    console.debug("[perfil] tituloPantalla no existe en el DOM");
  }

  // PERFIL
  main.innerHTML = `
    <h1 id="titulo-pantalla">Perfil</h1>
    <div class="perfil-box">
      <p><strong>Nombre:</strong> ${escapeHtml(usuarioActual.nombre || "-")}</p>
      <p><strong>Correo:</strong> ${escapeHtml(usuarioActual.correo || "-")}</p>
      <p><strong>Rol:</strong> ${escapeHtml(usuarioActual.rol || "-")}</p>
    </div>
  `;

  if (permisos.verUsuarios) await cargarUsuarios(permisos);

  await cargarComunicados(permisos.verComunicados);
}

// =========================
// ESCAPAR HTML simple para seguridad
// =========================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =========================
// CARGAR USUARIOS (robusto + persistente)
// =========================
async function cargarUsuarios(permisos) {
  // Render base (el buscador se añadirá luego si corresponde)
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

  // 1) Intentar cargar desde localStorage primero
  const local = cargarCacheDesdeLocal();
  if (local && local.length) {
    cacheUsuarios = local;
    renderUsuarios(cacheUsuarios, permisos);
  }

  // 2) Luego, intentar obtener desde Firestore si cacheUsuarios vacío (o para refrescar)
  try {
    if (!cacheUsuarios.length) {
      console.debug("[perfil] cache vacía → solicitando getDocs a Firestore");
      const snap = await getDocs(collection(db, "usuarios"));
      cacheUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // guardar en localStorage para futuras sesiones
      guardarCacheEnLocal();
      renderUsuarios(cacheUsuarios, permisos);
    } else {
      // opcional: refrescar en background sin sobrescribir a menos que cambie
      // aquí podrías implementar un onSnapshot si quieres realtime
      console.debug("[perfil] ya había cache cargada (desde localStorage)");
    }
  } catch (e) {
    console.error("[perfil] error al leer usuarios de Firestore:", e);
  }

  // =========================
  // Buscador – estable y con debounce
  // =========================
  if (permisos.verBuscador) {
    // asegurar que el input esté en DOM
    const input = document.getElementById("buscador");
    if (!input) {
      console.warn("[perfil] input buscador no encontrado en DOM");
      return;
    }

    const handle = debounce((value) => {
      try {
        const txt = String(value || "").trim().toLowerCase();

        if (txt === "") {
          renderUsuarios(cacheUsuarios, permisos);
          return;
        }

        const filtrados = cacheUsuarios.filter(u => {
          // defensivo: campos pueden faltar
          const nombre = (u.nombre || "").toString().toLowerCase();
          const correo = (u.correo || "").toString().toLowerCase();
          const nivel = (u.nivel || "").toString().toLowerCase();
          const rol = (u.rol || "").toString().toLowerCase();

          return (
            nombre.includes(txt) ||
            correo.includes(txt) ||
            nivel.includes(txt) ||
            rol.includes(txt)
          );
        });

        renderUsuarios(filtrados, permisos);
      } catch (err) {
        console.error("[perfil] error en filtrado buscador:", err);
      }
    }, 180);

    // attach listener
    input.removeEventListener("input", () => {}); // intento de limpiar listeners previos (no perfecto)
    input.addEventListener("input", (e) => handle(e.target.value));
    console.debug("[perfil] buscador inicializado");
  }
}

// =========================
// RENDER USUARIOS
// =========================
function renderUsuarios(lista, permisos) {
  const tbody = document.getElementById("tablaUsuarios");
  if (!tbody) {
    console.warn("[perfil] tbody #tablaUsuarios no encontrado");
    return;
  }

  tbody.innerHTML = "";

  if (!Array.isArray(lista) || lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${permisos.crud ? 6 : 5}" style="text-align:center">No hay usuarios</td></tr>`;
    return;
  }

  // construir filas
  const fragment = document.createDocumentFragment();
  lista.forEach(u => {
    const tr = document.createElement("tr");

    const tdNombre = document.createElement("td");
    tdNombre.textContent = u.nombre || "-";
    tr.appendChild(tdNombre);

    const tdCorreo = document.createElement("td");
    tdCorreo.textContent = u.correo || "-";
    tr.appendChild(tdCorreo);

    const tdRol = document.createElement("td");
    tdRol.textContent = u.rol || "-";
    tr.appendChild(tdRol);

    const tdNivel = document.createElement("td");
    tdNivel.textContent = u.nivel || "-";
    tr.appendChild(tdNivel);

    const tdGrado = document.createElement("td");
    tdGrado.textContent = u.grado || "-";
    tr.appendChild(tdGrado);

    if (permisos.crud) {
      const tdAcc = document.createElement("td");

      const btnE = document.createElement("button");
      btnE.className = "btn-edit";
      btnE.dataset.id = u.id;
      btnE.textContent = "Editar";
      btnE.onclick = () => abrirModal(u.id);

      const btnD = document.createElement("button");
      btnD.className = "btn-delete";
      btnD.dataset.id = u.id;
      btnD.textContent = "Eliminar";
      btnD.onclick = () => eliminarUsuario(u.id);

      tdAcc.appendChild(btnE);
      tdAcc.appendChild(btnD);

      tr.appendChild(tdAcc);
    }

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

// =========================
// MODAL USUARIO
// =========================
function abrirModal(id) {
  usuarioEnEdicion = cacheUsuarios.find(u => u.id === id);

  if (!usuarioEnEdicion) {
    alert("Usuario no encontrado en la cache");
    return;
  }

  nombreInput.value = usuarioEnEdicion.nombre || "";
  correoInput.value = usuarioEnEdicion.correo || "";
  nivelInput.value = usuarioEnEdicion.nivel || "";
  gradoInput.value = usuarioEnEdicion.grado || "";

  modal.style.display = "flex";
}

function cerrarModal() {
  modal.style.display = "none";
}

async function guardarUsuario() {
  if (!usuarioEnEdicion) return alert("No hay usuario en edición");

  const ref = doc(db, "usuarios", usuarioEnEdicion.id);

  try {
    await updateDoc(ref, {
      nombre: nombreInput.value,
      correo: correoInput.value,
      nivel: nivelInput.value,
      grado: gradoInput.value
    });

    // Actualizar cache local en memoria
    Object.assign(usuarioEnEdicion, {
      nombre: nombreInput.value,
      correo: correoInput.value,
      nivel: nivelInput.value,
      grado: gradoInput.value
    });

    // sincronizar a localStorage
    guardarCacheEnLocal();

    const permisos = PERMISOS[usuarioActual.rol];
    renderUsuarios(cacheUsuarios, permisos);
    cerrarModal();
  } catch (e) {
    console.error("[perfil] error guardando usuario:", e);
    alert("Error al guardar usuario");
  }
}

// =========================
// ELIMINAR USUARIO
// =========================
async function eliminarUsuario(id) {
  if (!confirm("¿Eliminar usuario?")) return;

  try {
    await deleteDoc(doc(db, "usuarios", id));
    cacheUsuarios = cacheUsuarios.filter(u => u.id !== id);
    guardarCacheEnLocal();
    const permisos = PERMISOS[usuarioActual.rol];
    renderUsuarios(cacheUsuarios, permisos);
  } catch (e) {
    console.error("[perfil] error eliminando usuario:", e);
    alert("Error al eliminar usuario");
  }
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
    try {
      const snap = await getDocs(query(collection(db, "comunicados"), orderBy("fecha", "desc")));
      cacheComunicados = snap.docs.map(d => d.data());
    } catch (e) {
      console.error("[perfil] error leyendo comunicados:", e);
    }
  }

  const lista = tipo === "limitados" ? cacheComunicados.slice(0, 5) : cacheComunicados;

  const tbody = document.getElementById("tablaComunicados");
  if (!tbody) return;
  tbody.innerHTML = "";

  lista.forEach(c => {
    const tr = document.createElement("tr");
    const tdT = document.createElement("td"); tdT.textContent = c.titulo || "-"; tr.appendChild(tdT);
    const tdD = document.createElement("td"); tdD.textContent = c.descripcion || "-"; tr.appendChild(tdD);
    const tdF = document.createElement("td"); tdF.textContent = c.fecha || "-"; tr.appendChild(tdF);
    tbody.appendChild(tr);
  });
}

// =========================
// FIN archivo
// =========================
