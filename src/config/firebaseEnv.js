const DEFAULT_DB_URL = "https://creditapp-tm-default-rtdb.firebaseio.com/";

const useSandbox =
  import.meta.env.VITE_FIREBASE_ENV === "sandbox" ||
  String(import.meta.env.VITE_USE_SANDBOX || "").toLowerCase() === "true";

const firebaseEnv = useSandbox ? "sandbox" : "production";

const readEnv = (key) => {
  const prod = import.meta.env[`VITE_FIREBASE_${key}`];
  const sandbox = import.meta.env[`VITE_SANDBOX_FIREBASE_${key}`];
  if (useSandbox) {
    return sandbox || prod;
  }
  return prod;
};

const firebaseConfig = {
  apiKey: readEnv("API_KEY"),
  authDomain: readEnv("AUTH_DOMAIN"),
  databaseURL: readEnv("DATABASE_URL"),
  projectId: readEnv("PROJECT_ID"),
  storageBucket: readEnv("STORAGE_BUCKET"),
  messagingSenderId: readEnv("MESSAGING_SENDER_ID"),
  appId: readEnv("APP_ID"),
};

const currentDbUrl =
  (useSandbox ? import.meta.env.VITE_SANDBOX_FIREBASE_DATABASE_URL : import.meta.env.VITE_FIREBASE_DATABASE_URL) ||
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  DEFAULT_DB_URL;

const sandboxCredJsonPath = useSandbox
  ? import.meta.env.VITE_SANDBOX_FIREBASE_CREDENTIALS_PATH ||
    import.meta.env.VITE_FIREBASE_CREDENTIALS_PATH ||
    ""
  : null;

export { useSandbox, firebaseEnv, firebaseConfig, currentDbUrl, sandboxCredJsonPath };
