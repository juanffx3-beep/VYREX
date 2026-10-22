import { TRACKS, ARTISTS, PLAYLISTS, GENRES, trackById, artistById, playlistById, coverUrl } from './data.js';
import { icon } from './icons.js';
import * as Auth from './auth.js';

// ---------- Reglas de los planes ----------
const SONGS_BETWEEN_ADS = 3;   // Free: anuncio cada 3 canciones
const AD_SECONDS = 15;         // Duración del anuncio
const FREE_SKIPS_PER_HOUR = 6; // Free: saltos por hora
const VIP_PRICE = '$4.99';

// ---------- Utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const fmt = (sec) => {
  if (!Number.isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
};
const fmtLong = (sec) => {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const shuffleArr = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let LOGO_SRC = 'assets/logo.svg';
const logo = (cls = '') => `<img class="logo-img ${cls}" src="${LOGO_SRC}" alt="">`;

// ---------- Estado ----------
const state = {
  user: null,
  plan: 'free',
  liked: new Set(),
  downloaded: new Set(),
  skips: [],
  durations: {},
  queue: [],
  baseQueue: [],
  queueIndex: -1,
  contextId: null,
  currentId: null,
  shuffle: false,
  repeat: 'off',
  volume: 0.7,
  muted: false,
  songsSinceAd: 0,
  inAd: false,
  afterAd: null,
  adTimer: null,
  seeking: false,
  searchQuery: '',
  searchIds: [],
  libFilter: null,
};

const audio = new Audio();
audio.preload = 'auto';

const userKey = (k) => `vyrex:${state.user?.uid || 'anon'}:${k}`;
const store = {
  get(k, def) {
    try {
      const v = localStorage.getItem(userKey(k));
      return v === null ? def : JSON.parse(v);
    } catch {
      return def;
    }
  },
  set(k, v) {
    localStorage.setItem(userKey(k), JSON.stringify(v));
  },
};

const isVip = () => state.plan === 'vip';

// ---------- Duraciones (se leen de los metadatos del audio) ----------
const DUR_KEY = 'vyrex:durations';
try { state.durations = JSON.parse(localStorage.getItem(DUR_KEY)) || {}; } catch { state.durations = {}; }

function setDuration(id, d) {
  if (!Number.isFinite(d) || state.durations[id]) return;
  state.durations[id] = d;
  localStorage.setItem(DUR_KEY, JSON.stringify(state.durations));
  $$(`[data-dur="${id}"]`).forEach((el) => { el.textContent = fmt(d); });
}

function probeDurations() {
  TRACKS.filter((t) => !state.durations[t.id]).forEach((t) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', () => {
      setDuration(t.id, a.duration);
      a.removeAttribute('src');
    }, { once: true });
    a.src = t.src;
  });
}

// ---------- Contextos de reproducción ----------
function contextIds(ctx) {
  if (!ctx) return [];
  if (ctx === 'liked') return [...state.liked].reverse();
  if (ctx === 'all') return TRACKS.map((t) => t.id);
  if (ctx === 'search') return state.searchIds;
  if (ctx.startsWith('artist:')) return TRACKS.filter((t) => t.artistId === ctx.slice(7)).map((t) => t.id);
  return playlistById(ctx)?.trackIds || [];
}

function isLocked(ctx) {
  const p = playlistById(ctx);
  return Boolean(p?.vip && !isVip());
}

// ---------- Reproductor ----------
function playContext(ctx, index = 0) {
  if (isLocked(ctx)) return upgradeModal('Esta playlist es exclusiva para miembros VIP.');
  const ids = contextIds(ctx);
  if (!ids.length) return toast('Aún no hay canciones aquí');
  if (state.inAd) return toast('Tu música sigue después del anuncio');
  state.contextId = ctx;
  state.baseQueue = ids.slice();
  if (state.shuffle) {
    state.queue = [ids[index], ...shuffleArr(ids.filter((_, i) => i !== index))];
    state.queueIndex = 0;
  } else {
    state.queue = ids.slice();
    state.queueIndex = index;
  }
  startCurrent();
}

function startCurrent() {
  const t = trackById(state.queue[state.queueIndex]);
  if (!t) return;
  if (!isVip() && state.songsSinceAd >= SONGS_BETWEEN_ADS) {
    state.songsSinceAd = 0;
    playAd(startCurrent);
    return;
  }
  state.songsSinceAd++;
  state.currentId = t.id;
  audio.src = t.src;
  audio.play().catch(() => {});
  updateNowPlaying();
}

function togglePlay() {
  if (state.inAd) return toast('Tu música sigue después del anuncio');
  if (!state.currentId) return playContext('p1');
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function canSkip() {
  if (isVip()) return true;
  const now = Date.now();
  state.skips = state.skips.filter((ts) => now - ts < 3600_000);
  if (state.skips.length >= FREE_SKIPS_PER_HOUR) {
    upgradeModal(`Alcanzaste el límite de ${FREE_SKIPS_PER_HOUR} saltos por hora del plan Free.`);
    return false;
  }
  state.skips.push(now);
  store.set('skips', state.skips);
  return true;
}

function next(userInitiated = true) {
  if (state.inAd) return toast('Tu música sigue después del anuncio');
  if (!state.queue.length) return;
  if (userInitiated && !canSkip()) return;
  if (state.queueIndex < state.queue.length - 1) {
    state.queueIndex++;
  } else if (userInitiated || state.repeat === 'all') {
    state.queueIndex = 0;
  } else {
    audio.pause();
    audio.currentTime = 0;
    return;
  }
  startCurrent();
}

function prev() {
  if (state.inAd) return toast('Tu música sigue después del anuncio');
  if (!state.queue.length) return;
  if (audio.currentTime > 3 || state.queueIndex === 0) {
    audio.currentTime = 0;
    return;
  }
  state.queueIndex--;
  startCurrent();
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  if (state.queue.length) {
    const current = state.queue[state.queueIndex];
    if (state.shuffle) {
      state.queue = [current, ...shuffleArr(state.baseQueue.filter((id) => id !== current))];
      state.queueIndex = 0;
    } else {
      state.queue = state.baseQueue.slice();
      state.queueIndex = Math.max(0, state.queue.indexOf(current));
    }
  }
  updateModeButtons();
  toast(state.shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado');
}

function toggleRepeat() {
  state.repeat = { off: 'all', all: 'one', one: 'off' }[state.repeat];
  updateModeButtons();
}

function stopPlayback() {
  audio.pause();
  audio.removeAttribute('src');
  clearInterval(state.adTimer);
  state.inAd = false;
  state.afterAd = null;
  $('#ad-banner').hidden = true;
  $('#player').classList.remove('ad-mode');
  Object.assign(state, { queue: [], baseQueue: [], queueIndex: -1, contextId: null, currentId: null, songsSinceAd: 0 });
}

function resetPlayerUI() {
  $('#np-cover').src = LOGO_SRC;
  $('#np-title').textContent = 'VYREX';
  $('#np-artist').textContent = 'Elige una canción';
  setProgressUI(0, 0, 0);
  updatePlayButtons();
}

// ---------- Anuncios (solo Free) ----------
let jingleCtx = null;
function playJingle() {
  try {
    jingleCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const vol = state.muted ? 0 : 0.12 * state.volume;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = jingleCtx.createOscillator();
      const g = jingleCtx.createGain();
      const t0 = jingleCtx.currentTime + i * 0.16;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0001), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g).connect(jingleCtx.destination);
      o.start(t0);
      o.stop(t0 + 0.65);
    });
  } catch { /* sin Web Audio */ }
}

