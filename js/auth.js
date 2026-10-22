// Autenticación: Firebase (Google + correo) si está configurado; si no, cuentas locales.
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const USERS_KEY = 'vyrex:users';
const SESSION_KEY = 'vyrex:session';

export const isFirebase = Boolean(firebaseConfig?.apiKey && firebaseConfig?.authDomain);

const listeners = new Set();
let fb = null;

export function onChange(fn) {
  listeners.add(fn);
}

function emit(user) {
  listeners.forEach((fn) => fn(user));
}

class AuthError extends Error {}

const FIREBASE_ERRORS = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña es demasiado débil.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/cancelled-popup-request': 'Se canceló el inicio con Google.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication > Settings > Authorized domains).',
  'auth/operation-not-allowed': 'Este método de inicio de sesión no está activado en Firebase.',
  'auth/network-request-failed': 'Error de red. Revisa tu conexión.',
};

function wrapFirebase(err) {
  return new AuthError(FIREBASE_ERRORS[err?.code] || 'No se pudo completar la operación. Inténtalo de nuevo.');
}

function fromFirebase(u) {
  const google = u.providerData.some((p) => p.providerId === 'google.com');
  return {
    uid: u.uid,
    name: u.displayName || (u.email || 'Usuario').split('@')[0],
    email: u.email || '',
    photo: u.photoURL || '',
    provider: google ? 'google' : 'password',
  };
}

export async function init() {
  if (!isFirebase) {
    emit(readLocalSession());
    return;
  }
  const [appMod, authMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  auth.languageCode = 'es';
  fb = { auth, m: authMod };
  await new Promise((resolve) => {
    authMod.onAuthStateChanged(auth, (u) => {
      emit(u ? fromFirebase(u) : null);
      resolve();
    });
  });
}

export async function register({ name, email, password }) {
  if (fb) {
    try {
      const cred = await fb.m.createUserWithEmailAndPassword(fb.auth, email, password);
      await fb.m.updateProfile(cred.user, { displayName: name });
      emit(fromFirebase(fb.auth.currentUser));
    } catch (e) {
      throw wrapFirebase(e);
    }
    return;
  }
  const users = readUsers();
  if (users[email]) throw new AuthError('Ya existe una cuenta con ese correo.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  users[email] = {
    uid: crypto.randomUUID(),
    name,
    email,
    salt,
    hash: await hashPassword(password, salt),
    createdAt: Date.now(),
  };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(SESSION_KEY, email);
  emit(publicUser(users[email]));
}

export async function login({ email, password }) {
  if (fb) {
    try {
      await fb.m.signInWithEmailAndPassword(fb.auth, email, password);
    } catch (e) {
      throw wrapFirebase(e);
    }
    return;
  }
  const record = readUsers()[email];
  const hash = record ? await hashPassword(password, record.salt) : null;
  if (!record || hash !== record.hash) throw new AuthError('Correo o contraseña incorrectos.');
  localStorage.setItem(SESSION_KEY, email);
  emit(publicUser(record));
}

export async function loginWithGoogle() {
  if (!fb) {
    throw new AuthError('Para entrar con Google, agrega tu configuración de Firebase en js/firebase-config.js. Mientras, puedes registrarte con correo.');
  }
  const provider = new fb.m.GoogleAuthProvider();
  try {
    await fb.m.signInWithPopup(fb.auth, provider);
  } catch (e) {
    if (e?.code === 'auth/popup-blocked') {
      await fb.m.signInWithRedirect(fb.auth, provider);
      return;
    }
    throw wrapFirebase(e);
  }
}

export async function logout() {
  if (fb) {
    await fb.m.signOut(fb.auth);
    return;
  }
  localStorage.removeItem(SESSION_KEY);
  emit(null);
}

// ---- Cuentas locales (solo para desarrollo; no reemplaza un backend real) ----
function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function readLocalSession() {
  const email = localStorage.getItem(SESSION_KEY);
  const record = email && readUsers()[email];
  return record ? publicUser(record) : null;
}

function publicUser(r) {
  return { uid: r.uid, name: r.name, email: r.email, photo: '', provider: 'password' };
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, key, 256);
  return toHex(new Uint8Array(bits));
}
