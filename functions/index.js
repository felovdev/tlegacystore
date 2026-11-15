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
exports.allocateGuest = onCall(async (request) => {
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

exports.claimUsername = onCall(async (request) => {
  const user = requireAuth(request);
  if (user.token.firebase.sign_in_provider !== "password") {
    throw new HttpsError("failed-precondition", "Сначала создай пароль для гостевого аккаунта.");
  }
  const username = cleanText(request.data.username, 24);
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username) || username.toLowerCase().startsWith("guest_")) {
    throw new HttpsError("invalid-argument", "Логин: 3–24 символа, латиница, цифры и _; guest_ зарезервирован.");
  }
  const key = username.toLowerCase();
  const nameRef = db.collection("usernames").doc(key);
  const profileRef = db.collection("users").doc(user.uid);
  await db.runTransaction(async (tx) => {
    const nameDoc = await tx.get(nameRef);
    if (nameDoc.exists && nameDoc.data().uid !== user.uid) {
      throw new HttpsError("already-exists", "Этот логин уже занят.");
    }
    tx.set(nameRef, { uid: user.uid, username });
    tx.set(profileRef, {
      username, isGuest: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  const guestRef = db.collection("guestProfiles").doc(user.uid);
  const guest = await guestRef.get();
  if (guest.exists) {
    const comments = await db.collection("comments").where("ownerUid", "==", user.uid).get();
    for (let i = 0; i < comments.docs.length; i += 400) {
      const batch = db.batch();
      comments.docs.slice(i, i + 400).forEach(doc => batch.update(doc.ref, {
        name: username, isGuest: false
      }));
      await batch.commit();
    }
    await guestRef.delete();
  }
  return { username };
});

exports.updateProfile = onCall(async (request) => {
  const user = requireAuth(request);
  if (user.token.firebase.sign_in_provider !== "password") {
    throw new HttpsError("failed-precondition", "Профиль доступен после регистрации.");
  }
  const bio = request.data.bio == null ? "" : String(request.data.bio).trim().slice(0, 240);
  const avatarUrl = request.data.avatarUrl == null ? "" : String(request.data.avatarUrl).trim().slice(0, 500);
  if (avatarUrl && !/^https:\/\//i.test(avatarUrl)) {
    throw new HttpsError("invalid-argument", "Аватар должен быть HTTPS-ссылкой.");
  }
  await db.collection("users").doc(user.uid).set({
    bio, avatarUrl, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.setUserBan = onCall(async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data.uid, 128);
  if (uid === request.auth.uid) throw new HttpsError("failed-precondition", "Нельзя заблокировать самого себя.");
  const until = request.data.until == null ? null : admin.firestore.Timestamp.fromMillis(Number(request.data.until));
  await db.collection("users").doc(uid).set({
    banned: true, banUntil: until, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.unbanUser = onCall(async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data.uid, 128);
  await db.collection("users").doc(uid).set({
    banned: false, banUntil: null, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.deleteComment = onCall(async (request) => {
  requireAdmin(request);
  const id = cleanText(request.data.commentId, 200);
  await db.collection("comments").doc(id).delete();
  return { ok: true };
});

exports.setAnnouncement = onCall(async (request) => {
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

exports.deleteUserPermanently = onCall(async (request) => {
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