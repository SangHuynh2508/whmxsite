export function calculateResources(gameData, state) {
  let totalExp = 0;
  let totalCoin = 0;
  const mats = {};

  if (!state.character) {
    return { totalExp, totalCoin, mats };
  }

  // 1. Calculate Level EXP
  const getExp = (lv) => gameData.expCurve[lv] || 0;
  if (state.levelTgt > state.levelCur) {
    totalExp = getExp(state.levelTgt) - getExp(state.levelCur);
  }
  
  // Coin for EXP (1 EXP = 0.5 Coin)
  const expCoin = Math.ceil(totalExp * 0.5);
  totalCoin += expCoin;

  // 2. Calculate Talents
  // Only calculate for nodes that are 'target'
  const char = state.character;
  if (char.talents) {
    char.talents.forEach(node => {
      if (state.talentNodes[node.id] === 'target') {
        (node.cost || []).forEach(costItem => {
          if (costItem.id === "3") {
            totalCoin += costItem.count;
          } else {
            mats[costItem.id] = (mats[costItem.id] || 0) + costItem.count;
          }
        });
      }
    });
  }

  // TODO: Add Character Rank Up (Ascension / Limit Break) costs if needed
  // Let's assume for now the limit breaks cost materials. We haven't implemented it in Phase 1, but we can do it later.

  return { totalExp, totalCoin, mats };
}
