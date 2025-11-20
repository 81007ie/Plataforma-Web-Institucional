import { db } from "./firebaseconfig.js";
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

async function agregarCampoActivo() {
    const usuariosCol = collection(db, "usuarios"); // tu colección de usuarios
    const snapshot = await getDocs(usuariosCol);    // obtiene todos los usuarios

    for (const usuarioDoc of snapshot.docs) {
        const usuarioRef = doc(db, "usuarios", usuarioDoc.id);

        if (usuarioDoc.data().activo === undefined) {
            await updateDoc(usuarioRef, { activo: true });
            console.log(`Campo 'activo' agregado a ${usuarioDoc.id}`);
        }
    }

    console.log("Actualización completa!");
}

agregarCampoActivo();
