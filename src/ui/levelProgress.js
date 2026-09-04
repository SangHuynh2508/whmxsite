import { state, updateLevels } from '../data/state.js';

let inCur, inTgt;

export function initLevelProgress(curId, tgtId) {
  inCur = document.getElementById(curId);
  inTgt = document.getElementById(tgtId);

  [inCur, inTgt].forEach(input => {
    input.addEventListener('change', () => {
      let cur = parseInt(inCur.value) || 1;
      let tgt = parseInt(inTgt.value) || 1;
      
      if (cur < 1) cur = 1;
      if (tgt > 120) tgt = 120;
      if (tgt < cur) tgt = cur;
      
      inCur.value = cur;
      inTgt.value = tgt;
      
      updateLevels(cur, tgt);
    });
  });
}

export function renderLevelProgress() {
  inCur.value = state.levelCur;
  inTgt.value = state.levelTgt;
}
