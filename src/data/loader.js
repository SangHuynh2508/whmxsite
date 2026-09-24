import { loadLoreOverlay, mergeLoreOverlay } from '../features/profile/api/loreOverlay.mts';

let gameData = null;

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
    mergeLoreOverlay(gameData, await overlayPromise);
    return gameData;
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

export function getGameData() {
  return gameData;
}
