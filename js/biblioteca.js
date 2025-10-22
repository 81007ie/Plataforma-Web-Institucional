import { db } from "./firebaseconfig.js";
import { 
  collection, addDoc, getDocs, deleteDoc, doc, Timestamp, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ================================
// 👤 Usuario actual
// ================================
const usuarioActual = JSON.parse(localStorage.getItem("usuarioActual")) || null;

const contenedorLibros = document.getElementById("biblioteca");
const contenedorHistorial = document.getElementById("historial");
const btnAgregarLibro = document.getElementById("btnAgregarLibro");
const modalAgregar = document.getElementById("modalAgregar");
const cerrarAgregar = document.getElementById("cerrarAgregar");
const confirmarAgregar = document.getElementById("confirmarAgregar");
const busqueda = document.getElementById("busqueda");

// ✏️ Modal de edición
const modalEditar = document.getElementById("modalEditar");
const cerrarEditar = document.getElementById("cerrarEditar");
const confirmarEditar = document.getElementById("confirmarEditar");

let libroEditandoId = null;

if (usuarioActual?.rol === "Admin") btnAgregarLibro.classList.remove("oculto");

// ===============================
// 📘 Cargar Libros
// ===============================
async function cargarLibros() {
  contenedorLibros.innerHTML = "";
  const snapshot = await getDocs(collection(db, "biblioteca/libros"));

  snapshot.forEach(docSnap => {
    const libro = docSnap.data();
    const card = document.createElement("div");
    card.className = "libro";
    card.innerHTML = `
      <h3>${libro.titulo}</h3>
      <p><strong>Autor:</strong> ${libro.autor}</p>
      <p><strong>Género:</strong> ${libro.genero}</p>
      <p class="estado ${libro.estado}">📖 ${libro.estado}</p>
      ${libro.estado === "disponible" ? `
        <button class="btn-accion btn-prestar" onclick="prestarLibro('${docSnap.id}', '${libro.titulo}')">📚 Prestar</button>
      ` : usuarioActual?.rol === "Admin" ? `
        <button class="btn-accion btn-devolver" onclick="devolverLibro('${docSnap.id}', '${libro.titulo}')">🔄 Devolver</button>
      ` : ""}
      ${usuarioActual?.rol === "Admin" ? `
        <button class="btn-accion btn-editar" onclick="editarLibro('${docSnap.id}')">✏️ Editar</button>
        <button class="btn-accion btn-eliminar" onclick="eliminarLibro('${docSnap.id}', '${libro.titulo}')">🗑️ Eliminar</button>
      ` : ""}
    `;
    contenedorLibros.appendChild(card);
  });
}

// ===============================
// 🧾 Cargar Historial
// ===============================
async function cargarHistorial() {
  contenedorHistorial.innerHTML = "";
  const snapshot = await getDocs(collection(db, "biblioteca/historial"));
  
  snapshot.forEach(docSnap => {
    const h = docSnap.data();
    const fecha = h.fecha?.toDate().toLocaleString();
    const div = document.createElement("div");
    div.className = "movimiento";
    div.innerHTML = `
      <strong>${h.accion}</strong> - ${h.libroTitulo} 
      ${h.usuario ? `por ${h.usuario}` : ""} 
      ${h.dni ? `(${h.dni})` : ""} 
      ${h.grado ? `- ${h.grado}` : ""} 
      <em>(${fecha})</em>
      ${usuarioActual?.rol === "Admin" ? `
        <button class="btn-accion btn-eliminar" onclick="eliminarHistorial('${docSnap.id}')">🗑️</button>` : ""}
    `;
    contenedorHistorial.appendChild(div);
  });
}

// ===============================
// ➕ Agregar Libro
// ===============================
btnAgregarLibro.addEventListener("click", () => modalAgregar.style.display = "block");
cerrarAgregar.addEventListener("click", () => modalAgregar.style.display = "none");

confirmarAgregar.addEventListener("click", async () => {
  const titulo = document.getElementById("nuevoTitulo").value.trim();
  const autor = document.getElementById("nuevoAutor").value.trim();
  const genero = document.getElementById("nuevoGenero").value.trim();

  if (!titulo || !autor) return alert("Completa todos los campos.");

  const libroNuevo = {
    titulo,
    autor,
    genero,
    estado: "disponible",
    prestadoA: null,
    fechaRegistro: Timestamp.now()
  };

  await addDoc(collection(db, "biblioteca/libros"), libroNuevo);
  await registrarHistorial("Agregado", libroNuevo);
  modalAgregar.style.display = "none";
  cargarLibros();
});

// ===============================
// ✏️ Editar Libro
// ===============================
window.editarLibro = async (id) => {
  libroEditandoId = id;
  const libroRef = doc(db, "biblioteca/libros", id);
  const libroSnap = await getDoc(libroRef);
  const libro = libroSnap.data();

  document.getElementById("editarTitulo").value = libro.titulo;
  document.getElementById("editarAutor").value = libro.autor;
  document.getElementById("editarGenero").value = libro.genero;

  modalEditar.style.display = "block";
};

cerrarEditar.addEventListener("click", () => modalEditar.style.display = "none");

confirmarEditar.addEventListener("click", async () => {
  const titulo = document.getElementById("editarTitulo").value.trim();
  const autor = document.getElementById("editarAutor").value.trim();
  const genero = document.getElementById("editarGenero").value.trim();

  if (!titulo || !autor) return alert("Completa todos los campos.");

  const libroRef = doc(db, "biblioteca/libros", libroEditandoId);
  await updateDoc(libroRef, { titulo, autor, genero });
  await registrarHistorial("Editado", { titulo });

  modalEditar.style.display = "none";
  cargarLibros();
  cargarHistorial();
});

// ===============================
// 📚 Prestar Libro
// ===============================
window.prestarLibro = async (id, titulo) => {
  if (!usuarioActual) return alert("Debes iniciar sesión para prestar un libro.");

  const libroRef = doc(db, "biblioteca/libros", id);
  await updateDoc(libroRef, {
    estado: "prestado",
    prestadoA: {
      nombre: usuarioActual.nombre,
      dni: usuarioActual.dni,
      grado: usuarioActual.grado
    }
  });

  await registrarHistorial("Prestado", {
    titulo,
    usuario: usuarioActual.nombre,
    dni: usuarioActual.dni,
    grado: usuarioActual.grado
  });

  cargarLibros();
  cargarHistorial();
};

// ===============================
// 🔄 Devolver Libro
// ===============================
window.devolverLibro = async (id, titulo) => {
  const libroRef = doc(db, "biblioteca/libros", id);
  await updateDoc(libroRef, {
    estado: "disponible",
    prestadoA: null
  });

  await registrarHistorial("Devuelto", { titulo });
  cargarLibros();
  cargarHistorial();
};

// ===============================
// 🗑️ Eliminar libro e historial
// ===============================
window.eliminarLibro = async (id, titulo) => {
  if (!confirm(`¿Eliminar "${titulo}"?`)) return;
  await deleteDoc(doc(db, "biblioteca/libros", id));
  await registrarHistorial("Eliminado", { titulo });
  cargarLibros();
  cargarHistorial();
};

window.eliminarHistorial = async (id) => {
  if (!confirm("¿Eliminar registro del historial?")) return;
  await deleteDoc(doc(db, "biblioteca/historial", id));
  cargarHistorial();
};

// ===============================
// 🧾 Registrar Acción
// ===============================
async function registrarHistorial(accion, libro) {
  await addDoc(collection(db, "biblioteca/historial"), {
    accion,
    libroTitulo: libro.titulo,
    usuario: libro.usuario || usuarioActual?.nombre,
    dni: libro.dni || usuarioActual?.dni || "",
    grado: libro.grado || usuarioActual?.grado || "",
    fecha: Timestamp.now()
  });
}

// ===============================
// 🔍 Buscador
// ===============================
busqueda.addEventListener("input", () => {
  const texto = busqueda.value.toLowerCase();
  document.querySelectorAll(".libro").forEach(libro => {
    const visible = libro.textContent.toLowerCase().includes(texto);
    libro.style.display = visible ? "block" : "none";
  });
});

// ===============================
// 🚀 Inicialización
// ===============================
cargarLibros();
cargarHistorial();
