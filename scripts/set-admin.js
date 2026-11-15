"use strict";
// Run locally with a Firebase service-account JSON kept OUTSIDE the repository:
// GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json node scripts/set-admin.js adminchik
const admin = require("../functions/node_modules/firebase-admin");
const username = process.argv[2];
if (!username) throw new Error("Usage: node scripts/set-admin.js <username>");
admin.initializeApp({ credential: admin.credential.applicationDefault() });
(async () => {
  const db = admin.firestore();
  const mapping = await db.collection("usernames").doc(username.toLowerCase()).get();
  if (!mapping.exists) throw new Error("Username not found. Register this account on the website first.");
  const uid = mapping.data().uid;
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log("Admin role assigned to", username, "uid:", uid);
  console.log("Ask the user to sign out and sign in again to refresh the token.");
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