function playAd(then) {
  state.inAd = true;
  state.afterAd = then;
  audio.pause();
  let left = AD_SECONDS;
  const player = $('#player');
  player.classList.add('ad-mode');
  $('#np-cover').src = LOGO_SRC;
  $('#np-title').textContent = 'Anuncio';
  const banner = $('#ad-banner');
  banner.innerHTML = `
    <span class="ad-tag">Anuncio · <b id="ad-count">${left}</b> s</span>
    <div class="ad-body">
      ${logo('ad-logo')}
      <div>
        <h3>Música sin interrupciones</h3>
        <p>Con VYREX VIP no hay anuncios, saltas sin límite y descargas tus canciones.</p>
      </div>
    </div>
    <a class="btn-primary sm" href="#/premium">Hazte VIP por ${VIP_PRICE}/mes</a>`;
  banner.hidden = false;
  playJingle();
  const tick = () => {
    $('#np-artist').textContent = `VYREX Free · ${left} s`;
    const c = $('#ad-count');
    if (c) c.textContent = left;
    setProgressUI((AD_SECONDS - left) / AD_SECONDS, AD_SECONDS - left, AD_SECONDS);
  };
  tick();
  state.adTimer = setInterval(() => {
    left--;
    tick();
    if (left <= 0) endAd();
  }, 1000);
}

function endAd() {
  clearInterval(state.adTimer);
  state.inAd = false;
  $('#ad-banner').hidden = true;
  $('#player').classList.remove('ad-mode');
  const cb = state.afterAd;
  state.afterAd = null;
  if (cb) cb();
}

// ---------- UI del reproductor ----------
function setProgressUI(ratio, cur, dur) {
  const pct = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  const range = $('#progress');
  if (!state.seeking) range.value = Math.round(ratio * 1000) || 0;
  range.style.setProperty('--val', pct);
  $('#mini-bar').style.width = pct;
  $('#time-cur').textContent = fmt(cur || 0);
  $('#time-dur').textContent = fmt(dur || 0);
}

function updateNowPlaying() {
  const t = trackById(state.currentId);
  if (!t) return;
  const a = artistById(t.artistId);
  $('#np-cover').src = coverUrl(t.cover, 128);
  $('#np-cover').alt = `Portada de ${t.album}`;
  $('#np-title').innerHTML = `<a href="#/playlist/${esc(state.contextId)}">${esc(t.title)}</a>`;
  if (!playlistById(state.contextId)) $('#np-title').textContent = t.title;
  $('#np-artist').innerHTML = `<a href="#/artist/${a.id}">${esc(a.name)}</a>`;
  document.title = `${t.title} • ${a.name} | VYREX`;
  updateLikeButtons(t.id);
  updatePlayingIndicators();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: a.name,
      album: t.album,
      artwork: [{ src: coverUrl(t.cover, 512), sizes: '512x512', type: 'image/jpeg' }],
    });
  }
}

function updatePlayButtons() {
  const playing = !audio.paused && !state.inAd;
  document.body.classList.toggle('is-paused', !playing);
  const btn = $('#btn-play');
  btn.innerHTML = icon(playing ? 'pause' : 'play', 18);
  btn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  updatePlayingIndicators();
}

function updatePlayingIndicators() {
  const playing = !audio.paused;
  $$('.track-row').forEach((r) => {
    r.classList.toggle('is-current', r.dataset.trackId === state.currentId && r.dataset.context === state.contextId);
  });
  $$('[data-action="play-context"]').forEach((b) => {
    const active = b.dataset.context === state.contextId && playing;
    b.classList.toggle('is-active', active);
    b.innerHTML = icon(active ? 'pause' : 'play', Number(b.dataset.size) || 24);
    b.setAttribute('aria-label', active ? 'Pausar' : 'Reproducir');
  });
  $$('.lib-item').forEach((el) => el.classList.toggle('is-playing', el.dataset.context === state.contextId));
}

function updateModeButtons() {
  $$('#btn-shuffle, .shuffle-toggle').forEach((b) => {
    b.classList.toggle('is-on', state.shuffle);
    b.setAttribute('aria-pressed', String(state.shuffle));
  });
  const rep = $('#btn-repeat');
  rep.innerHTML = icon(state.repeat === 'one' ? 'repeat-one' : 'repeat', 16);
  rep.classList.toggle('is-on', state.repeat !== 'off');
  rep.setAttribute('aria-label', { off: 'Repetir', all: 'Repetir todo', one: 'Repetir canción' }[state.repeat]);
}

function updateVolumeUI() {
  const v = state.muted ? 0 : state.volume;
  audio.volume = v;
  const range = $('#volume');
  range.value = Math.round(v * 100);
  range.style.setProperty('--val', `${v * 100}%`);
  const name = v === 0 ? 'mute' : v < 0.5 ? 'volume-low' : 'volume';
  $('#btn-mute').innerHTML = icon(name, 16);
  $('#btn-mute').setAttribute('aria-label', v === 0 ? 'Activar sonido' : 'Silenciar');
}

