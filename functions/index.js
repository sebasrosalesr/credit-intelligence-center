/* eslint-env node */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Callable function: update a user's role.
 * Only callers with role === "owner" can change roles.
 * Mirrors changes into RTDB at user_roles/{uid}.
 */
exports.updateUserRole = functions.https.onCall(async (data, context) => {
  const { targetUid, role, email } = data;

  // 1️⃣ Must be authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in."
    );
  }

  // 2️⃣ Only owner can update roles
  const callerRole = context.auth.token.role;
  if (callerRole !== "owner") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only owner can update roles."
    );
  }

  // 3️⃣ Validate role
  const allowedRoles = ["owner", "credit", "manager"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Invalid role "${role}" supplied.`
    );
  }

  try {
    // 4️⃣ Update custom claims
    await admin.auth().setCustomUserClaims(targetUid, { role });

    // 5️⃣ Mirror update into RTDB
    const db = admin.database();
    await db.ref(`user_roles/${targetUid}`).update({
      role,
      email: email || null,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });

    return { success: true };
  } catch (err) {
    console.error("Error updating user role:", err);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to update role.",
      err.message
    );
  }
});
