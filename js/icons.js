// Iconos SVG en línea. 's' = trazo, 'f' = relleno.
const HEART = 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z';
const REPEAT = '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>';

const P = {
  home: ['f', '<path d="M12.6 2.8a1 1 0 0 0-1.2 0L3 9v12h6.5v-6.5h5V21H21V9z"/>'],
  search: ['s', '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>'],
  library: ['s', '<path d="M4 3v18M9.5 3v18M14.5 4.2l5.3 16.4"/>'],
  plus: ['s', '<path d="M12 5v14M5 12h14"/>'],
  heart: ['s', `<path d="${HEART}"/>`],
  'heart-fill': ['f', `<path d="${HEART}"/>`],
  play: ['f', '<path d="M7 4.6v14.8a1 1 0 0 0 1.5.9l12-7.4a1 1 0 0 0 0-1.8l-12-7.4A1 1 0 0 0 7 4.6z"/>'],
  pause: ['f', '<rect x="5.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14" y="4" width="4.5" height="16" rx="1.2"/>'],
  next: ['f', '<path d="M5 5.6v12.8a.8.8 0 0 0 1.2.7L16 12.7V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v5.3L6.2 4.9A.8.8 0 0 0 5 5.6z"/>'],
  prev: ['f', '<path d="M19 5.6v12.8a.8.8 0 0 1-1.2.7L8 12.7V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5.3l9.8-6.4a.8.8 0 0 1 1.2.7z"/>'],
  shuffle: ['s', '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'],
  repeat: ['s', REPEAT],
  'repeat-one': ['s', REPEAT + '<path d="M11 10h1v4"/>'],
  volume: ['s', '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'],
  'volume-low': ['s', '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'],
  mute: ['s', '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>'],
  'chev-left': ['s', '<path d="m15 18-6-6 6-6"/>'],
  'chev-right': ['s', '<path d="m9 18 6-6-6-6"/>'],
  clock: ['s', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  lock: ['s', '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'],
  crown: ['f', '<path d="M2.5 7.5 7 11l5-7 5 7 4.5-3.5L19.5 19h-15z"/>'],
  download: ['s', '<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>'],
  check: ['s', '<path d="M20 6 9 17l-5-5"/>'],
  x: ['s', '<path d="M18 6 6 18M6 6l12 12"/>'],
  logout: ['s', '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'],
  user: ['s', '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'],
  music: ['s', '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'],
  more: ['f', '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>'],
};

export function icon(name, size = 24) {
  const [type, inner] = P[name] || P.music;
  const paint = type === 's'
    ? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    : 'fill="currentColor"';
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" ${paint} aria-hidden="true" focusable="false">${inner}</svg>`;
}