function updateQuality() {
  const badge = $('#quality-badge');
  badge.textContent = isVip() ? 'Muy alta · 320 kbps' : 'Normal · 128 kbps';
  badge.classList.toggle('vip', isVip());
}

function updateLikeButtons(id) {
  const liked = state.liked.has(id);
  $$(`[data-action="like"][data-track="${id}"]`).forEach((b) => {
    b.classList.toggle('is-liked', liked);
    b.innerHTML = icon(liked ? 'heart-fill' : 'heart', 16);
    b.setAttribute('aria-pressed', String(liked));
  });
  if (id === state.currentId) {
    const b = $('#np-like');
    b.classList.toggle('is-liked', liked);
    b.innerHTML = icon(liked ? 'heart-fill' : 'heart', 16);
    b.setAttribute('aria-pressed', String(liked));
  }
}

audio.addEventListener('play', updatePlayButtons);
audio.addEventListener('pause', updatePlayButtons);
audio.addEventListener('ended', () => {
  if (state.repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    next(false);
  }
});
audio.addEventListener('loadedmetadata', () => setDuration(state.currentId, audio.duration));
audio.addEventListener('timeupdate', () => {
  if (state.inAd || !audio.duration) return;
  setProgressUI(audio.currentTime / audio.duration, audio.currentTime, audio.duration);
});
audio.addEventListener('error', () => {
  if (audio.getAttribute('src')) toast('No se pudo cargar la canción. Revisa tu conexión.');
});

// ---------- Componentes ----------
const likedCover = (size = 24) => `<span class="liked-cover">${icon('heart-fill', size)}</span>`;
const playFab = (ctx, size = 24, cls = '') =>
  `<button class="play-fab ${cls}" data-action="play-context" data-context="${esc(ctx)}" data-size="${size}" aria-label="Reproducir">${icon('play', size)}</button>`;

function playlistCard(p) {
  const badge = p.vip ? `<span class="cover-badge ${isVip() ? '' : 'locked'}">${icon(isVip() ? 'crown' : 'lock', 14)} VIP</span>` : '';
  return `
    <a class="card" href="#/playlist/${p.id}">
      <div class="card-cover">
        <img src="${coverUrl(p.cover)}" alt="" loading="lazy">
        ${badge}
        ${playFab(p.id)}
      </div>
      <h3 class="card-title">${esc(p.name)}</h3>
      <p class="card-sub">${esc(p.desc)}</p>
    </a>`;
}

function artistCard(a) {
  return `
    <a class="card" href="#/artist/${a.id}">
      <div class="card-cover round">
        <img src="${coverUrl(a.image)}" alt="" loading="lazy">
        ${playFab(`artist:${a.id}`)}
      </div>
      <h3 class="card-title">${esc(a.name)}</h3>
      <p class="card-sub">Artista</p>
    </a>`;
}

function trackCard(t, index, ctx = 'all') {
  const a = artistById(t.artistId);
  return `
    <div class="card" role="button" tabindex="0" data-action="play-track" data-context="${ctx}" data-index="${index}" data-track-id="${t.id}" aria-label="Reproducir ${esc(t.title)}">
      <div class="card-cover">
        <img src="${coverUrl(t.cover)}" alt="" loading="lazy">
        <span class="play-fab" aria-hidden="true">${icon('play', 24)}</span>
      </div>
      <h3 class="card-title">${esc(t.title)}</h3>
      <p class="card-sub"><a href="#/artist/${a.id}">${esc(a.name)}</a></p>
    </div>`;
}

function shelf(title, items, link) {
  return `
    <section class="shelf">
      <header class="shelf-head">
        <h2>${title}</h2>
        ${link ? `<a class="show-all" href="${link}">Mostrar todo</a>` : ''}
      </header>
      <div class="shelf-grid">${items.join('')}</div>
    </section>`;
}

function trackRow(id, i, ctx, { album = true } = {}) {
  const t = trackById(id);
  const a = artistById(t.artistId);
  const liked = state.liked.has(id);
  const dl = isVip() && state.downloaded.has(id)
    ? `<span class="dl-badge" title="Descargada">${icon('download', 12)}</span>` : '';
  return `
    <div class="track-row" role="row" tabindex="0" data-action="play-track" data-context="${esc(ctx)}" data-index="${i}" data-track-id="${id}">
      <span class="tr-index" role="cell">
        <span class="num">${i + 1}</span>
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="tr-play" aria-hidden="true">${icon('play', 14)}</span>
      </span>
      <span class="tr-main" role="cell">
        <img src="${coverUrl(t.cover, 80)}" alt="" loading="lazy">
        <span class="tr-text">
          <span class="tr-title">${esc(t.title)}</span>
          <span class="tr-artist">${dl}<a href="#/artist/${a.id}">${esc(a.name)}</a></span>
        </span>
      </span>
      ${album ? `<span class="col-album" role="cell">${esc(t.album)}</span>` : '<span class="col-album" role="cell"></span>'}
      <span class="tr-actions" role="cell">
        <button class="icon-btn like-btn ${liked ? 'is-liked' : ''}" data-action="like" data-track="${id}" aria-pressed="${liked}" aria-label="Me gusta: ${esc(t.title)}">${icon(liked ? 'heart-fill' : 'heart', 16)}</button>
      </span>
      <span class="col-dur" role="cell" data-dur="${id}">${fmt(state.durations[id])}</span>
    </div>`;
}

function trackTable(ids, ctx, opts) {
  return `
    <div class="tracklist" role="table" aria-label="Canciones">
      <div class="tl-head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Título</span>
        <span class="col-album" role="columnheader">Álbum</span>
        <span role="columnheader"></span>
        <span class="col-dur" role="columnheader" aria-label="Duración">${icon('clock', 16)}</span>
      </div>
      ${ids.map((id, i) => trackRow(id, i, ctx, opts)).join('')}
    </div>`;
}

