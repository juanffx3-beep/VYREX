// Spotify: OAuth con PKCE y Web Playback SDK para la SPA estática de VYREX.
// El Client ID es público por diseño. Nunca agregues el Client Secret a GitHub Pages.
const CLIENT_ID = 'f5fa58d3d8ad46129a626d979fa6a5a8';
const REDIRECT_URI = 'https://juanffx3-beep.github.io/VYREX';
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
];

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const PENDING_KEY = 'vyrex:spotify:pending';
const SESSION_PREFIX = 'vyrex:spotify:session:';

let session = null;
let sessionUid = null;
let player = null;
let deviceId = null;
let sdkPromise = null;
const listeners = new Set();

export const isConfigured = Boolean(CLIENT_ID && REDIRECT_URI);
export const isConnected = () => Boolean(session?.accessToken && sessionUid);
export const getConnection = () => ({
  connected: isConnected(),
  ready: Boolean(deviceId),
  profile: session?.profile || null,
});

export function onEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(type, data = {}) {
  listeners.forEach((listener) => listener({ type, ...data }));
}

function storageKey(uid) {
  return `${SESSION_PREFIX}${uid}`;
}

function readSession(uid) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(uid))) || null;
  } catch {
    return null;
  }
}

function saveSession(uid, next) {
  session = next;
  sessionUid = uid;
  sessionStorage.setItem(storageKey(uid), JSON.stringify(next));
}

function clearSession(uid = sessionUid) {
  if (uid) sessionStorage.removeItem(storageKey(uid));
  session = null;
  sessionUid = null;
}

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY)) || null;
  } catch {
    return null;
  }
}

function clearPending() {
  sessionStorage.removeItem(PENDING_KEY);
}

function base64url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomValue(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64url(bytes);
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function formatError(error, fallback = 'No se pudo conectar con Spotify.') {
  if (error instanceof SpotifyError) return error;
  return new SpotifyError(error?.message || fallback);
}

class SpotifyError extends Error {}

async function tokenRequest(params) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SpotifyError(payload.error_description || 'Spotify no pudo autorizar esta sesión.');
  }
  return payload;
}

async function hydrateProfile() {
  const profile = await api('/me');
  const next = { ...session, profile: {
    id: profile.id,
    name: profile.display_name || profile.id,
    image: profile.images?.[0]?.url || '',
    product: profile.product || '',
  } };
  saveSession(sessionUid, next);
  return next.profile;
}

async function refreshSession() {
  if (!session?.refreshToken || !sessionUid) {
    throw new SpotifyError('La sesión de Spotify expiró. Conéctala otra vez.');
  }
  const payload = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: CLIENT_ID,
  });
  saveSession(sessionUid, {
    ...session,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || session.refreshToken,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000,
  });
}

async function validToken() {
  if (!session?.accessToken || !sessionUid) {
    throw new SpotifyError('Conecta tu cuenta de Spotify primero.');
  }
  if (Date.now() > (session.expiresAt || 0) - 60_000) await refreshSession();
  return session.accessToken;
}

async function api(path, options = {}) {
  const token = await validToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || payload.error_description || 'Spotify no pudo completar la operación.';
    throw new SpotifyError(message);
  }
  return payload;
}

function normalizeTrack(track) {
  return {
    id: track.id,
    uri: track.uri,
    title: track.name,
    artists: (track.artists || []).map((artist) => artist.name).join(', '),
    album: track.album?.name || '',
    image: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '',
    duration: Number(track.duration_ms) || 0,
    explicit: Boolean(track.explicit),
  };
}

function normalizeSdkTrack(track) {
  return {
    id: track.id,
    uri: track.uri,
    title: track.name,
    artists: (track.artists || []).map((artist) => artist.name).join(', '),
    album: track.album?.name || '',
    image: track.album?.images?.[0]?.url || '',
    duration: Number(track.duration_ms) || 0,
  };
}

function loadSdk() {
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const previous = window.onSpotifyWebPlaybackSDKReady;
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new SpotifyError('No se pudo cargar el reproductor de Spotify.')), 12_000);
    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timeout);
      previous?.();
      resolve(window.Spotify);
    };
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new SpotifyError('No se pudo cargar el reproductor de Spotify.'));
    };
    document.head.append(script);
  });
  return sdkPromise;
}

