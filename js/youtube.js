// YouTube en VYREX: búsqueda (Data API v3) y reproducción oficial (IFrame Player API).
// El reproductor embebido es obligatorio y visible según los términos de YouTube;
// VYREX no descarga ni re-aloja ningún audio o video.
import { YOUTUBE_API_KEY } from './youtube-config.js';

export const isConfigured = Boolean(YOUTUBE_API_KEY);

let player = null;
let apiPromise = null;
const listeners = new Set();

export function onEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(type, data = {}) {
  listeners.forEach((fn) => fn({ type, ...data }));
}

export async function search(query) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10', // Música
    maxResults: '10',
    q: query,
    key: YOUTUBE_API_KEY,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'YouTube no respondió');
  return (payload.items || []).map((v) => ({
    id: `yt_${v.id.videoId}`,
    videoId: v.id.videoId,
    title: v.snippet.title,
    artistName: v.snippet.channelTitle,
    image: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
    genre: 'Video',
    duration: 0,
    local: false,
    yt: true,
  }));
}

function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ||= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('yt api timeout')), 12_000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      prev?.();
      resolve();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('yt api failed'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

export async function play(videoId) {
  await loadApi();
  if (!player) {
    player = new YT.Player('yt-player', {
      width: '100%',
      height: '100%',
      videoId,
      playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
      events: {
        onStateChanged: (e) => {
          emit('state', { state: e.data });
          if (e.data === YT.PlayerState.ENDED) emit('ended');
        },
        onError: (e) => emit('error', { code: e.data }),
      },
    });
  } else {
    player.loadVideoById(videoId);
  }
}

export function pause() { player?.pauseVideo?.(); }
export function resume() { player?.playVideo?.(); }
export function stop() { player?.stopVideo?.(); }
export function seek(seconds) { player?.seekTo?.(Math.max(0, seconds), true); }
export function setVolume(v) { player?.setVolume?.(Math.round(Math.min(1, Math.max(0, v)) * 100)); }
export function getTime() { return player?.getCurrentTime?.() || 0; }
export function getDuration() { return player?.getDuration?.() || 0; }