function actionBar(ctx, { download = true } = {}) {
  return `
    <div class="action-bar">
      <button class="play-big" data-action="play-context" data-context="${esc(ctx)}" data-size="28" aria-label="Reproducir">${icon('play', 28)}</button>
      <button class="icon-btn lg shuffle-toggle ${state.shuffle ? 'is-on' : ''}" data-action="toggle-shuffle" aria-pressed="${state.shuffle}" aria-label="Aleatorio">${icon('shuffle', 28)}</button>
      ${download ? `<button class="icon-btn lg" data-action="download-context" data-context="${esc(ctx)}" aria-label="Descargar${isVip() ? '' : ' (solo VIP)'}">${icon('download', 28)}${isVip() ? '' : `<span class="mini-lock">${icon('lock', 10)}</span>`}</button>` : ''}
    </div>`;
}

const totalDuration = (ids) => ids.reduce((s, id) => s + (state.durations[id] || 0), 0);
const songsMeta = (ids) => {
  const total = totalDuration(ids);
  const n = `${ids.length} ${ids.length === 1 ? 'canción' : 'canciones'}`;
  return total ? `${n}, ${fmtLong(total)}` : n;
};

// ---------- Vistas ----------
function viewHome() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const quick = [
    { ctx: 'liked', href: '#/liked', name: 'Canciones que te gustan', cover: likedCover() },
    ...['p1', 'p2', 'p3', 'p4', 'p7', 'p8', 'p6'].map((id) => {
      const p = playlistById(id);
      return { ctx: id, href: `#/playlist/${id}`, name: p.name, cover: `<img src="${coverUrl(p.cover, 128)}" alt="">` };
    }),
  ];
  const promo = isVip() ? '' : `
    <a class="promo" href="#/premium">
      ${logo('promo-logo')}
      <div>
        <strong>Estás en VYREX Free</strong>
        <p>Escucha sin anuncios, salta sin límites y descarga música con VIP.</p>
      </div>
      <span class="btn-primary sm">Hazte VIP</span>
    </a>`;
  return {
    color: '#3b2563',
    html: `
      <div class="page">
        ${promo}
        <h1 class="greet">${greet}${state.user ? `, ${esc(state.user.name.split(' ')[0])}` : ''}</h1>
        <div class="quick-grid">
          ${quick.map((q) => `
            <a class="quick" href="${q.href}">
              <span class="quick-cover">${q.cover}</span>
              <span class="quick-name">${esc(q.name)}</span>
              ${playFab(q.ctx, 20, 'sm')}
            </a>`).join('')}
        </div>
        ${shelf('Hecho para ti', ['p8', 'p1', 'p3', 'p5', 'p6', 'p2'].map((id) => playlistCard(playlistById(id))))}
        ${shelf(`${icon('crown', 22)} Exclusivo VIP`, PLAYLISTS.filter((p) => p.vip).map(playlistCard), '#/premium')}
        ${shelf('Canciones del momento', TRACKS.slice(0, 12).map((t, i) => trackCard(t, i)))}
        ${shelf('Artistas populares', ARTISTS.map(artistCard))}
        ${shelf('Listas y energía', ['p7', 'p4', 'p2', 'p1'].map((id) => playlistCard(playlistById(id))))}
        <footer class="page-footer">© ${new Date().getFullYear()} VYREX · Audio de demostración por SoundHelix</footer>
      </div>`,
  };
}

function viewSearch() {
  return { color: '#2a2a2a', html: '<div class="page"><div id="search-results"></div></div>', after: renderSearchResults };
}

function renderSearchResults() {
  const host = $('#search-results');
  if (!host) return;
  const q = normalize(state.searchQuery);
  if (!q) {
    host.innerHTML = `
      <h2 class="section-title">Explorar todo</h2>
      <div class="genre-grid">
        ${GENRES.map((g, i) => `
          <a class="genre" href="#/playlist/${g.playlist}" style="background:${g.color}">
            <span>${esc(g.name)}</span>
            <img src="${coverUrl(`genre-${i}`, 160)}" alt="" loading="lazy">
          </a>`).join('')}
      </div>`;
    return;
  }
  const tracks = TRACKS.filter((t) => normalize(`${t.title} ${artistById(t.artistId).name} ${t.album}`).includes(q));
  const artists = ARTISTS.filter((a) => normalize(a.name).includes(q));
  const playlists = PLAYLISTS.filter((p) => normalize(`${p.name} ${p.desc}`).includes(q));
  state.searchIds = tracks.map((t) => t.id);
  if (!tracks.length && !artists.length && !playlists.length) {
    host.innerHTML = `
      <div class="empty">
        <h2>No se encontraron resultados para "${esc(state.searchQuery)}"</h2>
        <p>Revisa la ortografía o usa otras palabras.</p>
      </div>`;
    return;
  }
  let top = '';
  if (artists[0] || tracks[0]) {
    const a = artists[0];
    const t = !a && tracks[0];
    top = `
      <section class="top-result">
        <h2 class="section-title">Resultado principal</h2>
        ${a ? `
          <a class="top-card" href="#/artist/${a.id}">
            <img class="round" src="${coverUrl(a.image, 200)}" alt="">
            <strong>${esc(a.name)}</strong><span class="pill">Artista</span>
            ${playFab(`artist:${a.id}`, 24)}
          </a>` : `
          <div class="top-card" role="button" tabindex="0" data-action="play-track" data-context="search" data-index="0" data-track-id="${t.id}">
            <img src="${coverUrl(t.cover, 200)}" alt="">
            <strong>${esc(t.title)}</strong><span class="pill">Canción · ${esc(artistById(t.artistId).name)}</span>
            <span class="play-fab" aria-hidden="true">${icon('play', 24)}</span>
          </div>`}
      </section>`;
  }
  host.innerHTML = `
    <div class="search-top">
      ${top}
      ${tracks.length ? `<section class="songs-result"><h2 class="section-title">Canciones</h2>${trackTable(tracks.slice(0, 5).map((t) => t.id), 'search', { album: false })}</section>` : ''}
    </div>
    ${artists.length ? shelf('Artistas', artists.map(artistCard)) : ''}
    ${playlists.length ? shelf('Playlists', playlists.map(playlistCard)) : ''}`;
  updatePlayingIndicators();
}

