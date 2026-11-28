// auth.js: login, signup, email verification and profile setup.
// Include on every page with: <script type="module" src="auth.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocFromCache, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBONi5c8YmiwZyACsvhUIxRUtasifG9rsM",
  authDomain: "jee-material-932a2.firebaseapp.com",
  projectId: "jee-material-932a2",
  storageBucket: "jee-material-932a2.firebasestorage.app",
  messagingSenderId: "65590644326",
  appId: "1:65590644326:web:4987cee8c0ad391820a7a7"
});

export const auth = getAuth(app);

// Firestore's default transport often fails on mobile networks, proxies and
// ad-blockers, which makes getDoc() throw "client is offline" even when the
// internet works. Auto-detecting long polling fixes that, and the local cache
// lets a previously loaded profile still show up if the network drops.
function makeDb() {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (e) {
    console.warn("Persistent cache unavailable, using default Firestore", e);
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
}

export const db = makeDb();

export const EXAMS = ["JEE", "NEET"];
export const CLASSES = ["11th", "12th"];

const ACCOUNT_URL = "account.html";

/* ---------- profile storage (Firestore: users/{uid}) ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns the profile object, or null if the user has no profile yet.
// Throws only when the profile genuinely could not be read (check err.code).
export async function getProfile(uid) {
  const ref = doc(db, "users", uid);
  let lastErr;

  for (let i = 0; i < 3; i++) {
    try {
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      lastErr = e;
      console.warn(`getProfile attempt ${i + 1} failed:`, e.code, e.message);

      // Retrying can't fix a rules problem.
      if (e.code === "permission-denied") break;

      await sleep(700 * (i + 1));
    }
  }

  // Last resort: a copy saved on this device earlier.
  try {
    const cached = await getDocFromCache(ref);
    if (cached.exists()) return cached.data();
  } catch {}

  throw lastErr;
}

export async function saveProfile(user, { name, exam, classLevel }, isNew = false) {
  const data = {
    name,
    exam,
    classLevel,
    email: user.email ?? null,
    updatedAt: serverTimestamp()
  };

  if (isNew) data.createdAt = serverTimestamp();

  await setDoc(doc(db, "users", user.uid), data, { merge: true });

  window.dispatchEvent(new CustomEvent("profile-saved", {
    detail: { name, exam, classLevel }
  }));
}

/* ---------- helpers ---------- */

const ERR = {
  "auth/email-already-in-use": "This email already has an account. Try logging in.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Password must be at least 8 characters.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/user-not-found": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/operation-not-allowed": "This sign-in method is not enabled yet."
};

const msg = (e) =>
  e.code ? (ERR[e.code] ?? "Something went wrong. Please try again.") : e.message;

const q = (s, r = document) => r.querySelector(s);

/* ---------- styles ---------- */

const style = document.createElement("style");

style.textContent = `
.am{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:rgba(8,10,18,.78);overflow:auto}
.am[hidden]{display:none}
.am-box{position:relative;width:100%;max-width:420px;padding:28px 24px;background:var(--surface,#171c2d);border:1px solid var(--line,#2a3148);border-radius:12px;color:var(--fg,#e8ebf4);font-family:var(--f-body,system-ui,sans-serif)}
.am-x{position:absolute;top:10px;right:12px;background:none;border:0;color:var(--muted,#9aa3b8);font-size:1.5rem;line-height:1;cursor:pointer}
.am h2{margin:0 0 6px;font:700 1.5rem var(--f-display,system-ui,sans-serif)}
.am p{margin:0 0 16px;color:var(--muted,#9aa3b8);font-size:.9rem;line-height:1.6}
.am label{display:block;margin:12px 0 5px;font-size:.8rem;color:var(--muted,#9aa3b8)}
.am input,.am select{width:100%;padding:10px 12px;background:var(--bg,#0f1320);color:var(--fg,#e8ebf4);border:1px solid var(--line,#2a3148);border-radius:7px;font:inherit}
.am input:focus,.am select:focus,.am-btn:focus-visible{outline:2px solid #64d8d0;outline-offset:2px}
.am-btn{width:100%;margin-top:16px;padding:11px;border:0;border-radius:7px;background:#64d8d0;color:#0f1320;font:600 .95rem var(--f-body,system-ui,sans-serif);cursor:pointer}
.am-btn.alt{background:transparent;color:var(--fg,#e8ebf4);border:1px solid var(--line,#2a3148);margin-top:10px}
.am-btn:disabled{opacity:.6;cursor:wait}
.am-link{background:none;border:0;padding:0;color:#64d8d0;font:inherit;cursor:pointer;text-decoration:underline}
.am-sub{margin-top:14px;text-align:center;font-size:.85rem;color:var(--muted,#9aa3b8)}
.am-or{margin-top:14px;text-align:center;font-size:.8rem;color:var(--muted,#9aa3b8)}
.am-err{min-height:1.2em;margin-top:12px;color:#ff8f8f;font-size:.85rem}

.auth-btn{background:var(--surface,#171c2d);color:var(--fg,#e8ebf4);border:1px solid var(--line,#2a3148);border-radius:7px;padding:6px 12px;font:500 .8rem var(--f-body,system-ui,sans-serif);cursor:pointer;transition:.2s;white-space:nowrap;flex:none}
.auth-btn:hover{border-color:#64d8d0;color:#64d8d0}

.auth-controls{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  margin-left:auto;
  flex:1;
}

/* Profile avatar */

#user{
  display:flex;
  align-items:center;
}

.profile-trigger{
  width:38px;
  height:38px;
  padding:0;
  border:1px solid var(--line,#2a3148);
  border-radius:50%;
  background:var(--surface,#171c2d);
  color:var(--fg,#e8ebf4);
  cursor:pointer;
  overflow:hidden;
  display:grid;
  place-items:center;
  font:600 .9rem var(--f-body,system-ui,sans-serif);
  transition:border-color .2s;
}

.profile-trigger:hover{
  border-color:#64d8d0;
}

.profile-trigger img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

/* Profile dropdown */

#profile-menu{
  position:fixed;
  z-index:95;
  width:270px;
  padding:16px;
  background:var(--surface,#171c2d);
  border:1px solid var(--line,#2a3148);
  border-radius:11px;
  box-shadow:0 12px 35px rgba(0,0,0,.35);
  color:var(--fg,#e8ebf4);
}

#profile-menu[hidden]{
  display:none;
}

.profile-menu-top{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:14px;
}

.profile-menu-avatar{
  width:46px;
  height:46px;
  flex:none;
  border-radius:50%;
  overflow:hidden;
  background:var(--soft,#1e2438);
  display:grid;
  place-items:center;
  font-weight:600;
}

.profile-menu-avatar img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.profile-menu-name{
  font-weight:600;
  font-size:.92rem;
  overflow-wrap:anywhere;
}

.profile-menu-email{
  font-size:.75rem;
  color:var(--muted,#9aa3b8);
  overflow-wrap:anywhere;
}

.profile-menu-meta{
  padding:11px 0;
  border-top:1px solid var(--line,#2a3148);
  border-bottom:1px solid var(--line,#2a3148);
  font-size:.8rem;
  color:var(--muted,#9aa3b8);
  line-height:1.8;
}

.profile-menu-link{
  display:block;
  margin-top:12px;
  padding:10px;
  border:1px solid var(--line,#2a3148);
  border-radius:7px;
  text-align:center;
  color:var(--fg,#e8ebf4);
  font-size:.85rem;
  transition:.2s;
}

.profile-menu-link:hover{
  border-color:#64d8d0;
  color:#64d8d0;
}

.profile-menu-signout{
  width:100%;
  margin-top:8px;
  padding:9px;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#ff8f8f;
  font:inherit;
  font-size:.85rem;
  cursor:pointer;
}

.profile-menu-signout:hover{
  background:rgba(255,143,143,.08);
}

@media(max-width:600px){
  #profile-menu{
    width:min(270px,calc(100vw - 20px));
  }
}
`;

document.head.append(style);

/* ---------- modal shell ---------- */

const overlay = document.createElement("div");

overlay.className = "am";
overlay.hidden = true;

overlay.innerHTML = `
  <div class="am-box" role="dialog" aria-modal="true">
    <button class="am-x" aria-label="Close">&times;</button>
    <div id="am-body"></div>
  </div>
`;

document.body.append(overlay);

const body = q("#am-body", overlay);

let closable = true;
let current = "";
let dismissed = false;

try {
  dismissed = sessionStorage.getItem("am-dismissed") === "1";
} catch {}

// Pages where the sign-up popup opens automatically for signed-out visitors:
// the home page and the tests page (with or without ".html").
// A page can also opt in with <body data-auto-signin>, which works for any URL.
const isHome =
  document.body.hasAttribute("data-auto-signin") ||
  /\/(index(\.html)?|tests(\.html)?)?$/.test(location.pathname);

function open(screen, opts = {}) {
  closable = opts.closable ?? true;
  current = screen;

  q(".am-x", overlay).hidden = !closable;
  overlay.hidden = false;

  screens[screen]();

  body.querySelector("input,select")?.focus();
}

function close() {
  overlay.hidden = true;
  current = "";
}

function dismiss() {
  if (!closable) return;

  close();

  try {
    sessionStorage.setItem("am-dismissed", "1");
  } catch {}
}

q(".am-x", overlay).onclick = dismiss;

overlay.addEventListener("mousedown", (e) => {
  if (e.target === overlay) dismiss();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!overlay.hidden) dismiss();
    profileMenu.hidden = true;
  }
});

