// ============================================
// 🔥 MÓDULO PERFIL (Usuarios CRUD + Paginación)
// ============================================

import { auth, db } from "./firebaseconfig.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =================================================================
// 🔹 VARIABLES DE PAGINACIÓN
// =================================================================
let lastVisible = null;
let historyStack = [];
const pageSize = 5;

// =================================================================
// 🔹 DOM
// =================================================================
const contenido = document.getElementById("contenido");
const tituloPantalla = document.getElementById("titulo-pantalla");

// =================================================================
// 🔹 CARGAR TABLA DINÁMICA
// =================================================================
function renderTabla() {
  contenido.innerHTML = `
    <input type="text" placeholder="Buscar usuario..." class="input-buscar" id="inputBuscar">

    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Rol</th>
          <th>Grado</th>
          <th>Nivel</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="tabla-usuarios"></tbody>
    </table>

    <div style="margin-top: 15px; display:flex; gap:10px;">
      <button id="btnAnterior">Anterior</button>
      <button id="btnSiguiente">Siguiente</button>
    </div>
  `;
}

// Después del render, obtenemos los elementos
let tableBody, btnAnterior, btnSiguiente;

// =================================================================
// 🔹 CARGAR USUARIOS (PAGINADO)
// =================================================================
async function cargarUsuarios(reset = false) {
  if (reset) {
    lastVisible = null;
    historyStack = [];
  }

  let que;

  if (lastVisible) {
    que = query(
      collection(db, "usuarios"),
      orderBy("nombre"),
      startAfter(lastVisible),
      limit(pageSize)
    );
  } else {
    que = query(
      collection(db, "usuarios"),
      orderBy("nombre"),
      limit(pageSize)
    );
  }

  const snap = await getDocs(que);

  if (snap.empty) return;

  tableBody.innerHTML = "";

  snap.forEach(docu => {
    const data = docu.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.correo}</td>
      <td>${data.rol}</td>
      <td>${data.grado}</td>
      <td>${data.nivel}</td>
      <td>
        <button class="btn-edit" onclick="editarUsuario('${docu.id}', '${data.nombre}', '${data.correo}', '${data.rol}', '${data.grado}', '${data.nivel}')">Editar</button>

        <button class="btn-delete" onclick="eliminarUsuario('${docu.id}')">Eliminar</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // Guardamos el nuevo puntero
  historyStack.push(snap.docs[0]);
  lastVisible = snap.docs[snap.docs.length - 1];
}

// =================================================================
// 🔹 PAGINACIÓN
// =================================================================
window.addEventListener("click", async (e) => {
  if (e.target.id === "btnSiguiente") cargarUsuarios();
  
  if (e.target.id === "btnAnterior") {
    if (historyStack.length <= 1) return;

    historyStack.pop();
    const prevStart = historyStack[historyStack.length - 1];

    const que = query(
      collection(db, "usuarios"),
      orderBy("nombre"),
      startAfter(prevStart),
      limit(pageSize)
    );

    const snap = await getDocs(que);

    tableBody.innerHTML = "";
    snap.forEach(docu => {
      const data = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.nombre}</td>
        <td>${data.correo}</td>
        <td>${data.rol}</td>
        <td>${data.grado}</td>
        <td>${data.nivel}</td>
        <td>
          <button class="btn-edit" onclick="editarUsuario('${docu.id}', '${data.nombre}', '${data.correo}', '${data.rol}', '${data.grado}', '${data.nivel}')">Editar</button>
          <button class="btn-delete" onclick="eliminarUsuario('${docu.id}')">Eliminar</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    lastVisible = snap.docs[snap.docs.length - 1];
  }
});

// =================================================================
// 🔹 ELIMINAR USUARIO
// =================================================================
window.eliminarUsuario = async (id) => {
  const confirmacion = await Swal.fire({
    title: "¿Eliminar usuario?",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });

  if (!confirmacion.isConfirmed) return;

  await deleteDoc(doc(db, "usuarios", id));

  Swal.fire("Eliminado", "Usuario eliminado correctamente", "success");

  cargarUsuarios(true);
};

// =================================================================
// 🔹 EDITAR USUARIO
// =================================================================
let idEditando = null;

window.editarUsuario = (id, nombre, correo, rol, grado, nivel) => {
  idEditando = id;

  document.getElementById("modal-titulo").textContent = "Editar Usuario";

  document.getElementById("nombre-input").value = nombre;
  document.getElementById("correo-input").value = correo;
  document.getElementById("rol-input").value = rol;
  document.getElementById("grado-input").value = grado;
  document.getElementById("nivel-input").value = nivel;

  document.getElementById("modal-profesor").style.display = "flex";
};

// Guardar cambios
window.guardarProfesor = async () => {
  if (!idEditando) return;

  const nombre = document.getElementById("nombre-input").value;
  const correo = document.getElementById("correo-input").value;
  const rol = document.getElementById("rol-input").value;
  const grado = document.getElementById("grado-input").value;
  const nivel = document.getElementById("nivel-input").value;

  await updateDoc(doc(db, "usuarios", idEditando), {
    nombre, correo, rol, grado, nivel
  });

  Swal.fire("Actualizado", "Datos guardados correctamente", "success");

  cerrarModal();
  cargarUsuarios(true);
};

// cerrar modal
window.cerrarModal = () => {
  document.getElementById("modal-profesor").style.display = "none";
};

// =================================================================
// 🔹 INICIO
// =================================================================
window.addEventListener("DOMContentLoaded", () => {
  // Renderizamos tabla
  renderTabla();

  // Reasignamos elementos
  tableBody = document.getElementById("tabla-usuarios");
  btnAnterior = document.getElementById("btnAnterior");
  btnSiguiente = document.getElementById("btnSiguiente");

  tituloPantalla.textContent = "Gestión de Usuarios";

  cargarUsuarios(true);
});