function viewPlaylist(id) {
  const p = playlistById(id);
  if (!p) return viewNotFound();
  const locked = isLocked(id);
  const body = locked ? `
    <div class="locked-panel">
      <span class="locked-icon">${icon('lock', 32)}</span>
      <h2>Contenido exclusivo VIP</h2>
      <p>Hazte VIP para escuchar "${esc(p.name)}" y todas las playlists exclusivas.</p>
      <a class="btn-primary" href="#/premium">Hazte VIP</a>
    </div>` : `${actionBar(id)}${trackTable(p.trackIds, id)}`;
  return {
    color: p.color,
    html: `
      <div class="page">
        <section class="hero">
          <img class="hero-cover" src="${coverUrl(p.cover, 300)}" alt="Portada de ${esc(p.name)}">
          <div class="hero-info">
            <span class="hero-type">${p.vip ? `${icon('crown', 14)} Playlist VIP` : 'Playlist'}</span>
            <h1 class="hero-title">${esc(p.name)}</h1>
            <p class="hero-desc">${esc(p.desc)}</p>
            <p class="hero-meta">${logo('meta-logo')}<b>VYREX</b> · ${songsMeta(p.trackIds)}</p>
          </div>
        </section>
        ${body}
      </div>`,
  };
}

function viewLiked() {
  const ids = contextIds('liked');
  return {
    color: '#5038a0',
    html: `
      <div class="page">
        <section class="hero">
          <span class="hero-cover liked-big">${icon('heart-fill', 80)}</span>
          <div class="hero-info">
            <span class="hero-type">Playlist</span>
            <h1 class="hero-title">Canciones que te gustan</h1>
            <p class="hero-meta"><b>${esc(state.user?.name)}</b> · ${songsMeta(ids)}</p>
          </div>
        </section>
        ${ids.length ? `${actionBar('liked')}${trackTable(ids, 'liked')}` : `
          <div class="empty">
            <span class="empty-icon">${icon('heart', 40)}</span>
            <h2>Las canciones que te gustan aparecerán aquí</h2>
            <p>Toca el corazón de cualquier canción para guardarla.</p>
            <a class="btn-light" href="#/search">Buscar canciones</a>
          </div>`}
      </div>`,
  };
}

function viewArtist(id) {
  const a = artistById(id);
  if (!a) return viewNotFound();
  const ctx = `artist:${id}`;
  const ids = contextIds(ctx);
  const appearsIn = PLAYLISTS.filter((p) => p.trackIds.some((tid) => ids.includes(tid)));
  return {
    color: '#45325f',
    html: `
      <div class="page">
        <section class="hero">
          <img class="hero-cover round" src="${coverUrl(a.image, 300)}" alt="${esc(a.name)}">
          <div class="hero-info">
            <span class="hero-type verified">${icon('check', 14)} Artista verificado</span>
            <h1 class="hero-title">${esc(a.name)}</h1>
            <p class="hero-meta">${a.listeners.toLocaleString('es')} oyentes mensuales</p>
          </div>
        </section>
        ${actionBar(ctx, { download: false })}
        <h2 class="section-title">Populares</h2>
        ${trackTable(ids, ctx)}
        ${shelf('Aparece en', appearsIn.map(playlistCard))}
      </div>`,
  };
}

function libItems() {
  const f = state.libFilter;
  const items = [];
  if (f !== 'artists') {
    items.push(`
      <a class="lib-item" href="#/liked" data-context="liked" data-key="liked">
        ${likedCover(18)}
        <span class="lib-text"><span class="lib-name">Canciones que te gustan</span><span class="lib-sub">${icon('heart-fill', 10)} Playlist · ${state.liked.size} canciones</span></span>
      </a>`);
    PLAYLISTS.forEach((p) => items.push(`
      <a class="lib-item" href="#/playlist/${p.id}" data-context="${p.id}" data-key="playlist/${p.id}">
        <img src="${coverUrl(p.cover, 96)}" alt="" loading="lazy">
        <span class="lib-text"><span class="lib-name">${esc(p.name)}</span><span class="lib-sub">${p.vip ? `${icon(isVip() ? 'crown' : 'lock', 10)} VIP · ` : ''}Playlist · VYREX</span></span>
      </a>`));
  }
  if (f !== 'playlists') {
    ARTISTS.forEach((a) => items.push(`
      <a class="lib-item" href="#/artist/${a.id}" data-context="artist:${a.id}" data-key="artist/${a.id}">
        <img class="round" src="${coverUrl(a.image, 96)}" alt="" loading="lazy">
        <span class="lib-text"><span class="lib-name">${esc(a.name)}</span><span class="lib-sub">Artista</span></span>
      </a>`));
  }
  return items.join('');
}

function viewLibrary() {
  return {
    color: '#2a2a2a',
    html: `
      <div class="page">
        <h1 class="greet">Tu biblioteca</h1>
        <div class="lib-chips page-chips">
          <button class="chip ${state.libFilter === 'playlists' ? 'is-on' : ''}" data-action="lib-filter" data-filter="playlists">Playlists</button>
          <button class="chip ${state.libFilter === 'artists' ? 'is-on' : ''}" data-action="lib-filter" data-filter="artists">Artistas</button>
        </div>
        <div class="lib-list page-lib">${libItems()}</div>
      </div>`,
  };
}

function planFeature(ok, text) {
  return `<li class="${ok ? 'ok' : 'no'}">${icon(ok ? 'check' : 'x', 18)}<span>${text}</span></li>`;
}