/* ---------- modal messages ---------- */

const say = (t, ok = false) => {
  const el = q(".am-err", body);

  if (el) {
    el.textContent = t;
    el.style.color = ok ? "#64d8d0" : "";
  }
};

async function run(btn, fn) {
  say("");
  btn.disabled = true;

  try {
    await fn();
  } catch (e) {
    say(msg(e));
  } finally {
    btn.disabled = false;
  }
}

const google = (e) =>
  run(e.target, () => signInWithPopup(auth, new GoogleAuthProvider()));

/* ---------- screens ---------- */

const optionList = (list, placeholder) =>
  `<option value="" disabled selected>${placeholder}</option>` +
  list.map((v) => `<option value="${v}">${v}</option>`).join("");

const screens = {

  signup() {
    body.innerHTML = `
      <h2>Create your account</h2>
      <p>Save your test scores and keep your progress on every device.</p>

      <button class="am-btn alt" id="g">Continue with Google</button>

      <div class="am-or">or sign up with email</div>

      <label for="e">Email</label>
      <input id="e" type="email" autocomplete="email">

      <label for="p">Password</label>
      <input id="p" type="password" autocomplete="new-password" placeholder="At least 8 characters">

      <label for="p2">Confirm password</label>
      <input id="p2" type="password" autocomplete="new-password">

      <div class="am-err" role="alert"></div>

      <button class="am-btn" id="go">Sign up</button>

      <div class="am-sub">
        Already registered?
        <button class="am-link" id="sw">Log in</button>
      </div>
    `;

    q("#g", body).onclick = google;
    q("#sw", body).onclick = () => open("login");

    q("#go", body).onclick = (e) => run(e.target, async () => {
      const email = q("#e", body).value.trim();
      const pw = q("#p", body).value;

      if (!email) throw new Error("Enter your email address.");
      if (pw.length < 8) throw new Error("Password must be at least 8 characters.");
      if (pw !== q("#p2", body).value) throw new Error("Passwords don't match.");

      const { user } = await createUserWithEmailAndPassword(auth, email, pw);

      await sendEmailVerification(user);
    });
  },

  login() {
    body.innerHTML = `
      <h2>Welcome back</h2>
      <p>Log in to see your scores and profile.</p>

      <button class="am-btn alt" id="g">Continue with Google</button>

      <div class="am-or">or log in with email</div>

      <label for="e">Email</label>
      <input id="e" type="email" autocomplete="email">

      <label for="p">Password</label>
      <input id="p" type="password" autocomplete="current-password">

      <div class="am-err" role="alert"></div>

      <button class="am-btn" id="go">Log in</button>

      <div class="am-sub">
        <button class="am-link" id="fp">Forgot password?</button>
      </div>

      <div class="am-sub">
        New here?
        <button class="am-link" id="sw">Create an account</button>
      </div>
    `;

    q("#g", body).onclick = google;
    q("#sw", body).onclick = () => open("signup");

    q("#go", body).onclick = (e) => run(e.target, async () => {
      const email = q("#e", body).value.trim();
      const pw = q("#p", body).value;

      if (!email || !pw) throw new Error("Enter your email and password.");

      await signInWithEmailAndPassword(auth, email, pw);
    });

    q("#fp", body).onclick = (e) => run(e.target, async () => {
      const email = q("#e", body).value.trim();

      if (!email) throw new Error("Enter your email above first.");

      await sendPasswordResetEmail(auth, email);

      say("If an account exists for that email, a reset link is on its way.", true);
    });
  },

  verify() {
    const u = auth.currentUser;

    body.innerHTML = `
      <h2>Verify your email</h2>

      <p>
        We sent a verification link to <b id="ve"></b>.
        Open it, then come back and continue.
        Check your spam folder if you can't find it.
      </p>

      <div class="am-err" role="alert"></div>

      <button class="am-btn" id="done">I've verified my email</button>
      <button class="am-btn alt" id="resend">Resend email</button>

      <div class="am-sub">
        <button class="am-link" id="out">Use a different account</button>
      </div>
    `;

    q("#ve", body).textContent = u.email;

    q("#done", body).onclick = (e) => run(e.target, async () => {
      await u.reload();

      if (!u.emailVerified) {
        throw new Error("Not verified yet. Click the link in your email first.");
      }

      await u.getIdToken(true);

      await route(u);
    });

    q("#resend", body).onclick = (e) => run(e.target, async () => {
      await sendEmailVerification(u);

      say("Verification email sent again.", true);
    });

    q("#out", body).onclick = () => signOut(auth);
  },

  profile() {
    const u = auth.currentUser;

    body.innerHTML = `
      <h2>Set up your profile</h2>
      <p>This helps us tailor the site to your exam.</p>

      <label for="n">Your name</label>
      <input id="n" maxlength="50" autocomplete="name">

      <label for="x">Exam</label>
      <select id="x">${optionList(EXAMS, "Select your exam")}</select>

      <label for="c">Class</label>
      <select id="c">${optionList(CLASSES, "Select your class")}</select>

      <div class="am-err" role="alert"></div>

      <button class="am-btn" id="go">Save profile</button>
    `;

    q("#n", body).value = u.displayName || "";

    q("#go", body).onclick = (e) => run(e.target, async () => {
      const name = q("#n", body).value.trim();
      const exam = q("#x", body).value;
      const classLevel = q("#c", body).value;

      if (name.length < 2) {
        throw new Error("Enter your name (at least 2 characters).");
      }

      if (!exam) throw new Error("Select your exam.");
      if (!classLevel) throw new Error("Select your class.");

      await saveProfile(u, { name, exam, classLevel }, true);

      close();
    });
  }
};

