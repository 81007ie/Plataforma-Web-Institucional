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
// DOM ELEMENTS
// =========================
const contenido = document.getElementById("contenido");
const modal = document.getElementById("modal-usuario");

const nombreInput = document.getElementById("nombre-input");
const correoInput = document.getElementById("correo-input");
const gradoInput = document.getElementById("grado-input");
const nivelInput = document.getElementById("nivel-input");

// =========================
let cacheUsuarios = null;
let cacheComunicados = null;
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

  const usuario = snap.data();
  cargarVista(usuario);

  document.getElementById("btnCerrar").onclick = async () => {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "login.html";
  };
});

// =========================
// CARGAR VISTA SEGÚN ROL
// =========================
async function cargarVista(usuario) {
  const permisos = PERMISOS[usuario.rol];

  // PERFIL DEL USUARIO
  contenido.innerHTML = `
    <div class="perfil-box">
      <p><strong>Nombre:</strong> ${usuario.nombre}</p>
      <p><strong>Rol:</strong> ${usuario.rol}</p>
      <p><strong>Correo:</strong> ${usuario.correo}</p>
    </div>
  `;

  if (permisos.verUsuarios) await renderUsuarios(usuario.rol, permisos);
  if (permisos.verComunicados) await renderComunicados(permisos.verComunicados);
}

// =========================
// MOSTRAR LISTA DE USUARIOS
// =========================
async function renderUsuarios(rol, permisos) {
  contenido.innerHTML += `
    <h2>Lista de Usuarios</h2>

    ${permisos.verBuscador ? `
      <input type="text" id="buscador" placeholder="Buscar..." class="input-buscar">
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

  if (!cacheUsuarios) {
    const snap = await getDocs(collection(db, "usuarios"));
    cacheUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  mostrarUsuarios(cacheUsuarios, permisos);

  if (permisos.verBuscador) {
    const buscador = document.getElementById("buscador");
    buscador.oninput = () => {
      const texto = buscador.value.toLowerCase();
      const filtrados = cacheUsuarios.filter(u =>
        u.nombre.toLowerCase().includes(texto) ||
        u.correo.toLowerCase().includes(texto) ||
        (u.nivel || "").toLowerCase().includes(texto)
      );
      mostrarUsuarios(filtrados, permisos);
    };
  }
}

// =========================
// RENDERIZAR TABLA USUARIOS
// =========================
function mostrarUsuarios(lista, permisos) {
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
              <button onclick="editarUsuario('${u.id}')">Editar</button>
              <button onclick="eliminarUsuario('${u.id}')">Eliminar</button>
            </td>`
          : ""
        }
      </tr>
    `;
  });
}

// =========================
// EDITAR USUARIO – MODAL
// =========================
window.editarUsuario = (id) => {
  usuarioEnEdicion = cacheUsuarios.find(u => u.id === id);

  nombreInput.value = usuarioEnEdicion.nombre;
  correoInput.value = usuarioEnEdicion.correo;
  nivelInput.value = usuarioEnEdicion.nivel || "";
  gradoInput.value = usuarioEnEdicion.grado || "";

  modal.style.display = "flex";
};

window.cerrarModal = () => {
  modal.style.display = "none";
};

window.guardarUsuario = async () => {
  const ref = doc(db, "usuarios", usuarioEnEdicion.id);

  await updateDoc(ref, {
    nombre: nombreInput.value,
    correo: correoInput.value,
    nivel: nivelInput.value,
    grado: gradoInput.value
  });

  // actualizar cache
  Object.assign(usuarioEnEdicion, {
    nombre: nombreInput.value,
    correo: correoInput.value,
    nivel: nivelInput.value,
    grado: gradoInput.value
  });

  mostrarUsuarios(cacheUsuarios, PERMISOS["Administrativo"]);
  modal.style.display = "none";
};

// =========================
// ELIMINAR USUARIO
// =========================
window.eliminarUsuario = async (id) => {
  if (!confirm("¿Eliminar usuario?")) return;

  await deleteDoc(doc(db, "usuarios", id));

  cacheUsuarios = cacheUsuarios.filter(u => u.id !== id);
  mostrarUsuarios(cacheUsuarios, PERMISOS["Administrativo"]);
};

// =========================
// MOSTRAR COMUNICADOS
// =========================
async function renderComunicados(tipo) {
  contenido.innerHTML += `
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

  if (!cacheComunicados) {
    const snap = await getDocs(query(collection(db, "comunicados"), orderBy("fecha", "desc")));
    cacheComunicados = snap.docs.map(d => d.data());
  }

  let lista = cacheComunicados;
  if (tipo === "limitados") lista = lista.slice(0, 5);

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
