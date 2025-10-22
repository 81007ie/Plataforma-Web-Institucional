import { auth, db } from "./firebaseconfig.js";
import { 
  collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔐 Rol del usuario desde Auth
let userRole = null;

// Elementos DOM
const categoryList = document.getElementById("category-list");
const parentCategorySelect = document.getElementById("parent-category-select");
const newCategoryInput = document.getElementById("new-category-name");
const newSubcategoryInput = document.getElementById("new-subcategory-name");
const addCategoryBtn = document.getElementById("add-category-btn");
const addSubcategoryBtn = document.getElementById("add-subcategory-btn");
const addResourceBtn = document.getElementById("add-resource-btn");
const resourceList = document.getElementById("resource-list");
const modal = document.getElementById("modal");
const closeModal = document.getElementById("close-modal");
const resourceTitle = document.getElementById("resource-title");
const resourceLink = document.getElementById("resource-link");
const resourceType = document.getElementById("resource-type");
const resourceDesc = document.getElementById("resource-desc");
const saveResourceBtn = document.getElementById("save-resource");
const adminPanel = document.getElementById("admin-panel");

// Modal confirmación
const modalConfirm = document.getElementById("modalConfirmacion");
const confirmarEliminarBtn = document.getElementById("confirmarEliminarBtn");
const cancelarEliminarBtn = document.getElementById("cancelarEliminarBtn");

let currentCategory = null;
let currentSubcategory = null;
let editingResourceId = null;
let eliminarCallback = null; // Función que se ejecutará si confirma eliminar

// ============================
// 🔹 DETERMINAR ROL Y CARGAR DATOS
// ============================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userSnap = await getDocs(collection(db, "usuarios"));
  userSnap.forEach(doc => {
    if (doc.id === user.uid) userRole = doc.data().rol;
  });

  if (userRole !== "Administrativo") {
    adminPanel.style.display = "none";
    addResourceBtn.style.display = "none";
  } else {
    adminPanel.style.display = "block";
    addResourceBtn.style.display = "block";
  }

  loadCategories();
});

// ============================
// 🔹 CARGAR CATEGORÍAS
// ============================
async function loadCategories() {
  const catSnap = await getDocs(collection(db, "categorias"));
  const categorias = [];
  catSnap.forEach(doc => categorias.push({ id: doc.id, ...doc.data() }));
  renderCategories(categorias);
}

addCategoryBtn.addEventListener("click", async () => {
  const name = newCategoryInput.value.trim();
  if (!name) return alert("Ingresa el nombre de la categoría");

  await addDoc(collection(db, "categorias"), {
    nombre: name,
    descripcion: "",
    fechaCreacion: serverTimestamp()
  });

  newCategoryInput.value = "";
  loadCategories();
});

function deleteCategory(catId) {
  eliminarCallback = async () => {
    await deleteDoc(doc(db, "categorias", catId));
    loadCategories();
  };
  modalConfirm.style.display = "flex";
}

// ============================
// 🔹 SUBCATEGORÍAS
// ============================
async function loadSubcategories(catId) {
  const subSnap = await getDocs(collection(db, "categorias", catId, "subcategorias"));
  const subs = [];
  subSnap.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
  return subs;
}

addSubcategoryBtn.addEventListener("click", async () => {
  const parentId = parentCategorySelect.value;
  const name = newSubcategoryInput.value.trim();
  if (!parentId || !name) return alert("Selecciona categoría y escribe el nombre de la subcategoría");

  await addDoc(collection(db, "categorias", parentId, "subcategorias"), {
    nombre: name,
    descripcion: "",
    fechaCreacion: serverTimestamp()
  });

  newSubcategoryInput.value = "";
  loadCategories();
});

function deleteSubcategory(catId, subId) {
  eliminarCallback = async () => {
    await deleteDoc(doc(db, "categorias", catId, "subcategorias", subId));
    loadCategories();
  };
  modalConfirm.style.display = "flex";
}

// ============================
// 🔹 RECURSOS
// ============================
async function loadResources(catId, subId) {
  const resSnap = await getDocs(collection(db, "categorias", catId, "subcategorias", subId, "recursos"));
  const recursos = [];
  resSnap.forEach(doc => recursos.push({ id: doc.id, ...doc.data() }));
  renderResources(recursos, catId, subId);
}

// Modal agregar recurso
addResourceBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  resourceTitle.value = "";
  resourceLink.value = "";
  resourceType.value = "";
  resourceDesc.value = "";
  editingResourceId = null;
});

closeModal.addEventListener("click", () => modal.style.display = "none");