/* ---------- profile dropdown ---------- */

const profileMenu = document.createElement("div");

profileMenu.id = "profile-menu";
profileMenu.hidden = true;

profileMenu.innerHTML = `
  <div class="profile-menu-top">
    <div class="profile-menu-avatar" id="pm-avatar"></div>

    <div>
      <div class="profile-menu-name" id="pm-name"></div>
      <div class="profile-menu-email" id="pm-email"></div>
    </div>
  </div>

  <div class="profile-menu-meta" id="pm-meta"></div>

  <a class="profile-menu-link" href="${ACCOUNT_URL}">
    Edit Account Details
  </a>

  <button class="profile-menu-signout" id="pm-signout">
    Sign out
  </button>
`;

document.body.append(profileMenu);

/* ---------- avatar helpers ---------- */

function initials(name) {
  return (name || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function makeAvatar(container, photoURL, name) {
  container.replaceChildren();

  if (photoURL) {
    const img = document.createElement("img");

    img.src = photoURL;
    img.alt = "Profile picture";

    img.onerror = () => {
      container.replaceChildren();
      container.textContent = initials(name);
    };

    container.append(img);
  } else {
    container.textContent = initials(name);
  }
}

/* ---------- dropdown information ---------- */

function renderProfileMenu(user, profile) {
  const name = profile?.name || user.displayName || "Account";
  const photoURL = user.photoURL || "";

  q("#pm-name", profileMenu).textContent = name;
  q("#pm-email", profileMenu).textContent = user.email || "";

  const meta = q("#pm-meta", profileMenu);

  meta.replaceChildren();

  const examLine = document.createElement("div");
  examLine.textContent = `Exam: ${profile?.exam || "Not set"}`;

  const classLine = document.createElement("div");
  classLine.textContent = `Class: ${profile?.classLevel || "Not set"}`;

  meta.append(examLine, classLine);

  makeAvatar(q("#pm-avatar", profileMenu), photoURL, name);
}

/* ---------- dropdown positioning ---------- */

function positionProfileMenu() {
  const trigger = q("#profile-trigger");

  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const width = Math.min(270, window.innerWidth - 20);

  const left = Math.max(
    10,
    Math.min(rect.right - width, window.innerWidth - width - 10)
  );

  profileMenu.style.top = `${rect.bottom + 9}px`;
  profileMenu.style.left = `${left}px`;
}

function toggleProfileMenu() {
  if (profileMenu.hidden) {
    positionProfileMenu();
    profileMenu.hidden = false;
  } else {
    profileMenu.hidden = true;
  }
}

/* ---------- dropdown interactions ---------- */

document.addEventListener("click", (e) => {
  if (
    !profileMenu.hidden &&
    !profileMenu.contains(e.target) &&
    !e.target.closest("#profile-trigger")
  ) {
    profileMenu.hidden = true;
  }
});

window.addEventListener("resize", () => {
  if (!profileMenu.hidden) positionProfileMenu();
});

window.addEventListener("scroll", () => {
  if (!profileMenu.hidden) positionProfileMenu();
}, true);

q("#pm-signout", profileMenu).onclick = () => signOut(auth);

/* ---------- navbar / greeting ---------- */

function nav(user, profile) {
  const L = q("#login");
  const O = q("#logout");
  const U = q("#user");
  const G = q("#greeting");

  if (L) L.style.display = user ? "none" : "";
  if (O) O.style.display = "none";

  if (U) {
    U.replaceChildren();

    if (user) {
      const name = profile?.name || user.displayName || "Account";

      const button = document.createElement("button");

      button.id = "profile-trigger";
      button.className = "profile-trigger";
      button.type = "button";
      button.title = "Open profile";
      button.setAttribute("aria-label", "Open profile menu");
      button.setAttribute("aria-expanded", "false");

      makeAvatar(button, user.photoURL || "", name);

      button.onclick = () => {
        toggleProfileMenu();

        button.setAttribute(
          "aria-expanded",
          String(!profileMenu.hidden)
        );
      };

      U.append(button);

      renderProfileMenu(user, profile);
    } else {
      profileMenu.hidden = true;
    }
  }

  if (G) {
    G.textContent = profile
      ? `Welcome back, ${profile.name.split(" ")[0]}. Preparing for ${profile.exam}, Class ${profile.classLevel}.`
      : "";
  }
}

/* ---------- inject auth controls where needed ---------- */

if (!q("#login")) {
  let host = q(".bar-right");

  if (!host) {
    host = document.createElement("div");
    host.className = "auth-controls";

    const bar = q(".bar");

    if (bar) bar.append(host);
  }

  host.insertAdjacentHTML(
    "beforeend",
    '<span id="user"></span><button id="login" class="auth-btn">Sign in</button><button id="logout" class="auth-btn" style="display:none">Sign out</button>'
  );
}

const L = q("#login");
const O = q("#logout");

if (L) L.onclick = () => open("login");
if (O) O.onclick = () => signOut(auth);

window.addEventListener("profile-saved", (e) => {
  nav(auth.currentUser, e.detail);
});

/* ---------- routing by auth state ---------- */

async function route(user) {
  if (!user.emailVerified) {
    open("verify");
    return null;
  }

  let profile = null;

  try {
    profile = await getProfile(user.uid);
  } catch (e) {
    console.error("Could not load profile", e);
    return null;
  }

  if (!profile) {
    open("profile", { closable: false });
    return null;
  }

  if (
    current === "verify" ||
    current === "profile" ||
    current === "login" ||
    current === "signup"
  ) {
    close();
  }

  nav(user, profile);

  return profile;
}

onAuthStateChanged(auth, async (user) => {
  nav(user, null);

  if (!user) {
    if (isHome && !dismissed) {
      open("signup");
    } else if (current === "verify" || current === "profile") {
      close();
    }

    return;
  }

  await route(user);
});
