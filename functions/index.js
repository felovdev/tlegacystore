"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });
const db = admin.firestore();
const auth = admin.auth();

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Нужно войти в аккаунт.");
  return request.auth;
}
function requireAdmin(request) {
  const user = requireAuth(request);
  if (user.token.admin !== true) throw new HttpsError("permission-denied", "Недостаточно прав.");
  return user;
}
function cleanText(value, max) {
  if (typeof value !== "string") throw new HttpsError("invalid-argument", "Некорректный текст.");
  const result = value.trim();
  if (!result || result.length > max) throw new HttpsError("invalid-argument", "Проверь длину текста.");
  return result;
}

// Anonymous Firebase Auth users receive a globally unique guest number.
// Enable Anonymous sign-in and App Check before deploying this function.
exports.allocateGuest = onCall({ enforceAppCheck: true }, async (request) => {
  const user = requireAuth(request);
  const uid = user.uid;
  const profileRef = db.collection("guestProfiles").doc(uid);
  const counterRef = db.collection("system").doc("guestCounter");
  let guestName;
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(profileRef);
    if (existing.exists) {
      guestName = existing.data().guestName;
      return;
    }
    const counter = await tx.get(counterRef);
    const next = (counter.exists ? Number(counter.data().next || 1) : 1);
    guestName = "guest_" + String(next).padStart(2, "0");
    tx.set(counterRef, { next: next + 1 });
    tx.create(profileRef, {
      uid, guestName, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    tx.set(db.collection("users").doc(uid), {
      username: guestName, isGuest: true, createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { guestName };
});

// Admin-only moderation. Ban expiry is a Firestore timestamp; null means permanent.
exports.setUserBan = onCall({ enforceAppCheck: true }, async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data.uid, 128);
  if (uid === request.auth.uid) throw new HttpsError("failed-precondition", "Нельзя заблокировать самого себя.");
  const until = request.data.until == null ? null : admin.firestore.Timestamp.fromMillis(Number(request.data.until));
  await db.collection("users").doc(uid).set({
    banned: true, banUntil: until, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.unbanUser = onCall({ enforceAppCheck: true }, async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data.uid, 128);
  await db.collection("users").doc(uid).set({
    banned: false, banUntil: null, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.deleteComment = onCall({ enforceAppCheck: true }, async (request) => {
  requireAdmin(request);
  const id = cleanText(request.data.commentId, 200);
  await db.collection("comments").doc(id).delete();
  return { ok: true };
});

exports.setAnnouncement = onCall({ enforceAppCheck: true }, async (request) => {
  requireAdmin(request);
  const text = request.data.text == null ? "" : cleanText(request.data.text, 300);
  const ref = db.collection("site").doc("announcement");
  if (!text) await ref.delete();
  else await ref.set({
    text, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid
  });
  return { ok: true };
});

exports.deleteUserPermanently = onCall({ enforceAppCheck: true }, async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data.uid, 128);
  if (uid === request.auth.uid) throw new HttpsError("failed-precondition", "Нельзя удалить собственный аккаунт.");
  // Remove the user's comments and profile before deleting the Auth identity.
  const comments = await db.collection("comments").where("ownerUid", "==", uid).get();
  const batchLimit = 400;
  for (let i = 0; i < comments.docs.length; i += batchLimit) {
    const batch = db.batch();
    comments.docs.slice(i, i + batchLimit).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  await db.collection("users").doc(uid).delete();
  await db.collection("guestProfiles").doc(uid).delete().catch(() => {});
  await auth.deleteUser(uid);
  return { ok: true };
});