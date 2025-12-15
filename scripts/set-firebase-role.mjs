#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    [
      "Usage:",
      "  GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \\",
      "  FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com \\",
      "  node scripts/set-firebase-role.mjs --uid <uid> --role <owner|credit|manager> [--email <email>]",
      "",
      "Notes:",
      "- This sets both Firebase custom claims (auth token) and mirrors to RTDB at user_roles/<uid>.",
      "- You must re-login in the web app to refresh token claims.",
    ].join("\n"),
  );
  process.exit(message ? 1 : 0);
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) usage();

const require = createRequire(import.meta.url);
let admin;
try {
  admin = require("firebase-admin");
} catch {
  const here = dirname(fileURLToPath(import.meta.url));
  admin = require(resolvePath(here, "../functions/node_modules/firebase-admin"));
}

const uid = getArg("--uid");
const role = getArg("--role");
const email = getArg("--email");

if (!uid) usage("Missing --uid");
if (!role) usage("Missing --role");

const allowedRoles = new Set(["owner", "credit", "manager"]);
if (!allowedRoles.has(role)) usage(`Invalid --role "${role}"`);

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) usage("Missing GOOGLE_APPLICATION_CREDENTIALS");

const serviceAccount = JSON.parse(readFileSync(credPath, "utf8"));

const databaseURL =
  process.env.FIREBASE_DATABASE_URL ||
  `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL,
});

await admin.auth().setCustomUserClaims(uid, { role });
await admin.database().ref(`user_roles/${uid}`).update({
  role,
  email: email || null,
  updatedAt: admin.database.ServerValue.TIMESTAMP,
});

console.log(
  JSON.stringify(
    {
      success: true,
      uid,
      role,
      databaseURL,
      note: "User must sign out/in to refresh token claims.",
    },
    null,
    2,
  ),
);
