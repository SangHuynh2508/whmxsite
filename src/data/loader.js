let gameData = null;

export async function loadGameData() {
  if (gameData) return gameData;
  try {
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
    return gameData;
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

export function getGameData() {
  return gameData;
}