function viewPremium() {
  const vip = isVip();
  return {
    color: '#7a2a8c',
    html: `
      <div class="page premium">
        <section class="premium-hero">
          ${logo('premium-logo')}
          <h1>Escucha sin límites con <span class="grad-text">VYREX VIP</span></h1>
          <p>Sin anuncios, saltos ilimitados, audio en calidad muy alta, descargas y playlists exclusivas.</p>
        </section>
        <div class="plans">
          <article class="plan ${vip ? '' : 'is-current'}">
            <header>
              <span class="plan-tag">${vip ? 'Plan básico' : 'Tu plan actual'}</span>
              <h2>Free</h2>
              <p class="price">$0 <small>/ siempre</small></p>
            </header>
            <ul>
              ${planFeature(true, 'Todo el catálogo de VYREX')}
              ${planFeature(false, `Anuncios cada ${SONGS_BETWEEN_ADS} canciones`)}
              ${planFeature(false, `${FREE_SKIPS_PER_HOUR} saltos por hora`)}
              ${planFeature(false, 'Calidad normal (128 kbps)')}
              ${planFeature(false, 'Sin descargas')}
              ${planFeature(false, 'Sin playlists exclusivas')}
            </ul>
            ${vip ? '<button class="btn-outline" data-action="set-plan" data-plan="free">Cambiar a Free</button>' : '<button class="btn-outline" disabled>Plan actual</button>'}
          </article>
          <article class="plan plan-vip ${vip ? 'is-current' : ''}">
            <header>
              <span class="plan-tag">${vip ? 'Tu plan actual' : 'Recomendado'}</span>
              <h2>${icon('crown', 22)} VIP</h2>
              <p class="price">${VIP_PRICE} <small>/ mes</small></p>
            </header>
            <ul>
              ${planFeature(true, 'Todo el catálogo de VYREX')}
              ${planFeature(true, 'Sin anuncios')}
              ${planFeature(true, 'Saltos ilimitados')}
              ${planFeature(true, 'Calidad muy alta (320 kbps)')}
              ${planFeature(true, 'Descarga tus canciones')}
              ${planFeature(true, 'Playlists exclusivas VIP')}
            </ul>
            ${vip ? '<button class="btn-primary" disabled>Plan actual</button>' : '<button class="btn-primary" data-action="confirm-vip">Hazte VIP</button>'}
          </article>
        </div>
        <p class="fine">Modo demostración: activar VIP no realiza ningún cobro.</p>
      </div>`,
  };
}

function avatar(cls = '') {
  const u = state.user;
  if (u?.photo) return `<img class="avatar ${cls}" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">`;
  return `<span class="avatar ${cls}" aria-hidden="true">${esc((u?.name || '?').charAt(0).toUpperCase())}</span>`;
}

function viewAccount() {
  const u = state.user;
  const now = Date.now();
  const skipsLeft = FREE_SKIPS_PER_HOUR - state.skips.filter((ts) => now - ts < 3600_000).length;
  return {
    color: '#4a3070',
    html: `
      <div class="page">
        <section class="hero">
          ${avatar('hero-avatar')}
          <div class="hero-info">
            <span class="hero-type">Perfil</span>
            <h1 class="hero-title">${esc(u.name)}</h1>
            <p class="hero-meta">${esc(u.email)} · <span class="plan-pill ${isVip() ? 'vip' : ''}">${isVip() ? `${icon('crown', 12)} VIP` : 'Free'}</span></p>
          </div>
        </section>
        <div class="stats">
          <div class="stat"><b>${state.liked.size}</b><span>Canciones que te gustan</span></div>
          <div class="stat"><b>${isVip() ? state.downloaded.size : '—'}</b><span>Descargadas</span></div>
          <div class="stat"><b>${isVip() ? '∞' : Math.max(0, skipsLeft)}</b><span>Saltos disponibles esta hora</span></div>
          <div class="stat"><b>${u.provider === 'google' ? 'Google' : 'Correo'}</b><span>Método de acceso</span></div>
        </div>
        <div class="account-actions">
          <a class="btn-primary" href="#/premium">${isVip() ? 'Gestionar plan' : 'Hazte VIP'}</a>
          <button class="btn-outline" data-action="logout">${icon('logout', 16)} Cerrar sesión</button>
        </div>
        ${Auth.isFirebase ? '' : '<p class="fine">Cuenta local: se guarda solo en este navegador. Configura Firebase para cuentas reales.</p>'}
      </div>`,
  };
}

function viewNotFound() {
  return {
    color: '#2a2a2a',
    html: `<div class="page"><div class="empty"><h2>No encontramos esta página</h2><a class="btn-light" href="#/home">Ir al inicio</a></div></div>`,
  };
}

// ---------- Router ----------
const VIEWS = {
  home: viewHome,
  search: viewSearch,
  playlist: viewPlaylist,
  liked: viewLiked,
  artist: viewArtist,
  library: viewLibrary,
  premium: viewPremium,
  account: viewAccount,
};

