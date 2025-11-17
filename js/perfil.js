import { auth, db } from "./firebaseconfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ---------------------------
// CACHE GLOBAL
// ---------------------------
let cacheUsuarios = null;
let cacheComunicados = null;

// ---------------------------
// ROLES Y PERMISOS
// ---------------------------
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

// ---------------------------
// ON AUTH
// ---------------------------
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

// ---------------------------
// MANEJADOR DE VISTAS SEGÚN ROL
// ---------------------------
async function cargarVista(usuario) {
  const rol = usuario.rol;
  const permisos = PERMISOS[rol];

  contenido.innerHTML = `
    <div class="info">
      <p>Nombre: <span>${usuario.nombre}</span></p>
      <p>Rol: <span>${rol}</span></p>
      <p>Correo: <span>${usuario.correo}</span></p>
    </div>
  `;

  if (permisos.verUsuarios) await renderUsuarios(rol, permisos);
  if (permisos.verComunicados) await renderComunicados(permisos.verComunicados);
}

// ---------------------------
// USUARIOS (ADMIN / SUBDIRECTOR)
// ---------------------------
async function renderUsuarios(rol, permisos) {
  contenido.innerHTML += `<h2>Lista de Usuarios</h2>`;

  if (permisos.verBuscador) {
    contenido.innerHTML += `
      <input type="text" id="buscador" placeholder="Buscar..." 
      style="width:60%; padding:8px; margin-bottom:10px;">
    `;
  }

  contenido.innerHTML += `
    <table>
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

  // Traer usuarios SOLO una vez
  if (!cacheUsuarios) {
    const snap = await getDocs(collection(db, "usuarios"));
    cacheUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // Mostrar solo 10 usuarios al inicio
  mostrarUsuarios(cacheUsuarios.slice(0, 10), permisos);

  // Buscador funcional (con fix)
  if (permisos.verBuscador) {
    setTimeout(() => {
      const buscador = document.getElementById("buscador");
      if (!buscador) return;

      buscador.oninput = (e) => {
        const texto = e.target.value.toLowerCase();
        const filtrados = cacheUsuarios.filter(u =>
          u.nombre.toLowerCase().includes(texto) ||
          u.correo.toLowerCase().includes(texto) ||
          (u.nivel || "").toLowerCase().includes(texto)
        );
        mostrarUsuarios(filtrados, permisos);
      };
    }, 20);
  }
}

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

// ---------------------------
// CRUD SOLO ADMINISTRATIVO
// ---------------------------
window.editarUsuario = (id) => {
  if (!confirm("¿Editar usuario?")) return;
  console.log("Editar:", id);
};

window.eliminarUsuario = async (id) => {
  if (!confirm("¿Eliminar usuario?")) return;
  await deleteDoc(doc(db, "usuarios", id));

  cacheUsuarios = cacheUsuarios.filter(u => u.id !== id);
  mostrarUsuarios(cacheUsuarios, PERMISOS["Administrativo"]);
};

// ---------------------------
// COMUNICADOS
// ---------------------------
async function renderComunicados(tipo) {
  contenido.innerHTML += `<h2>Comunicados</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="tablaComunicados"></tbody>
    </table>
  `;

  if (!cacheComunicados) {
    const snap = await getDocs(query(collection(db, "comunicados"), orderBy("fecha", "desc")));
    cacheComunicados = snap.docs.map(d => d.data());
  }

  let lista = cacheComunicados;

  if (tipo === "limitados") {
    lista = lista.slice(0, 5);
  }

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
