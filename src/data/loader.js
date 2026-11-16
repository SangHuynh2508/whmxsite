import { loadGameDocument, loadLoreOverlay, mergeLoreOverlay } from '../features/profile/api/loreOverlay.mts';

// Data split (owner 2026-11-14, docs/DATA_SPLIT.md): public/data.json stays the source for tools and the server;
// the browser loads data/index.json (every character without skills/talents/zhizhi/brilliant_*/profile) up front,
// then data/c/<id>.json + data/buffs.json when a character is opened (loadCharacterDetail).
let gameData = null;
let loreMerged = Promise.resolve();
// Game database + builds (Build tab); null until published / when it fails to load.
/** @type {Promise<import("../features/profile/api/loreOverlay.mts").GameDocument | null>} */
let gameDocument = Promise.resolve(null);
const detailLoads = new Map(); // id → Promise<character>
const detailLoaded = new Set();
const overlayIds = new Set(); // characters whose profile came from the lore overlay: a detail file must not replace it
let buffsLoad = null;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

export async function loadGameData() {
  if (gameData) return gameData;
  try {
    // Started in parallel with the index; resolves to null on any failure (CN fallback).
    const overlayPromise = loadLoreOverlay(import.meta.env.VITE_LORE_POINTER_URL);
    gameDocument = loadGameDocument(import.meta.env.VITE_LORE_POINTER_URL);
    gameData = await fetchJson('/data/index.json');
    // Do not hold the app for up to 5 s: merge when the overlay arrives. Views read
    // char.profile at render time, so the next render shows it.
    // Views that are all lore (the Hồ Sơ Lưu Trữ tab) wait on loreOverlayMerged() and re-render.
    loreMerged = overlayPromise.then((overlay) => {
      mergeLoreOverlay(gameData, overlay);
      for (const id of Object.keys(overlay?.characters ?? {})) overlayIds.add(id);
    });
    return gameData;
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

export function getGameData() {
  return gameData;
}

/** True once loadCharacterDetail(id) has filled in the character's skills, talents, zhizhi, Hoán Chương and profile. */
export function isCharacterDetailLoaded(id) {
  return detailLoaded.has(id);
}

/** Loads one character's heavy fields into getGameData().characters[id] (and the buff registry, once). */
export function loadCharacterDetail(id) {
  if (!detailLoads.has(id)) {
    buffsLoad ??= fetchJson('/data/buffs.json').then((b) => { gameData.buff_registry = b; }).catch((e) => { buffsLoad = null; throw e; });
    const load = Promise.all([fetchJson(`/data/c/${encodeURIComponent(id)}.json`), buffsLoad]).then(([detail]) => {
      const char = gameData.characters[id];
      for (const [k, v] of Object.entries(detail)) if (!(k === 'profile' && overlayIds.has(id))) char[k] = v;
      detailLoaded.add(id);
      return char;
    });
    load.catch(() => detailLoads.delete(id)); // a failed load is retried next time
    detailLoads.set(id, load);
  }
  return detailLoads.get(id);
}

export function loadedGameDocument() {
  return gameDocument;
}

export function loreOverlayMerged() {
  return loreMerged;
}