saveResourceBtn.addEventListener("click", async () => {
  if (!currentCategory || !currentSubcategory) return alert("Selecciona categoría y subcategoría");
  const titulo = resourceTitle.value.trim();
  const url = resourceLink.value.trim();
  const tipo = resourceType.value.trim();
  const descripcion = resourceDesc.value.trim();
  if (!titulo || !url || !tipo) return alert("Completa todos los campos");

  const ref = collection(db, "categorias", currentCategory, "subcategorias", currentSubcategory, "recursos");

  if (editingResourceId) {
    await setDoc(doc(ref, editingResourceId), {
      titulo,
      descripcion,
      tipo,
      url,
      autor: auth.currentUser.displayName || "Admin",
      fechaSubida: serverTimestamp()
    });
  } else {
    await addDoc(ref, {
      titulo,
      descripcion,
      tipo,
      url,
      autor: auth.currentUser.displayName || "Admin",
      fechaSubida: serverTimestamp()
    });
  }

  modal.style.display = "none";
  loadResources(currentCategory, currentSubcategory);
});

function deleteResource(catId, subId, resId) {
  eliminarCallback = async () => {
    await deleteDoc(doc(db, "categorias", catId, "subcategorias", subId, "recursos", resId));
    loadResources(catId, subId);
  };
  modalConfirm.style.display = "flex";
}

// Editar recurso
function editResource(res) {
  modal.style.display = "flex";
  resourceTitle.value = res.titulo;
  resourceLink.value = res.url;
  resourceType.value = res.tipo;
  resourceDesc.value = res.descripcion;
  editingResourceId = res.id;
}

// ============================
// 🔹 RENDER CATEGORÍAS Y SUBCATEGORÍAS
// ============================
function renderCategories(categorias) {
  categoryList.innerHTML = "";
  parentCategorySelect.innerHTML = `<option value="">Selecciona categoría</option>`;

  categorias.forEach(cat => {
    const li = document.createElement("li");
    li.classList.add("categoria-item");

    const header = document.createElement("div");
    header.classList.add("categoria-header");
    header.textContent = cat.nombre;

    if (userRole === "Administrativo") {
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑";
      delBtn.classList.add("delete-btn");
      delBtn.onclick = (e) => { e.stopPropagation(); deleteCategory(cat.id); };
      header.appendChild(delBtn);
    }

    li.appendChild(header);

    const subUl = document.createElement("ul");
    subUl.classList.add("subcategoria-list");
    li.appendChild(subUl);

    header.addEventListener("click", async () => {
      subUl.style.display = subUl.style.display === "block" ? "none" : "block";
      currentCategory = cat.id;
      const subs = await loadSubcategories(cat.id);
      renderSubcategories(subs, subUl);
    });

    categoryList.appendChild(li);

    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = cat.nombre;
    parentCategorySelect.appendChild(option);
  });
}

function renderSubcategories(subs, ulContainer) {
  ulContainer.innerHTML = "";

  subs.forEach(sub => {
    const subLi = document.createElement("li");
    subLi.classList.add("subcategoria-item");
    subLi.textContent = sub.nombre;

    if (userRole === "Administrativo") {
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑";
      delBtn.classList.add("delete-btn");
      delBtn.onclick = (e) => { e.stopPropagation(); deleteSubcategory(currentCategory, sub.id); };
      subLi.appendChild(delBtn);
    }

    subLi.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSubcategory = sub.id;
      loadResources(currentCategory, sub.id);
    });

    ulContainer.appendChild(subLi);
  });
}

// ============================
// 🔹 RENDER RECURSOS
// ============================
function renderResources(data, catId, subId) {
  resourceList.innerHTML = "";
  if (data.length === 0) {
    resourceList.innerHTML = "<h3>No hay recursos disponibles</h3>";
    return;
  }

  data.forEach(r => {
    const card = document.createElement("div");
    card.classList.add("recurso-item");
    card.innerHTML = `
      <strong>${r.titulo}</strong>
      <p>${r.tipo}</p>
      <p>${r.descripcion}</p>
      <a href="${r.url}" target="_blank" class="view-btn">Ver/Descargar</a>
    `;

    if (userRole === "Administrativo") {
      const edit = document.createElement("button");
      edit.textContent = "Editar";
      edit.classList.add("edit-btn");
      edit.onclick = () => editResource(r);

      const del = document.createElement("button");
      del.textContent = "Eliminar";
      del.classList.add("delete-btn");
      del.onclick = () => deleteResource(catId, subId, r.id);

      card.appendChild(edit);
      card.appendChild(del);
    }

    resourceList.appendChild(card);
  });
}

// ============================
// 🔹 MODAL CONFIRMACIÓN
// ============================
confirmarEliminarBtn.addEventListener("click", async () => {
  if (eliminarCallback) await eliminarCallback();
  modalConfirm.style.display = "none";
  eliminarCallback = null;
});

cancelarEliminarBtn.addEventListener("click", () => {
  modalConfirm.style.display = "none";
  eliminarCallback = null;
});
