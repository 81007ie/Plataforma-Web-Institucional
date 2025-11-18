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
  orderBy,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ======================================================
// 🔹 Elementos del DOM
// ======================================================
const contenido = document.getElementById("contenido");
const tituloPantalla = document.getElementById("titulo-pantalla");
const modal = document.getElementById("modal-profesor");


// ======================================================
// 🔹 Verificar sesión actual
// ======================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Estás saliendo de tu cuenta...");
    window.location.href = "login.html";
    return;
  }

  const userRef = doc(db, "usuarios", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    alert("No se encontraron tus datos en la base de datos");
    return;
  }

  const usuario = userSnap.data();
  tituloPantalla.textContent = `Perfil ${usuario.rol}`;

  // Botón cerrar sesión
  document.getElementById("btnCerrar").addEventListener("click", async () => {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "login.html";
  });

  // Render según rol
  if (usuario.rol === "Administrativo") renderAdmin(usuario);
  else if (usuario.rol === "Profesor") renderProfesor(usuario);
  else contenido.innerHTML = "<p>Rol no reconocido.</p>";
});


// ======================================================
// 🔹 ADMINISTRATIVO (solo 5 usuarios + paginación + búsqueda)
// ======================================================
let ultimaPaginaUsuarios = null; // para paginar

async function renderAdmin(usuario) {
  contenido.innerHTML = `
    <div class="info">
      <p>Nombre: <span>${usuario.nombre}</span></p>
      <p>Rol: <span>${usuario.rol}</span></p>
    </div>

    <h2>Lista de Profesores</h2>

    <input type="text" id="buscador" placeholder="Buscar por nombre, correo, rol o nivel..."
      style="width: 60%; padding: 8px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #ccc;">

    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Grado/Salón/Materia</th>
          <th>Nivel</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="lista-profesores"></tbody>
    </table>

    <button id="btnVerMas" style="margin-top:10px; padding:8px;">Ver más</button>
  `;

  document.getElementById("buscador").addEventListener("input", filtrarProfesores);

  await cargarProfesoresRecientes();

  document.getElementById("btnVerMas").addEventListener("click", cargarMasProfesores);
}


// ======================================================
// 🔹 1. Cargar solo 5 recientes
// ======================================================
async function cargarProfesoresRecientes() {
  const tbody = document.getElementById("lista-profesores");
  tbody.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";

  const q = query(
    collection(db, "usuarios"),
    orderBy("fechaRegistro", "desc"),
    limit(5)
  );

  const snap = await getDocs(q);

  ultimaPaginaUsuarios = snap.docs[snap.docs.length - 1];

  tbody.innerHTML = "";
  snap.forEach((docSnap) => pintarProfesor(docSnap));
}


// ======================================================
// 🔹 2. Cargar paginación (siguiente 5)
// ======================================================
async function cargarMasProfesores() {
  if (!ultimaPaginaUsuarios) return;

  const q = query(
    collection(db, "usuarios"),
    orderBy("fechaRegistro", "desc"),
    startAfter(ultimaPaginaUsuarios),
    limit(5)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    alert("No hay más profesores");
    return;
  }

  ultimaPaginaUsuarios = snap.docs[snap.docs.length - 1];

  snap.forEach((docSnap) => pintarProfesor(docSnap));
}


