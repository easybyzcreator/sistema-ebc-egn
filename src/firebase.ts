import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";

// Configuração fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyBoSHCUsfEjLuyVH8T_kv9y9EWHSnznu4I",
  authDomain: "app-ebc-egn.firebaseapp.com",
  projectId: "app-ebc-egn",
  storageBucket: "app-ebc-egn.firebasestorage.app",
  messagingSenderId: "977345104546",
  appId: "1:977345104546:web:4bd81679770974075a65fb",
  measurementId: "G-6GCLGG9PWL"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Validação de conexão conforme as boas práticas do skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Por favor, verifique sua conexão ou configuração do Firebase.");
    }
  }
}
testConnection();
