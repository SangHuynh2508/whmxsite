let gameData = null;

export async function loadGameData() {
  if (gameData) return gameData;
  try {
    const res = await fetch('/data.json');
    gameData = await res.json();
    return gameData;
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

export function getGameData() {
  return gameData;
}
