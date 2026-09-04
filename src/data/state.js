// Global Application State

export const state = {
  character: null,
  levelCur: 1,
  levelTgt: 1,
  // nodes state: mapping of talent ID -> state ('neutral', 'completed', 'target', 'upgrade')
  talentNodes: {}, 
  autoMaxMode: true, // Toggle for Smart Auto-Max
};

const listeners = [];

export function subscribe(listener) {
  listeners.push(listener);
}

export function notify() {
  listeners.forEach(fn => fn(state));
}

export function setCharacter(char, syncHash = true) {
  state.character = char;
  state.levelCur = 1;
  state.levelTgt = 1;
  state.talentNodes = {};
  
  if (char && char.talents) {
    // initialize all nodes to neutral
    char.talents.forEach(t => {
      state.talentNodes[t.id] = 'neutral';
    });
  }

  // Sync URL hash for sharing links when in calculator view
  if (syncHash && !window.location.hash.includes('/characters/')) {
    const targetHash = char ? `#${char.id}` : '';
    if (window.location.hash !== targetHash) {
      history.replaceState(null, '', targetHash || window.location.pathname);
    }
  }

  notify();
}

export function updateLevels(cur, tgt) {
  state.levelCur = cur;
  state.levelTgt = tgt;
  // Sync talent nodes to match the new level range (if auto-max is on)
  if (state.autoMaxMode && state.character) {
    syncTalentsToLevel(state.character, tgt);
  }
  notify();
}

/**
 * Auto-select all talent nodes whose req_level <= targetLevel
 * and deselect nodes whose req_level > targetLevel.
 * Respects prerequisite order (topological: sorts by req_level then propagates).
 */
function syncTalentsToLevel(charData, targetLevel) {
  const nodes = charData.talents;
  // Reset all nodes first
  nodes.forEach(n => { state.talentNodes[n.id] = 'neutral'; });

  // Sort by req_level ascending so we process prerequisites first
  const sorted = [...nodes].sort((a, b) => a.req_level - b.req_level);

  sorted.forEach(node => {
    if (node.req_level > targetLevel) return; // skip locked by level
    // Check all prerequisites are also selected
    const prereqsMet = (node.req_talent || []).every(
      req => state.talentNodes[req] === 'target' || state.talentNodes[req] === 'completed'
    );
    if (prereqsMet) {
      state.talentNodes[node.id] = 'target';
    }
  });
}


export function toggleTalentNode(nodeId, charData) {
  // Clicking a node sets its target level and unlocks prerequisites / dependencies automatically
  autoMaxUnlock(nodeId, charData);
  notify();
}

function getUnlockedLevelCap(reqLevel) {
  const caps = {
    0: 15, 1: 15, 10: 15,
    15: 30, 20: 30,
    30: 50, 40: 50,
    50: 70, 60: 70,
    70: 90,
    90: 100,
    100: 110,
    110: 120
  };
  return caps[reqLevel] || reqLevel;
}

function autoMaxUnlock(nodeId, charData) {
  const node = charData.talents.find(t => t.id === nodeId);
  if (!node) return;

  // If already target, toggle off (and remove all nodes that depend on this)
  if (state.talentNodes[nodeId] === 'target') {
    uncheckWithDependents(nodeId, charData);
    return;
  }

  // Mark this node and all its prerequisites as target
  const checkPrereq = (id) => {
    state.talentNodes[id] = 'target';
    const n = charData.talents.find(t => t.id === id);
    if (n) {
      // Sync level cap
      const targetCap = getUnlockedLevelCap(n.req_level || 0);
      if (targetCap > state.levelTgt) {
        state.levelTgt = targetCap;
      }
      (n.req_talent || []).forEach(reqId => {
        if (state.talentNodes[reqId] !== 'completed') {
          checkPrereq(reqId);
        }
      });
    }
  };

  checkPrereq(nodeId);
}


function manualUnlock(nodeId, charData) {
  const curStatus = state.talentNodes[nodeId];
  if (curStatus === 'target' || curStatus === 'completed') {
    // Toggle off — also uncheck any dependents
    uncheckWithDependents(nodeId, charData);
    return;
  }

  const node = charData.talents.find(t => t.id === nodeId);
  if (!node) return;

  // Enforce prerequisites
  const prereqsMet = (node.req_talent || []).every(
    req => state.talentNodes[req] === 'target' || state.talentNodes[req] === 'completed'
  );

  if (prereqsMet) {
    state.talentNodes[nodeId] = 'target';
    // Sync level cap
    const targetCap = getUnlockedLevelCap(node.req_level || 0);
    if (targetCap > state.levelTgt) {
      state.levelTgt = targetCap;
    }
  } else {
    // Show which prerequisites are missing instead of generic alert
    const missing = (node.req_talent || [])
      .filter(req => state.talentNodes[req] !== 'target' && state.talentNodes[req] !== 'completed')
      .map(req => charData.talents.find(t => t.id === req)?.name_vi || req)
      .join(', ');
    alert(`Chưa mở khóa thiên phú yêu cầu phía trước: ${missing}`);
  }
}

/**
 * Uncheck a node and recursively uncheck any nodes that depend on it
 */
function uncheckWithDependents(nodeId, charData) {
  state.talentNodes[nodeId] = 'neutral';
  // Find all nodes whose req_talent includes this node
  charData.talents.forEach(n => {
    if ((n.req_talent || []).includes(nodeId) && state.talentNodes[n.id] === 'target') {
      uncheckWithDependents(n.id, charData);
    }
  });
}
