import { db } from "./firebaseconfig.js";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";



// ======================================================
// 🔹 VARIABLES Y CONFIGURACIÓN
// ======================================================
const usuario = JSON.parse(localStorage.getItem("usuario"));
const formularioSection = document.getElementById("formulario-section");
const listaComunicados = document.getElementById("lista-comunicados");

if (!usuario) window.location.href = "login.html";
else if (usuario.rol === "Administrativo") formularioSection.classList.remove("oculto");

const comunicadosRef = collection(db, "comunicados");
let cacheComunicados = [];
let ultimaActualizacion = 0;

// ======================================================
// 🔹 FORMATEAR FECHA
// ======================================================
function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr + "T00:00:00");
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}

// ======================================================
// 🔹 RENDERIZAR COMUNICADOS
// ======================================================
function renderizarComunicados(datos) {
  listaComunicados.innerHTML = "";

  if (datos.length === 0) {
    listaComunicados.innerHTML = "<p>No hay comunicados por el momento.</p>";
    return;
  }

  datos.forEach((data) => {
    const div = document.createElement("div");
    div.className = "comunicado";
    const fechaFormateada = data.fecha ? formatearFecha(data.fecha) : "Desconocida";

    div.innerHTML = `
      <div class="contenido">
        <h3>${data.titulo}</h3>
        <p>${data.descripcion}</p>
        <small>📅 ${fechaFormateada} — ✍️ ${data.creadoPor || "Desconocido"}</small>
      </div>
      ${usuario.rol === "Administrativo" ? `
        <div class="acciones">
          <button class="edit-btn" data-id="${data.id}">✏️</button>
          <button class="delete-btn" data-id="${data.id}">🗑️</button>
        </div>` : ""}
    `;
    listaComunicados.appendChild(div);
  });

  agregarEventosCRUD();
}

// ======================================================
// 🔹 CARGAR COMUNICADOS (con cache y limpieza)
// ======================================================
async function cargarComunicados(force = false) {
  const ahora = Date.now();
  const tiempoTranscurrido = (ahora - ultimaActualizacion) / 1000; // segundos

  listaComunicados.innerHTML = "<p>Cargando comunicados...</p>";

  // Usa cache si no se ha pasado 5 minutos o no se fuerza actualización
  if (cacheComunicados.length > 0 && tiempoTranscurrido < 300 && !force) {
    renderizarComunicados(cacheComunicados);
    return;
  }

  try {
    const q = query(comunicadosRef, orderBy("fechaRegistro", "desc"));
    const snapshot = await getDocs(q);

    cacheComunicados = snapshot.docs.map(docu => ({
      id: docu.id,
      ...docu.data()
    }));

    ultimaActualizacion = Date.now();

    // Mostrar primero los más recientes (ya ordenados desc)
    renderizarComunicados(cacheComunicados);

    // 🔹 Limpieza automática: mantener solo los 50 más recientes
    if (cacheComunicados.length > 50) cacheComunicados.splice(50);

  } catch (error) {
    console.error("Error al cargar comunicados:", error);
    listaComunicados.innerHTML = "<p>Error al cargar los comunicados.</p>";
  }
}

// ======================================================
// 🔹 GUARDAR NUEVO COMUNICADO
// ======================================================
document.getElementById("form-comunicado")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = document.getElementById("titulo").value.trim();
  const fecha = document.getElementById("fecha").value;
  const descripcion = document.getElementById("descripcion").value.trim();

  if (!titulo || !fecha || !descripcion) return alert("Completa todos los campos.");

  try {
    const nuevoDoc = await addDoc(comunicadosRef, {
      titulo,
      descripcion,
      fecha,
      creadoPor: usuario.nombre,
      fechaRegistro: serverTimestamp()
    });

    cacheComunicados.unshift({
      id: nuevoDoc.id,
      titulo,
      descripcion,
      fecha,
      creadoPor: usuario.nombre,
      fechaRegistro: new Date()
    });

    e.target.reset();
    renderizarComunicados(cacheComunicados);
  } catch (error) {
    console.error("Error al guardar comunicado:", error);
  }
});

// ======================================================
// 🔹 CRUD: EDITAR / ELIMINAR
// ======================================================
function agregarEventosCRUD() {
  // 🗑️ Eliminar comunicado
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("¿Eliminar este comunicado?")) return;
      await deleteDoc(doc(db, "comunicados", id));
      cacheComunicados = cacheComunicados.filter(c => c.id !== id);
      renderizarComunicados(cacheComunicados);
    });
  });

  // ✏️ Editar comunicado
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => abrirModalEdicion(btn.dataset.id));
  });
}

// ======================================================
// 🔹 MODAL DE EDICIÓN (mejorado)
// ======================================================
function abrirModalEdicion(id) {
  const comunicado = cacheComunicados.find(c => c.id === id);
  if (!comunicado) return;

  const modal = document.createElement("div");
  modal.className = "modal-editar";
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-contenido animar">
      <h2>Editar Comunicado</h2>
      <label>Título:</label>
      <input type="text" id="edit-titulo" value="${comunicado.titulo}">
      <label>Descripción:</label>
      <textarea id="edit-descripcion">${comunicado.descripcion}</textarea>
      <label>Fecha:</label>
      <input type="date" id="edit-fecha" value="${comunicado.fecha}">
      <div class="modal-botones">
        <button id="guardar-cambios">Guardar</button>
        <button id="cancelar">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Cerrar al hacer clic fuera
  modal.querySelector(".modal-overlay").addEventListener("click", () => modal.remove());
  modal.querySelector("#cancelar").addEventListener("click", () => modal.remove());

  // Guardar cambios
  modal.querySelector("#guardar-cambios").addEventListener("click", async () => {
    const nuevoTitulo = document.getElementById("edit-titulo").value.trim();
    const nuevaDescripcion = document.getElementById("edit-descripcion").value.trim();
    const nuevaFecha = document.getElementById("edit-fecha").value;

    if (!nuevoTitulo || !nuevaDescripcion || !nuevaFecha)
      return alert("Completa todos los campos.");

    await updateDoc(doc(db, "comunicados", id), {
      titulo: nuevoTitulo,
      descripcion: nuevaDescripcion,
      fecha: nuevaFecha
    });

    const index = cacheComunicados.findIndex(c => c.id === id);
    if (index !== -1) {
      cacheComunicados[index] = { ...cacheComunicados[index], titulo: nuevoTitulo, descripcion: nuevaDescripcion, fecha: nuevaFecha };
    }

    modal.remove();
    renderizarComunicados(cacheComunicados);
  });
}

// ======================================================
// 🔹 ESCUCHAR CAMBIOS EN TIEMPO REAL
// ======================================================
function escucharActualizaciones() {
  const q = query(comunicadosRef, orderBy("fechaRegistro", "desc"));
  onSnapshot(q, (snapshot) => {
    const nuevos = snapshot.docs.map(docu => ({ id: docu.id, ...docu.data() }));
    if (JSON.stringify(nuevos) !== JSON.stringify(cacheComunicados)) {
      cacheComunicados = nuevos;
      renderizarComunicados(cacheComunicados);
    }
  });
}

// ======================================================
// 🔹 INICIALIZACIÓN
// ======================================================
cargarComunicados();
escucharActualizaciones();
