// Catálogo de VYREX. El audio son pistas de demostración de SoundHelix (libres para pruebas).
const audio = (n) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

export const coverUrl = (seed, size = 300) => `https://picsum.photos/seed/vyrex-${seed}/${size}/${size}`;

export const ARTISTS = [
  { id: 'a1', name: 'Nova Lux', listeners: 18432910 },
  { id: 'a2', name: 'Kairo', listeners: 12904331 },
  { id: 'a3', name: 'Selene Drift', listeners: 8420117 },
  { id: 'a4', name: 'Midnight Pulse', listeners: 15230984 },
  { id: 'a5', name: 'Astra Vale', listeners: 6710342 },
  { id: 'a6', name: 'Neon Rivers', listeners: 9981204 },
  { id: 'a7', name: 'Lumen', listeners: 4302871 },
  { id: 'a8', name: 'Echo Bloom', listeners: 7124550 },
].map((a) => ({ ...a, image: `artist-${a.id}` }));

const ALBUM_COVERS = {
  'Horizonte Violeta': 'alb-horizonte',
  'Órbita': 'alb-orbita',
  'Pulso Nocturno': 'alb-pulso',
  'Deriva': 'alb-deriva',
  'Constelación': 'alb-constelacion',
  'Ríos de Neón': 'alb-rios',
  'Destellos': 'alb-destellos',
  'Florecer': 'alb-florecer',
};

export const TRACKS = [
  ['Luz de Neón', 'a1', 'Horizonte Violeta'],
  ['Sin Gravedad', 'a2', 'Órbita'],
  ['Medianoche', 'a4', 'Pulso Nocturno'],
  ['Cristal', 'a3', 'Deriva'],
  ['Fuego Lento', 'a5', 'Constelación'],
  ['Eclipse', 'a6', 'Ríos de Neón'],
  ['Vértigo', 'a2', 'Órbita'],
  ['Aurora', 'a7', 'Destellos'],
  ['Latido', 'a8', 'Florecer'],
  ['Ciudad Eléctrica', 'a4', 'Pulso Nocturno'],
  ['Marea', 'a3', 'Deriva'],
  ['Supernova', 'a1', 'Horizonte Violeta'],
  ['Espejismo', 'a5', 'Constelación'],
  ['Ultravioleta', 'a6', 'Ríos de Neón'],
  ['Satélite', 'a7', 'Destellos'],
  ['Eterno', 'a8', 'Florecer'],
].map(([title, artistId, album], i) => ({
  id: `t${i + 1}`,
  title,
  artistId,
  album,
  cover: ALBUM_COVERS[album],
  src: audio(i + 1),
}));

const t = (...nums) => nums.map((n) => `t${n}`);

export const PLAYLISTS = [
  { id: 'p1', name: 'Éxitos VYREX', desc: 'Lo más escuchado en VYREX ahora mismo.', color: '#7b3fe4', trackIds: t(1, 12, 3, 7, 8, 5, 14, 9) },
  { id: 'p2', name: 'Noche Neón', desc: 'Electrónica para cuando cae el sol.', color: '#c2307f', trackIds: t(3, 10, 6, 14, 1, 12) },
  { id: 'p3', name: 'Chill Violeta', desc: 'Relájate con sonidos suaves.', color: '#4f3ab8', trackIds: t(4, 11, 8, 15, 16) },
  { id: 'p4', name: 'Energía Total', desc: 'Sube el ritmo de tu entrenamiento.', color: '#c43c32', trackIds: t(2, 7, 5, 13, 10, 9) },
  { id: 'p5', name: 'Focus Mode', desc: 'Música instrumental para concentrarte.', color: '#1d6f80', trackIds: t(4, 8, 11, 15, 16, 6) },
  { id: 'p6', name: 'Lo-Fi Nocturno', desc: 'Beats tranquilos para estudiar.', color: '#3549c9', trackIds: t(11, 16, 4, 15, 3) },
  { id: 'p7', name: 'Top 50 Global', desc: 'Las canciones más populares del mundo VYREX.', color: '#a8285c', trackIds: t(12, 1, 7, 3, 14, 9, 2, 5, 10, 8, 6, 13, 4, 11, 15, 16) },
  { id: 'p8', name: 'Descubrimiento semanal', desc: 'Tu mezcla semanal de música nueva.', color: '#26876a', trackIds: t(9, 13, 6, 2, 15, 12, 7) },
  { id: 'v1', name: 'VIP Exclusivo', desc: 'Selección exclusiva para miembros VIP.', color: '#b8860b', vip: true, trackIds: t(12, 14, 1, 5, 9, 2) },
  { id: 'v2', name: 'Sesiones Privadas', desc: 'Sesiones íntimas solo para VIP.', color: '#8e24aa', vip: true, trackIds: t(16, 13, 10, 8, 3) },
  { id: 'v3', name: 'Estrenos VIP', desc: 'Escucha los lanzamientos antes que nadie.', color: '#d63cb8', vip: true, trackIds: t(7, 15, 11, 6, 4) },
].map((p) => ({ ...p, cover: `pl-${p.id}` }));

export const GENRES = [
  { name: 'Pop', color: '#dc148c', playlist: 'p1' },
  { name: 'Electrónica', color: '#7358ff', playlist: 'p2' },
  { name: 'Chill', color: '#477d95', playlist: 'p3' },
  { name: 'Entrenamiento', color: '#e13300', playlist: 'p4' },
  { name: 'Concentración', color: '#503750', playlist: 'p5' },
  { name: 'Lo-Fi', color: '#1e3264', playlist: 'p6' },
  { name: 'Listas', color: '#8d67ab', playlist: 'p7' },
  { name: 'Descubrir', color: '#148a08', playlist: 'p8' },
  { name: 'VIP', color: '#b8860b', playlist: 'v1' },
  { name: 'Fiesta', color: '#e8115b', playlist: 'p4' },
  { name: 'Noche', color: '#27856a', playlist: 'p2' },
  { name: 'Relax', color: '#0d73ec', playlist: 'p3' },
];

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const TRACK_MAP = byId(TRACKS);
const ARTIST_MAP = byId(ARTISTS);
const PLAYLIST_MAP = byId(PLAYLISTS);

export const trackById = (id) => TRACK_MAP[id];
export const artistById = (id) => ARTIST_MAP[id];
export const playlistById = (id) => PLAYLIST_MAP[id];
