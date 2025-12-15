/* eslint-env node */
// scripts/setRole.js — run with: node setRole.js

const admin = require("firebase-admin");

// 1️⃣ Load your service account key (one level up from /scripts)
const serviceAccount = require("../creditapp-sandbox-firebase-adminsdk-fbsvc-71112fe411.json");

// 2️⃣ Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://creditapp-sandbox-default-rtdb.firebaseio.com"
});

// 3️⃣ Function to set the user role
async function setUserRole(uid, role) {
  try {
    await admin.auth().setCustomUserClaims(uid, { role });
    console.log(`✔ Role "${role}" set for user: ${uid}`);
    console.log("⚠ Ask the user to log out and log in again to refresh token.");
  } catch (err) {
    console.error("❌ Error setting role:", err);
  }
}

// 4️⃣ UPDATE THIS UID + ROLE
setUserRole("QveOq2AJcbQUtMuMHvB7ebDp1cw1", "manager");
