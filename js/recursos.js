import { auth, db } from "./firebaseconfig.js";
import {
  collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ============================
// 🔹 ROLES CON PERMISOS ADMIN
// ============================
//const rolesAdmin = ["Administrativo", "Auxiliar", "Toe", "Subdirector"];
const rolesAdmin = ["Administrativo", "Subdirector"];


// 🔐 Rol del usuario desde Auth
let userRole = null;

// ============================
// 🔹 CACHE LOCAL EN MEMORIA
// ============================
const cacheCategorias = new Map();
const cacheSubcategorias = new Map(); // key: catId
const cacheRecursos = new Map(); // key: `${catId}-${subId}`

// ============================
// 🔹 ELEMENTOS DOM
// ============================
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
const modalConfirm = document.getElementById("modalConfirmacion");
const confirmarEliminarBtn = document.getElementById("confirmarEliminarBtn");
const cancelarEliminarBtn = document.getElementById("cancelarEliminarBtn");

let currentCategory = null;
let currentSubcategory = null;
let editingResourceId = null;
let eliminarCallback = null;

// ============================
// 🔹 AUTENTICACIÓN Y CARGA INICIAL
// ============================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userSnap = await getDocs(collection(db, "usuarios"));
  userSnap.forEach(docu => {
    if (docu.id === user.uid) userRole = docu.data().rol;
  });

  const tienePermisos = rolesAdmin.includes(userRole);

  adminPanel.style.display = tienePermisos ? "block" : "none";
  addResourceBtn.style.display = tienePermisos ? "block" : "none";

  loadCategories();
});

// ============================
// 🔹 CARGAR CATEGORÍAS (OPTIMIZADO)
// ============================
async function loadCategories() {
  if (cacheCategorias.size === 0) {
    const snap = await getDocs(collection(db, "categorias"));
    snap.forEach(doc => cacheCategorias.set(doc.id, { id: doc.id, ...doc.data() }));
  }
  renderCategories([...cacheCategorias.values()]);
}

addCategoryBtn.addEventListener("click", async () => {
  const name = newCategoryInput.value.trim();
  if (!name) return alert("Ingresa el nombre de la categoría");

  const ref = await addDoc(collection(db, "categorias"), {
    nombre: name,
    descripcion: "",
    fechaCreacion: serverTimestamp()
  });

  cacheCategorias.set(ref.id, { id: ref.id, nombre: name });
  newCategoryInput.value = "";
  loadCategories();
});

function deleteCategory(catId) {
  eliminarCallback = async () => {
    await deleteDoc(doc(db, "categorias", catId));
    cacheCategorias.delete(catId);
    cacheSubcategorias.delete(catId);
    loadCategories();
  };
  modalConfirm.style.display = "flex";
}

// ============================
// 🔹 SUBCATEGORÍAS (OPTIMIZADO)
// ============================
async function loadSubcategories(catId) {
  if (!cacheSubcategorias.has(catId)) {
    const snap = await getDocs(collection(db, "categorias", catId, "subcategorias"));
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    cacheSubcategorias.set(catId, list);
  }
  return cacheSubcategorias.get(catId);
}

addSubcategoryBtn.addEventListener("click", async () => {
  const parentId = parentCategorySelect.value;
  const name = newSubcategoryInput.value.trim();
  if (!parentId || !name) return alert("Selecciona categoría y escribe el nombre");

  const ref = await addDoc(collection(db, "categorias", parentId, "subcategorias"), {
    nombre: name,
    descripcion: "",
    fechaCreacion: serverTimestamp()
  });

  if (!cacheSubcategorias.has(parentId)) cacheSubcategorias.set(parentId, []);
  cacheSubcategorias.get(parentId).push({ id: ref.id, nombre: name });

  newSubcategoryInput.value = "";
  loadCategories();
});

function deleteSubcategory(catId, subId) {
  eliminarCallback = async () => {
    await deleteDoc(doc(db, "categorias", catId, "subcategorias", subId));
    if (cacheSubcategorias.has(catId)) {
      cacheSubcategorias.set(
        catId,
        cacheSubcategorias.get(catId).filter(s => s.id !== subId)
      );
    }
    loadCategories();
  };
  modalConfirm.style.display = "flex";
}

// ============================
// 🔹 RECURSOS (OPTIMIZADO)
// ============================
async function loadResources(catId, subId) {
  const key = `${catId}-${subId}`;

  if (!cacheRecursos.has(key)) {
    const snap = await getDocs(collection(db, "categorias", catId, "subcategorias", subId, "recursos"));
    const list = [];
    snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    cacheRecursos.set(key, list);
  }

  renderResources(cacheRecursos.get(key), catId, subId);
}

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
  const key = `${currentCategory}-${currentSubcategory}`;

  if (editingResourceId) {
    await setDoc(doc(ref, editingResourceId), {
      titulo, descripcion, tipo, url,
      autor: auth.currentUser.displayName || "Admin",
      fechaSubida: serverTimestamp()
    });

    const arr = cacheRecursos.get(key);
    const index = arr.findIndex(r => r.id === editingResourceId);
    arr[index] = { id: editingResourceId, titulo, descripcion, tipo, url };
  } else {
    const newDoc = await addDoc(ref, {
      titulo, descripcion, tipo, url,
      autor: auth.currentUser.displayName || "Admin",
      fechaSubida: serverTimestamp()
    });

    if (!cacheRecursos.has(key)) cacheRecursos.set(key, []);
    cacheRecursos.get(key).push({
      id: newDoc.id,
      titulo, descripcion, tipo, url
    });
  }

  modal.style.display = "none";
  loadResources(currentCategory, currentSubcategory);
});

function deleteResource(catId, subId, resId) {
  eliminarCallback = async () => {
    await deleteDoc(doc(db, "categorias", catId, "subcategorias", subId, "recursos", resId));

    const key = `${catId}-${subId}`;
    cacheRecursos.set(
      key,
      cacheRecursos.get(key).filter(r => r.id !== resId)
    );

    loadResources(catId, subId);
  };

  modalConfirm.style.display = "flex";
}

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

    if (rolesAdmin.includes(userRole)) {
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

    if (rolesAdmin.includes(userRole)) {
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

    if (rolesAdmin.includes(userRole)) {
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
// 🔹 MODAL CONFIRMAR
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