async function ensurePlayer() {
  if (player) return player;
  const Spotify = await loadSdk();
  await validToken();
  player = new Spotify.Player({
    name: 'VYREX Web Player',
    volume: 0.7,
    getOAuthToken: async (callback) => {
      try { callback(await validToken()); } catch { callback(''); }
    },
  });
  player.addListener('ready', ({ device_id: id }) => {
    deviceId = id;
    emit('connection', { ...getConnection() });
  });
  player.addListener('not_ready', () => {
    deviceId = null;
    emit('connection', { ...getConnection() });
  });
  player.addListener('player_state_changed', (next) => {
    if (!next) return;
    emit('player', {
      paused: next.paused,
      position: next.position,
      duration: next.duration,
      track: normalizeSdkTrack(next.track_window.current_track),
    });
  });
  ['initialization_error', 'authentication_error', 'account_error', 'playback_error'].forEach((event) => {
    player.addListener(event, ({ message }) => emit('error', { message: message || 'Spotify no pudo reproducir esta canción.' }));
  });
  const ok = await player.connect();
  if (!ok) throw new SpotifyError('No se pudo iniciar el reproductor de Spotify.');
  return player;
}

export function hasPendingCallback() {
  const query = new URLSearchParams(location.search);
  return Boolean(query.get('code') || query.get('error')) && Boolean(readPending());
}

export async function connect(uid) {
  if (!isConfigured) throw new SpotifyError('Falta configurar el Client ID de Spotify.');
  if (!uid) throw new SpotifyError('Inicia sesión en VYREX antes de conectar Spotify.');
  if (sessionUid === uid && session?.accessToken) {
    await ensurePlayer();
    return getConnection();
  }
  const verifier = randomValue(64);
  const state = randomValue(32);
  const challenge = await challengeFor(verifier);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ uid, verifier, state, returnHash: location.hash || '#/account' }));
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES.join(' '),
  });
  location.assign(`${AUTH_URL}?${params}`);
}

export async function completeCallback(uid) {
  const query = new URLSearchParams(location.search);
  const pending = readPending();
  if (!pending || !query.has('code') && !query.has('error')) return false;
  if (pending.uid !== uid || query.get('state') !== pending.state) {
    clearPending();
    throw new SpotifyError('La verificación de Spotify no coincide. Vuelve a conectar la cuenta.');
  }
  if (query.get('error')) {
    clearPending();
    throw new SpotifyError(query.get('error_description') || 'Cancelaste la conexión con Spotify.');
  }
  const payload = await tokenRequest({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code: query.get('code'),
    redirect_uri: REDIRECT_URI,
    code_verifier: pending.verifier,
  });
  saveSession(uid, {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || '',
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000,
    profile: null,
  });
  clearPending();
  history.replaceState(null, '', `${location.pathname}${pending.returnHash || '#/account'}`);
  await hydrateProfile();
  await ensurePlayer();
  emit('connection', { ...getConnection() });
  return true;
}

export async function restore(uid) {
  if (!uid) return false;
  const saved = readSession(uid);
  if (!saved) return false;
  session = saved;
  sessionUid = uid;
  try {
    await validToken();
    if (!session.profile) await hydrateProfile();
    await ensurePlayer();
    emit('connection', { ...getConnection() });
    return true;
  } catch (error) {
    clearSession(uid);
    emit('error', { message: formatError(error).message });
    return false;
  }
}

export async function disconnect({ clear = true } = {}) {
  try { await player?.pause(); } catch { /* no hay reproducción activa */ }
  try { await player?.disconnect(); } catch { /* el SDK puede ya estar cerrado */ }
  player = null;
  deviceId = null;
  if (clear) clearSession();
  emit('connection', { ...getConnection() });
}

export async function searchTracks(query) {
  const value = String(query || '').trim();
  if (!value) return [];
  const payload = await api(`/search?${new URLSearchParams({ q: value, type: 'track', limit: '10', market: 'from_token' })}`);
  return (payload.tracks?.items || []).map(normalizeTrack);
}

export async function play(uri) {
  if (!uri) throw new SpotifyError('No se encontró la canción de Spotify.');
  await ensurePlayer();
  if (!deviceId) throw new SpotifyError('Spotify aún está preparando el reproductor. Inténtalo de nuevo en un momento.');
  await api('/me/player', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [deviceId], play: false }) });
  await api(`/me/player/play?${new URLSearchParams({ device_id: deviceId })}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uris: [uri] }) });
}

export async function pause() { await player?.pause(); }
export async function resume() { await player?.resume(); }
export async function next() { await player?.nextTrack(); }
export async function previous() { await player?.previousTrack(); }
export async function seek(positionMs) { await player?.seek(Math.max(0, Number(positionMs) || 0)); }
export async function setVolume(volume) { await player?.setVolume(Math.min(1, Math.max(0, Number(volume) || 0))); }