function parseRoute() {
  const [view = 'home', param] = location.hash.replace(/^#\/?/, '').split('/');
  return { view: view || 'home', param: param ? decodeURIComponent(param) : undefined };
}

function route({ keepScroll = false } = {}) {
  if (!state.user) return;
  const { view, param } = parseRoute();
  const main = $('#main');
  const scroll = main.scrollTop;
  const { html, color, after } = (VIEWS[view] || viewNotFound)(param);
  closeUserMenu();
  $('#search-box').hidden = view !== 'search';
  $('#view').innerHTML = html;
  main.style.setProperty('--page-color', color);
  main.scrollTop = keepScroll ? scroll : 0;
  onMainScroll();
  if (after) after();
  if (view === 'search' && !state.searchQuery && window.matchMedia('(min-width: 769px)').matches) $('#search-input').focus();
  highlightNav(view, param);
  updatePlayingIndicators();
  updateModeButtons();
}

function highlightNav(view, param) {
  const key = param ? `${view}/${param}` : view;
  $$('[data-route]').forEach((el) => {
    const active = el.dataset.route === view;
    el.classList.toggle('is-active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  $$('.lib-item').forEach((el) => el.classList.toggle('is-active', el.dataset.key === key));
}

function onMainScroll() {
  $('#topbar').classList.toggle('solid', $('#main').scrollTop > 40);
}

// ---------- Shell ----------
function renderSidebar() {
  $('#lib-list').innerHTML = libItems();
  $$('.sidebar .chip').forEach((c) => c.classList.toggle('is-on', c.dataset.filter === state.libFilter));
  $('#side-promo').innerHTML = isVip() ? '' : `
    <div class="side-promo">
      <strong>Prueba VYREX VIP</strong>
      <p>Sin anuncios y con saltos ilimitados.</p>
      <a class="btn-light sm" href="#/premium">Ver planes</a>
    </div>`;
  const { view, param } = parseRoute();
  highlightNav(view, param);
  updatePlayingIndicators();
}

function renderTopbarUser() {
  const u = state.user;
  $('#tb-right').innerHTML = `
    ${isVip()
      ? `<a class="vip-badge" href="#/premium">${icon('crown', 14)} VIP</a>`
      : '<a class="pill-btn" href="#/premium">Explorar VIP</a>'}
    <div class="user-wrap">
      <button class="avatar-btn" data-action="toggle-user-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Menú de ${esc(u.name)}">${avatar()}</button>
      <div id="user-menu" class="user-menu" role="menu" hidden>
        <div class="menu-head"><strong>${esc(u.name)}</strong><span>${esc(u.email)}</span></div>
        <a role="menuitem" href="#/account">${icon('user', 16)} Cuenta</a>
        <a role="menuitem" href="#/premium">${icon('crown', 16)} Plan: ${isVip() ? 'VIP' : 'Free'}</a>
        <button role="menuitem" data-action="logout">${icon('logout', 16)} Cerrar sesión</button>
      </div>
    </div>`;
}

function closeUserMenu() {
  const m = $('#user-menu');
  if (m) m.hidden = true;
  $('.avatar-btn')?.setAttribute('aria-expanded', 'false');
}

function setPlan(plan) {
  state.plan = plan;
  store.set('plan', plan);
  if (plan === 'vip' && state.inAd) endAd();
  if (plan === 'free' && isLocked(state.contextId)) {
    stopPlayback();
    resetPlayerUI();
  }
  updateQuality();
  renderSidebar();
  renderTopbarUser();
  route({ keepScroll: true });
}

// ---------- Modal y toast ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

let lastFocus = null;
function openModal(html) {
  lastFocus = document.activeElement;
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="icon-btn modal-close" data-action="close-modal" aria-label="Cerrar">${icon('x', 20)}</button>
        ${html}
      </div>
    </div>`;
  $('.modal .btn-primary, .modal button')?.focus();
}

function closeModal() {
  $('#modal-root').innerHTML = '';
  lastFocus?.focus?.();
}

function upgradeModal(reason) {
  openModal(`
    ${logo('modal-logo')}
    <h2 id="modal-title">Hazte VIP</h2>
    <p>${esc(reason)}</p>
    <ul class="modal-list">
      <li>${icon('check', 16)} Sin anuncios</li>
      <li>${icon('check', 16)} Saltos ilimitados</li>
      <li>${icon('check', 16)} Descargas y playlists exclusivas</li>
    </ul>
    <div class="modal-actions">
      <button class="btn-primary" data-action="confirm-vip">Hazte VIP por ${VIP_PRICE}/mes</button>
      <button class="btn-text" data-action="close-modal">Ahora no</button>
    </div>`);
}

function confirmVipModal() {
  openModal(`
    ${logo('modal-logo')}
    <h2 id="modal-title">Activar VYREX VIP</h2>
    <p>Plan VIP · ${VIP_PRICE}/mes. Esto es una demostración: no se realiza ningún cobro.</p>
    <div class="modal-actions">
      <button class="btn-primary" data-action="activate-vip">Activar VIP</button>
      <button class="btn-text" data-action="close-modal">Cancelar</button>
    </div>`);
}

// ---------- Acciones (delegación de eventos) ----------
const ACTIONS = {
  'play-context': (el) => {
    const ctx = el.dataset.context;
    if (ctx === state.contextId && state.currentId) togglePlay();
    else playContext(ctx, 0);
  },
  'play-track': (el) => {
    const ctx = el.dataset.context;
    const index = Number(el.dataset.index);
    if (ctx === state.contextId && el.dataset.trackId === state.currentId) togglePlay();
    else playContext(ctx, index);
  },
  'toggle-play': togglePlay,
  next: () => next(true),
  prev,
  'toggle-shuffle': toggleShuffle,
  'toggle-repeat': toggleRepeat,
  'toggle-mute': () => {
    state.muted = !state.muted;
    if (!state.muted && state.volume === 0) state.volume = 0.5;
    updateVolumeUI();
  },
  like: (el) => toggleLike(el.dataset.track),
  'like-current': () => state.currentId && toggleLike(state.currentId),
  'download-context': (el) => {
    if (!isVip()) return upgradeModal('Las descargas son exclusivas para miembros VIP.');
    const ids = contextIds(el.dataset.context);
    const all = ids.every((id) => state.downloaded.has(id));
    ids.forEach((id) => (all ? state.downloaded.delete(id) : state.downloaded.add(id)));
    store.set('downloaded', [...state.downloaded]);
    toast(all ? 'Descargas eliminadas' : `${ids.length} canciones descargadas`);
    route({ keepScroll: true });
  },
  'lib-filter': (el) => {
    state.libFilter = state.libFilter === el.dataset.filter ? null : el.dataset.filter;
    renderSidebar();
    if (parseRoute().view === 'library') route({ keepScroll: true });
  },
  'toggle-user-menu': (el) => {
    const m = $('#user-menu');
    m.hidden = !m.hidden;
    el.setAttribute('aria-expanded', String(!m.hidden));
  },
  'confirm-vip': confirmVipModal,
  'activate-vip': () => {
    closeModal();
    setPlan('vip');
    toast('¡Bienvenido a VYREX VIP!');
  },
  'set-plan': (el) => {
    setPlan(el.dataset.plan);
    toast('Ahora estás en VYREX Free');
  },
  'close-modal': closeModal,
  back: () => history.back(),
  forward: () => history.forward(),
  logout: async () => {
    closeUserMenu();
    await Auth.logout();
  },
};

function toggleLike(id) {
  const t = trackById(id);
  if (!t) return;
  if (state.liked.has(id)) {
    state.liked.delete(id);
    toast('Eliminada de Canciones que te gustan');
  } else {
    state.liked.add(id);
    toast('Añadida a Canciones que te gustan');
  }
  store.set('liked', [...state.liked]);
  updateLikeButtons(id);
  renderSidebar();
  if (parseRoute().view === 'liked') route({ keepScroll: true });
}

document.addEventListener('click', (e) => {
  if (e.target.classList?.contains('modal-backdrop')) return closeModal();
  const actionEl = e.target.closest('[data-action]');
  const link = e.target.closest('a[href]');
  // Un enlace dentro de un elemento con acción (p. ej. el artista en una fila) navega normalmente.
  if (link && actionEl && actionEl.contains(link) && link !== actionEl) return;
  if (!actionEl) {
    if (!e.target.closest('.user-wrap')) closeUserMenu();
    return;
  }
  const fn = ACTIONS[actionEl.dataset.action];
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  fn(actionEl);
});

document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input, textarea');
  if (e.key === 'Escape') {
    if ($('#modal-root').innerHTML) closeModal();
    closeUserMenu();
  }
  if (e.key === 'Enter' && e.target.matches('[data-action][tabindex]')) {
    e.preventDefault();
    e.target.click();
  }
  if (e.code === 'Space' && !typing && !e.target.matches('button, a, [tabindex]') && state.user) {
    e.preventDefault();
    togglePlay();
  }
});

// ---------- Controles de rango ----------
function bindPlayerInputs() {
  const progress = $('#progress');
  progress.addEventListener('input', () => {
    state.seeking = true;
    progress.style.setProperty('--val', `${progress.value / 10}%`);
    if (audio.duration && !state.inAd) $('#time-cur').textContent = fmt((progress.value / 1000) * audio.duration);
  });
  progress.addEventListener('change', () => {
    if (audio.duration && !state.inAd) audio.currentTime = (progress.value / 1000) * audio.duration;
    state.seeking = false;
  });
  const vol = $('#volume');
  vol.addEventListener('input', () => {
    state.volume = vol.value / 100;
    state.muted = state.volume === 0;
    updateVolumeUI();
    localStorage.setItem('vyrex:volume', String(state.volume));
  });
  $('#search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderSearchResults();
  });
  $('#main').addEventListener('scroll', onMainScroll, { passive: true });
}

function bindMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: togglePlay,
    pause: togglePlay,
    nexttrack: () => next(true),
    previoustrack: prev,
  };
  Object.entries(handlers).forEach(([k, fn]) => {
    try { navigator.mediaSession.setActionHandler(k, fn); } catch { /* no soportado */ }
  });
}

// ---------- Pantalla de acceso ----------
let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  const reg = mode === 'register';
  $('#auth-title').textContent = reg ? 'Regístrate para empezar a escuchar' : 'Inicia sesión en VYREX';
  $('#field-name').hidden = !reg;
  $('#field-confirm').hidden = !reg;
  $('#auth-submit').textContent = reg ? 'Crear cuenta' : 'Iniciar sesión';
  $('#switch-text').textContent = reg ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
  $('#switch-mode').textContent = reg ? 'Inicia sesión aquí' : 'Regístrate en VYREX';
  $('#auth-pass').autocomplete = reg ? 'new-password' : 'current-password';
  $('#auth-pass').placeholder = reg ? 'Mínimo 8 caracteres' : 'Contraseña';
  $('#google-btn span').textContent = reg ? 'Registrarte con Google' : 'Continuar con Google';
  authError('');
}

function authError(msg) {
  $('#auth-error').textContent = msg;
}

function setBusy(busy) {
  $('#auth-submit').disabled = busy;
  $('#google-btn').disabled = busy;
  $('#auth-submit').classList.toggle('loading', busy);
}

function bindAuthScreen() {
  $('#auth-note').textContent = Auth.isFirebase
    ? ''
    : 'Modo local: las cuentas se guardan en este navegador hasta conectar Firebase.';
  $('#switch-mode').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
  $('#toggle-pass').addEventListener('click', (e) => {
    const input = $('#auth-pass');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Ocultar' : 'Mostrar';
    e.currentTarget.setAttribute('aria-pressed', String(show));
  });
  $('#google-btn').addEventListener('click', async () => {
    authError('');
    setBusy(true);
    try {
      await Auth.loginWithGoogle();
    } catch (err) {
      authError(err.message);
    } finally {
      setBusy(false);
    }
  });
  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    authError('');
    const name = $('#auth-name').value.trim();
    const email = $('#auth-email').value.trim().toLowerCase();
    const password = $('#auth-pass').value;
    const confirm = $('#auth-confirm').value;
    const reg = authMode === 'register';
    if (reg && !name) return authError('Escribe tu nombre.');
    if (!EMAIL_RE.test(email)) return authError('Introduce un correo electrónico válido.');
    if (!password) return authError('Escribe tu contraseña.');
    if (reg && password.length < 8) return authError('La contraseña debe tener al menos 8 caracteres.');
    if (reg && password !== confirm) return authError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      if (reg) await Auth.register({ name, email, password });
      else await Auth.login({ email, password });
      e.target.reset();
    } catch (err) {
      authError(err.message);
    } finally {
      setBusy(false);
    }
  });
}

// ---------- Sesión ----------
function handleUser(user) {
  $('#splash').hidden = true;
  if (!user) {
    state.user = null;
    stopPlayback();
    document.title = 'VYREX - Música para todos';
    $('#app').hidden = true;
    $('#auth-screen').hidden = false;
    setAuthMode('login');
    return;
  }
  state.user = user;
  state.plan = store.get('plan', 'free');
  state.liked = new Set(store.get('liked', []));
  state.downloaded = new Set(store.get('downloaded', []));
  state.skips = store.get('skips', []);
  $('#auth-screen').hidden = true;
  $('#app').hidden = false;
  if (!location.hash) history.replaceState(null, '', '#/home');
  updateQuality();
  renderSidebar();
  renderTopbarUser();
  route();
}

function renderStaticIcons() {
  $$('[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, Number(el.dataset.iconSize) || 24);
  });
}

function detectLogo() {
  // Si existe assets/logo.png (el logo original), se usa en lugar del SVG.
  const img = new Image();
  img.onload = () => {
    LOGO_SRC = 'assets/logo.png';
    $$('img.logo-img').forEach((el) => { el.src = LOGO_SRC; });
    $('link[rel="icon"]').href = LOGO_SRC;
  };
  img.src = 'assets/logo.png';
}

async function boot() {
  renderStaticIcons();
  detectLogo();
  state.volume = Number(localStorage.getItem('vyrex:volume') ?? 0.7);
  updateVolumeUI();
  updateModeButtons();
  bindPlayerInputs();
  bindMediaSession();
  bindAuthScreen();
  window.addEventListener('hashchange', () => route());
  Auth.onChange(handleUser);
  try {
    await Auth.init();
  } catch (err) {
    console.error(err);
    handleUser(null);
    authError('No se pudo conectar con el servicio de inicio de sesión.');
  }
  probeDurations();
}

boot();
