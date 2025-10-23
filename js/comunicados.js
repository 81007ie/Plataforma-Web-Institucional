import { db } from "./firebaseconfig.js";
import { 
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc, serverTimestamp, query, orderBy 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔹 Obtener usuario desde localStorage
const usuario = JSON.parse(localStorage.getItem("usuario"));
const formularioSection = document.getElementById("formulario-section");
const listaComunicados = document.getElementById("lista-comunicados");

// Redirigir si no hay usuario
if (!usuario) window.location.href = "login.html";
else if (usuario.rol === "Administrativo") formularioSection.classList.remove("oculto");

// 🔹 Referencia a colección
const comunicadosRef = collection(db, "comunicados");

// ==========================
// 🔹 Función para formatear fechas
// ==========================
function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr + "T00:00:00");
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}

// ==========================
// 🔹 Cargar comunicados
// ==========================
async function cargarComunicados() {
  listaComunicados.innerHTML = "<p>Cargando comunicados...</p>";

  const q = query(comunicadosRef, orderBy("fechaRegistro", "desc"));
  const snapshot = await getDocs(q);

  listaComunicados.innerHTML = "";

  if (snapshot.empty) {
    listaComunicados.innerHTML = "<p>No hay comunicados por el momento.</p>";
    return;
  }

  snapshot.forEach((docu) => {
    const data = docu.data();
    const div = document.createElement("div");
    div.className = "comunicado";

    const fechaFormateada = data.fecha ? formatearFecha(data.fecha) : "Desconocida";

    div.innerHTML = `
      <div>
        <h3>${data.titulo}</h3>
        <p>${data.descripcion}</p>
        <small>📅 ${fechaFormateada} — ✍️ ${data.creadoPor || "Desconocido"}</small>
      </div>
      ${usuario.rol === "Administrativo" ? `
        <div class="acciones">
          <button class="edit-btn" data-id="${docu.id}">✏️</button>
          <button class="delete-btn" data-id="${docu.id}">🗑️</button>
        </div>
      ` : ""}
    `;
    listaComunicados.appendChild(div);
  });

  agregarEventosCRUD();
}

// ==========================
// 🔹 Guardar nuevo comunicado
// ==========================
document.getElementById("form-comunicado")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = document.getElementById("titulo").value.trim();
  const fecha = document.getElementById("fecha").value;
  const descripcion = document.getElementById("descripcion").value.trim();

  if (!titulo || !fecha || !descripcion) return alert("Completa todos los campos.");

  await addDoc(comunicadosRef, {
    titulo,
    descripcion,
    fecha,
    creadoPor: usuario.nombre,
    fechaRegistro: serverTimestamp()
  });

  e.target.reset();
  cargarComunicados();
});

// ==========================
// 🔹 Editar / Eliminar comunicados (sin prompt feo 😄)
// ==========================
function agregarEventosCRUD() {
  // 🗑️ Eliminar comunicado
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("¿Eliminar este comunicado?")) {
        await deleteDoc(doc(db, "comunicados", id));
        cargarComunicados();
      }
    });
  });

  // ✏️ Editar comunicado con modal
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const div = btn.closest(".comunicado");
      const h3 = div.querySelector("h3");
      const p = div.querySelector("p");
      const fechaSmall = div.querySelector("small");
      const fechaActual = fechaSmall.textContent.split("—")[0].replace("📅 ", "").trim();

      // Crear modal
      const modal = document.createElement("div");
      modal.className = "modal-editar";
      modal.innerHTML = `
        <div class="modal-contenido">
          <h2>Editar Comunicado</h2>
          <label>Título:</label>
          <input type="text" id="edit-titulo" value="${h3.textContent}">
          <label>Descripción:</label>
          <textarea id="edit-descripcion">${p.textContent}</textarea>
          <label>Fecha:</label>
          <input type="date" id="edit-fecha" value="${formatearInputDate(fechaActual)}">
          <div class="modal-botones">
            <button id="guardar-cambios">Guardar</button>
            <button id="cancelar">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Cerrar modal
      modal.querySelector("#cancelar").addEventListener("click", () => modal.remove());

      // Guardar cambios
      modal.querySelector("#guardar-cambios").addEventListener("click", async () => {
        const nuevoTitulo = document.getElementById("edit-titulo").value.trim();
        const nuevaDescripcion = document.getElementById("edit-descripcion").value.trim();
        const nuevaFecha = document.getElementById("edit-fecha").value;

        if (!nuevoTitulo || !nuevaDescripcion || !nuevaFecha) {
          alert("Completa todos los campos.");
          return;
        }

        await updateDoc(doc(db, "comunicados", id), {
          titulo: nuevoTitulo,
          descripcion: nuevaDescripcion,
          fecha: nuevaFecha
        });

        modal.remove();
        cargarComunicados();
      });
    });
  });
}

// 🔹 Función para convertir fecha legible a formato input
function formatearInputDate(fechaLegible) {
  const partes = fechaLegible.split(" ");
  if (partes.length < 3) return "";
  const dia = partes[0];
  const mes = partes[1];
  const año = partes[2];
  const meses = {
    enero: "01", febrero: "02", marzo: "03", abril: "04",
    mayo: "05", junio: "06", julio: "07", agosto: "08",
    septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12"
  };
  return `${año}-${meses[mes.toLowerCase()]}-${dia.padStart(2, "0")}`;
}

// ==========================
// 🔹 Inicializar
// ==========================
cargarComunicados();