// ======================================================
// 🔹 Pintar profesor en tabla
// ======================================================
function pintarProfesor(docSnap) {
  const p = docSnap.data();
  if (p.rol !== "Profesor") return;

  const tbody = document.getElementById("lista-profesores");

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${p.nombre}</td>
    <td>${p.correo}</td>
    <td>${p.grado || "-"}</td>
    <td>${p.nivel || "-"}</td>
    <td>
      <button onclick="editarProfesor('${docSnap.id}', '${p.nombre}', '${p.correo}', '${p.grado}', '${p.nivel}')">Editar</button>
      <button onclick="eliminarProfesor('${docSnap.id}')">Eliminar</button>
    </td>
  `;

  tbody.appendChild(tr);
}


// ======================================================
// 🔹 Búsqueda dinámica en Firestore
// ======================================================
async function filtrarProfesores(e) {
  const texto = e.target.value.toLowerCase().trim();

  if (texto === "") {
    cargarProfesoresRecientes();
    return;
  }

  const tbody = document.getElementById("lista-profesores");
  tbody.innerHTML = "<tr><td colspan='5'>Buscando...</td></tr>";

  const snap = await getDocs(collection(db, "usuarios"));
  tbody.innerHTML = "";

  snap.forEach((docSnap) => {
    const p = docSnap.data();

    if (p.rol !== "Profesor") return;

    const match =
      (p.nombre || "").toLowerCase().includes(texto) ||
      (p.correo || "").toLowerCase().includes(texto) ||
      (p.nivel || "").toLowerCase().includes(texto) ||
      (p.rol || "").toLowerCase().includes(texto);

    if (match) pintarProfesor(docSnap);
  });
}


// ======================================================
// 🔹 Modal editar
// ======================================================
window.editarProfesor = (id, nombre, correo, grado, nivel) => {
  document.getElementById("modal-titulo").textContent = "Editar Profesor";
  document.getElementById("nombre-input").value = nombre;
  document.getElementById("correo-input").value = correo;
  document.getElementById("grado-input").value = grado;
  document.getElementById("nivel-input").value = nivel;
  modal.style.display = "flex";
  modal.dataset.id = id;
};

window.cerrarModal = () => { modal.style.display = "none"; };

window.guardarProfesor = async () => {
  const id = modal.dataset.id;

  await updateDoc(doc(db, "usuarios", id), {
    nombre: document.getElementById("nombre-input").value,
    correo: document.getElementById("correo-input").value,
    grado: document.getElementById("grado-input").value,
    nivel: document.getElementById("nivel-input").value
  });

  cerrarModal();
  cargarProfesoresRecientes();
};

window.eliminarProfesor = async (id) => {
  if (confirm("¿Desea eliminar este profesor?")) {
    await deleteDoc(doc(db, "usuarios", id));
    cargarProfesoresRecientes();
  }
};


// ======================================================
// 🔹 PROFESOR (Comunicados 5 recientes + paginación)
// ======================================================
let ultimoComunicado = null;

async function renderProfesor(usuario) {
  contenido.innerHTML = `
    <div class="info">
      <p>Nombre: <span>${usuario.nombre}</span></p>
      <p>Rol: <span>${usuario.rol}</span></p>
      <p>Grado/Salón/Materia: <span>${usuario.grado || "-"}</span></p>
      <p>Correo: <span>${usuario.correo}</span></p>
    </div>

    <h2>Comunicados Recientes</h2>
    <table>
      <thead><tr><th>Título</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody id="lista-comunicados"></tbody>
    </table>

    <button id="btnMasComunicados" style="margin-top:10px; padding:8px;">Ver más comunicados</button>
  `;

  await cargarComunicadosRecientes();

  document.getElementById("btnMasComunicados")
    .addEventListener("click", cargarMasComunicados);
}


// ======================================================
// 🔹 Comunicados → cargar 5 recientes
// ======================================================
async function cargarComunicadosRecientes() {
  const tbody = document.getElementById("lista-comunicados");
  tbody.innerHTML = "<tr><td colspan='3'>Cargando...</td></tr>";

  const q = query(
    collection(db, "comunicados"),
    orderBy("fecha", "desc"),
    limit(5)
  );

  const snap = await getDocs(q);
  ultimoComunicado = snap.docs[snap.docs.length - 1];

  tbody.innerHTML = "";
  snap.forEach((d) => pintarComunicado(d));
}


// ======================================================
// 🔹 Comunicados → Paginar otros 5
// ======================================================
async function cargarMasComunicados() {
  if (!ultimoComunicado) return;

  const q = query(
    collection(db, "comunicados"),
    orderBy("fecha", "desc"),
    startAfter(ultimoComunicado),
    limit(5)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    alert("No hay más comunicados");
    return;
  }

  ultimoComunicado = snap.docs[snap.docs.length - 1];

  snap.forEach((d) => pintarComunicado(d));
}


// ======================================================
// 🔹 Pintar comunicado
// ======================================================
function pintarComunicado(docSnap) {
  const tbody = document.getElementById("lista-comunicados");
  const c = docSnap.data();

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${c.titulo}</td>
    <td>${c.descripcion || "Sin descripción"}</td>
    <td>${c.fecha}</td>
  `;
  tbody.appendChild(tr);
}
