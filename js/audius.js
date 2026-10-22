// Catálogo abierto de música en línea para VYREX (API pública de Audius).
// No requiere cuentas ni claves: solo un nombre de app. Las canciones se
// reproducen directamente con el reproductor propio de VYREX.
const APP_NAME = 'vyrex';
const DISCOVERY_API = 'https://api.audius.co';
const FALLBACK_NODE = 'https://discoveryprovider.audius.co';

let node = null;
let nodePromise = null;

export function ensureNode() {
  if (node) return Promise.resolve(node);
  nodePromise ||= fetch(DISCOVERY_API)
    .then((r) => r.json())
    .then((d) => {
      node = d.data?.[0] || FALLBACK_NODE;
      return node;
    })
    .catch(() => {
      node = FALLBACK_NODE;
      return node;
    });
  return nodePromise;
}

function normalize(track, host) {
  return {
    id: `au_${track.id}`,
    title: track.title,
    artistName: track.user?.name || 'Artista',
    album: track.genre || '',
    genre: track.genre || '',
    image: track.artwork?.['480x480'] || track.artwork?.['150x150'] || '',
    duration: Number(track.duration) || 0,
    src: `${host}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`,
    local: false,
  };
}

async function request(path) {
  const host = await ensureNode();
  const response = await fetch(`${host}${path}${path.includes('?') ? '&' : '?'}app_name=${APP_NAME}`);
  if (!response.ok) throw new Error('music catalog unavailable');
  const payload = await response.json();
  return payload.data || [];
}

export async function search(query, limit = 12) {
  const data = await request(`/v1/tracks/search?query=${encodeURIComponent(query)}`);
  const host = await ensureNode();
  return data.slice(0, limit).map((t) => normalize(t, host));
}

export async function trending(limit = 12) {
  const data = await request('/v1/tracks/trending');
  const host = await ensureNode();
  return data.slice(0, limit).map((t) => normalize(t, host));
}
