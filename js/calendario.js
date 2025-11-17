import { db, auth } from "./firebaseconfig.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ========================================================
// 🔹 IndexedDB para caché
// ========================================================
const DB_NAME = "cache_plataforma";
const STORE_NAME = "cache_calendario";

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function guardarCache(key, data) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ key, data });
  return tx.complete;
}

async function leerCache(key) {
  const db = await abrirDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  return new Promise((resolve) => {
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror   = () => resolve(null);
  });
}

// ========================================================
// 🔹 Variables
// ========================================================
const daysContainer = document.getElementById("days");
const monthYear = document.getElementById("monthYear");
const modal = document.getElementById("modal");
const closeModal = document.querySelector(".close");
const form = document.getElementById("eventForm");
const view = document.getElementById("eventView");

const btnInicio = document.getElementById("btnInicio");
btnInicio.addEventListener("click", () => window.location.href = "dashboard.html");

let currentDate = new Date();
let eventos = [];
let userRol = "";
let eventoEditando = null;

// ========================================================
// 🔹 Autenticación y rol
// ========================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const usuarioRef = await getDoc(doc(db, "usuarios", user.uid));
  if (usuarioRef.exists()) userRol = usuarioRef.data().rol;

  // 🔥 Cargar eventos optimizados
  await cargarEventos();
});

// ========================================================
// 🔹 Lectura optimizada con getDocs + IndexedDB
// ========================================================
async function cargarEventos() {
  const CACHE_KEY = "lista_eventos";

  // 1️⃣ Buscar en caché
  const cache = await leerCache(CACHE_KEY);
  if (cache) {
    eventos = cache;
    renderCalendar();
  }

  // 2️⃣ Leer Firebase SIEMPRE (crear cache fresco)
  const snap = await getDocs(collection(db, "calendario"));
  const nuevosEventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  eventos = nuevosEventos;
  renderCalendar();

  // 3️⃣ Actualizar caché
  guardarCache(CACHE_KEY, nuevosEventos);
}

// ========================================================
// 🔹 Renderizar calendario
// ========================================================
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const months = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  monthYear.textContent = `${months[month]} ${year}`;
  daysContainer.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.classList.add("empty-day");
    daysContainer.appendChild(empty);
  }

  for (let day = 1; day <= lastDate; day++) {
    const fecha = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const div = document.createElement("div");

    div.textContent = day;
    div.classList.add("day");

    const hoy = new Date();
    if (
      day === hoy.getDate() &&
      month === hoy.getMonth() &&
      year === hoy.getFullYear()
    ) div.classList.add("today");

    // Evento
    const evento = eventos.find(e => e.fecha === fecha);
    if (evento) {
      div.classList.add("event-day");
      const tipo = (evento.tipo || "").trim().toLowerCase();
      if (tipo === "examen") div.classList.add("evento-examen");
      else if (tipo === "reunión" || tipo === "reunion") div.classList.add("evento-reunion");
      else if (tipo === "feriado") div.classList.add("evento-feriado");
      else div.classList.add("evento-otro");
    }

    div.addEventListener("click", () => abrirModal(fecha));
    div.style.animationDelay = `${day * 0.01}s`;

    daysContainer.appendChild(div);
  }
}

// ========================================================
// 🔹 Navegación
// ========================================================
document.getElementById("prev").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("next").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

// ========================================================
// 🔹 Abrir modal
// ========================================================
function abrirModal(fechaSeleccionada) {
  modal.style.display = "flex";
  modal.classList.add("fade-in");
  form.reset();
  eventoEditando = null;
  document.getElementById("fecha").value = fechaSeleccionada;

  const eventoExistente = eventos.find(e => e.fecha === fechaSeleccionada);

  const puedeEditar = (userRol === "Admin" || userRol === "Administrativo");

  if (puedeEditar) {
    form.style.display = "block";
    view.style.display = "none";

    document.getElementById("guardarEvento").style.display = "inline-block";
    document.getElementById("eliminarEvento").style.display = eventoExistente ? "inline-block" : "none";

    if (eventoExistente) {
      document.getElementById("titulo").value = eventoExistente.titulo;
      document.getElementById("descripcion").value = eventoExistente.descripcion;
      document.getElementById("hora").value = eventoExistente.hora || "";
      document.getElementById("tipo").value = eventoExistente.tipo || "";
      eventoEditando = eventoExistente;
    }

  } else {
    form.style.display = "none";
    view.style.display = "block";

    if (eventoExistente) {
      document.getElementById("viewTitulo").textContent = eventoExistente.titulo;
      document.getElementById("viewDescripcion").textContent = eventoExistente.descripcion;
      document.getElementById("viewFecha").textContent = eventoExistente.fecha;
      document.getElementById("viewHora").textContent = eventoExistente.hora || "—";
      document.getElementById("viewTipo").textContent = eventoExistente.tipo || "—";
    } else {
      document.getElementById("viewTitulo").textContent = "Sin eventos";
      document.getElementById("viewDescripcion").textContent = "No hay eventos programados.";
      document.getElementById("viewFecha").textContent = fechaSeleccionada;
      document.getElementById("viewHora").textContent = "—";
      document.getElementById("viewTipo").textContent = "—";
    }
  }
}

closeModal.addEventListener("click", () => {
  modal.classList.remove("fade-in");
  modal.classList.add("fade-out");
  setTimeout(() => {
    modal.style.display = "none";
    modal.classList.remove("fade-out");
  }, 250);
});

// ========================================================
// 🔹 Guardar
// ========================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (userRol !== "Admin" && userRol !== "Administrativo") {
    Swal.fire("⛔ Permiso denegado", "Solo administradores pueden modificar eventos.", "error");
    return;
  }

  const nuevoEvento = {
    titulo: document.getElementById("titulo").value.trim(),
    descripcion: document.getElementById("descripcion").value.trim(),
    fecha: document.getElementById("fecha").value,
    hora: document.getElementById("hora").value,
    tipo: document.getElementById("tipo").value,
    creadoPor: auth.currentUser.uid
  };

  try {
    if (eventoEditando) {
      await updateDoc(doc(db, "calendario", eventoEditando.id), nuevoEvento);
      Swal.fire("✅ Actualizado", "El evento fue modificado.", "success");
    } else {
      await addDoc(collection(db, "calendario"), nuevoEvento);
      Swal.fire("🎉 Evento creado", "El evento se agregó correctamente.", "success");
    }

    modal.style.display = "none";

    // 🔄 Recargar eventos y cache
    await cargarEventos();

  } catch (error) {
    console.error("Error al guardar:", error);
    Swal.fire("⚠️ Error", "No se pudo guardar el evento.", "error");
  }
});

// ========================================================
// 🔹 Eliminar
// ========================================================
document.getElementById("eliminarEvento").addEventListener("click", async () => {
  if (userRol !== "Admin" && userRol !== "Administrativo") {
    Swal.fire("⛔ Permiso denegado", "No tienes permiso para eliminar.", "error");
    return;
  }

  if (!eventoEditando) return;

  const result = await Swal.fire({
    title: "¿Eliminar este evento?",
    text: "No se puede deshacer.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });

  if (result.isConfirmed) {
    await deleteDoc(doc(db, "calendario", eventoEditando.id));
    Swal.fire("🗑️ Eliminado", "El evento fue eliminado.", "success");

    modal.style.display = "none";

    // 🔄 Recargar lista y cache
    await cargarEventos();
  }
});
