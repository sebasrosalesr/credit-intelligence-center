import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { firebaseConfig, firebaseEnv } from "./config/firebaseEnv";

console.log("🔥 Firebase env:", firebaseEnv, firebaseConfig.databaseURL);

let db = null;
let auth = null;

  try {
    if (!firebaseConfig.apiKey) {
      throw new Error("Missing Firebase API key – check .env.local");
    }
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
      console.log("✅ Firebase auth ready:", !!user);
    });
    console.log("✅ Firebase initialized OK");
  } catch (err) {
    console.error("❌ Firebase init error:", err);
  }

export { db, auth };
