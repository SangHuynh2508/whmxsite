import { loadLoreOverlay, mergeLoreOverlay } from '../features/profile/api/loreOverlay.mts';

let gameData = null;
let loreMerged = Promise.resolve();

export async function loadGameData() {
  if (gameData) return gameData;
  try {
    // Started in parallel with data.json; resolves to null on any failure (CN fallback).
    const overlayPromise = loadLoreOverlay(import.meta.env.VITE_LORE_POINTER_URL);
    const res = await fetch('/data.json');
    gameData = await res.json();
    if (gameData && gameData.characters) {
      Object.values(gameData.characters).forEach(char => {
        if (char.icon) {
          char.icon = char.icon.replace('assets/avatars/', 'assets/characters/avatars/');
        }
        if (Array.isArray(char.skins)) {
          char.skins.forEach(skin => {
            if (skin.image) {
              skin.image = skin.image.replace('assets/drawings/', 'assets/characters/drawings/');
            }
          });
        }
      });
    }
    // Do not hold the app for up to 5 s: merge when the overlay arrives. Views read
    // char.profile at render time, so the next render shows it.
    // Views that are all lore (the Hồ Sơ Lưu Trữ tab) wait on loreOverlayMerged() and re-render.
    loreMerged = overlayPromise.then((overlay) => { mergeLoreOverlay(gameData, overlay); });
    return gameData;
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

export function getGameData() {
  return gameData;
}

export function loreOverlayMerged() {
  return loreMerged;
}
