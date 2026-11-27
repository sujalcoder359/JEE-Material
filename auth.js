import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyBONi5c8YmiwZyACsvhUIxRUtasifG9rsM",
  authDomain: "jee-material-932a2.firebaseapp.com",
  projectId: "jee-material-932a2",
  storageBucket: "jee-material-932a2.firebasestorage.app",
  messagingSenderId: "65590644326",
  appId: "1:65590644326:web:4987cee8c0ad391820a7a7"
});

export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const userEl = document.getElementById("user");

if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, provider);
if (logoutBtn) logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  if (loginBtn) loginBtn.style.display = user ? "none" : "";
  if (logoutBtn) logoutBtn.style.display = user ? "" : "none";
  if (userEl) userEl.textContent = user ? `Hi, ${user.displayName}` : "";
});
