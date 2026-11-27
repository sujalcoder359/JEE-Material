import { getApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
import { auth } from "./auth.js";

const db = getFirestore(getApp());

export async function saveScore(test, score, total) {
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u) return false;
  await addDoc(collection(db, "users", u.uid, "scores"),
    { test, score, total, takenAt: serverTimestamp() });
  return true;
}

export async function loadScores() {
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u) return [];
  const snap = await getDocs(query(collection(db, "users", u.uid, "scores"), orderBy("takenAt", "desc")));
  return snap.docs.map(d => d.data());
}
