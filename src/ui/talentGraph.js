import { state, toggleTalentNode } from '../data/state.js';
import { getGameData } from '../data/loader.js';

const isTouchDevice = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

const TRACK = (icon) => {
  if (!icon) return 2;
  if (icon.includes('PasSkill') || icon.includes('EXskill')) return 1;
  if (icon.includes('Level') || icon.includes('Skin') || icon.includes('UpRare')) return 2;
  if (icon.includes('Attk') || icon.includes('Hp') || icon.includes('PhysicDef') || icon.includes('MagicDef')) return 3;
  return 2;
};

/**
 * Level-based column assignment:
 * Middle backbone nodes anchor columns; side nodes go at same or +1 column.
 */
function computeColumns(nodes) {
  const cols = {};
  const byLevel = {};

  nodes.forEach(n => {
    const lv = n.req_level;
    if (!byLevel[lv]) byLevel[lv] = [];
    byLevel[lv].push(n);
  });

  let col = 1;
  for (const lv of Object.keys(byLevel).map(Number).sort((a, b) => a - b)) {
    const group = byLevel[lv];
    const mid = group.find(n => TRACK(n.icon) === 2);
    const others = group.filter(n => TRACK(n.icon) !== 2);

    if (mid) {
      cols[mid.id] = col;
      const dependent = others.filter(n => n.req_talent.includes(mid.id));
      const peer = others.filter(n => !n.req_talent.includes(mid.id));
      peer.forEach(n => { cols[n.id] = col; });
      if (dependent.length > 0) {
        col++;
        dependent.forEach(n => { cols[n.id] = col; });
      }
      col++;
    } else {
      others.forEach(n => { cols[n.id] = col; });
      col++;
    }
  }

  return cols;
}

export function renderTalentGraph(container) {
  const char = state.character;
  if (!char || !char.talents || char.talents.length === 0) {
    container.innerHTML = '<div class="tg-empty">Nhân vật này chưa có dữ liệu thiên phú.</div>';
    return;
  }

  const nodes = char.talents;
  const cols = computeColumns(nodes);
  const maxCol = Math.max(...Object.values(cols));

  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'tg-wrap';
  wrap.style.gridTemplateColumns = `repeat(${maxCol}, 58px)`;
  
  // Calculate explicit physical logical width for the talent graph
  const graphWidth = maxCol * 58 + Math.max(0, maxCol - 1) * 2 + 32;
  wrap.style.setProperty('--talent-graph-width', `${graphWidth}px`);
  wrap.style.width = `${graphWidth}px`;
  wrap.style.minWidth = `${graphWidth}px`;

  // SVG layer behind nodes
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tg-svg');
  svg.style.gridColumn = `1 / span ${maxCol}`;
  svg.style.gridRow = '1 / span 3';
  wrap.appendChild(svg);

  const nodeEls = {};

  nodes.forEach(node => {
    const col = cols[node.id] || 1;
    const track = TRACK(node.icon);
    const status = state.talentNodes[node.id] || 'neutral';

    const div = document.createElement('div');
    div.className = `tg-node track-${track} status-${status}`;
    div.style.gridColumn = String(col);
    div.style.gridRow = String(track);
    div.dataset.id = node.id;

    const inner = document.createElement('div');
    inner.className = 'tg-node-inner';
    const img = document.createElement('img');
    img.src = `/${node.icon}`;
    img.alt = node.name_vi || node.name_cn;
    inner.appendChild(img);
    div.appendChild(inner);

    div.setAttribute('tabindex', '0');
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', node.name_vi || node.name_cn);

    let pointerStartX = 0;
    let pointerStartY = 0;
    let isDragging = false;

    div.addEventListener('pointerdown', (e) => {
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      isDragging = false;
    });

    div.addEventListener('pointermove', (e) => {
      if (!isDragging) {
        const dist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);
        if (dist > 6) {
          isDragging = true;
        }
      }
    });

    div.addEventListener('pointercancel', () => {
      isDragging = true;
    });

    div.addEventListener('mouseenter', () => {
      if (!isTouchDevice()) {
        clearLeaveTimer();
        hoveredTalentId = node.id;
        showDetailPanel(div, node, char);
      }
    });

    div.addEventListener('mouseleave', () => {
      if (!isTouchDevice()) {
        startLeaveTimer();
      }
    });

    div.addEventListener('focus', () => {
      if (!isTouchDevice()) {
        clearLeaveTimer();
        hoveredTalentId = node.id;
        showDetailPanel(div, node, char);
      }
    });

    div.addEventListener('blur', () => {
      if (!isTouchDevice()) {
        startLeaveTimer();
      }
    });

    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggleTalentNode(node.id, char);
      }
    });

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDragging) {
        isDragging = false;
        return;
      }
      if (isTouchDevice()) {
        // Mobile/Touch: tap node -> open / update bottom sheet
        hoveredTalentId = node.id;
        showDetailPanel(div, node, char);
      } else {
        // Desktop: click node -> toggle talent node
        toggleTalentNode(node.id, char);
      }
    });

    wrap.appendChild(div);
    nodeEls[node.id] = { el: div, col, track, node };
  });

  container.appendChild(wrap);

  // Mouse drag-to-scroll helper for desktop emulation / drag testing
  let isContainerDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  container.addEventListener('mousedown', (e) => {
    // Only trigger if clicking on container or wrap background (not directly clicking a node button)
    if (e.target.closest('.tg-node')) return;
    isContainerDragging = true;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });
  container.addEventListener('mouseleave', () => { isContainerDragging = false; });
  container.addEventListener('mouseup', () => { isContainerDragging = false; });
  container.addEventListener('mousemove', (e) => {
    if (!isContainerDragging) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeft - walk;
  });

  // If hover detail panel is active, refresh it with updated status/node element
  if (!isTouchDevice() && hoveredTalentId && nodeEls[hoveredTalentId]) {
    const activeInfo = nodeEls[hoveredTalentId];
    showDetailPanel(activeInfo.el, activeInfo.node, char);
  }

/**
 * Remove redundant transitive edges (e.g. if A -> B and B -> C, remove A -> C line)
 * so each branch connects cleanly 1-to-1 without spider-web line overlaps.
 */
function getEssentialPrereqs(nodes) {
  const essentialMap = {};
  
  function hasPath(fromId, toId, visited = new Set()) {
    if (fromId === toId) return true;
    visited.add(fromId);
    const dependents = nodes.filter(x => (x.req_talent || []).includes(fromId));
    for (const dep of dependents) {
      if (!visited.has(dep.id)) {
        if (hasPath(dep.id, toId, visited)) return true;
      }
    }
    return false;
  }

  nodes.forEach(node => {
    const reqs = node.req_talent || [];
    essentialMap[node.id] = reqs.filter(A => !reqs.some(B => B !== A && hasPath(A, B)));
  });

  return essentialMap;
}

  // Draw SVG connectors after layout settles
  requestAnimationFrame(() => {
    const wrapRect = wrap.getBoundingClientRect();
    const W = wrap.scrollWidth;
    const H = wrap.scrollHeight;
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.style.width = `${W}px`;
    svg.style.height = `${H}px`;

    const essentialMap = getEssentialPrereqs(nodes);

    nodes.forEach(node => {
      const reqs = essentialMap[node.id] || [];
      if (!reqs.length) return;
      const toInfo = nodeEls[node.id];
      if (!toInfo) return;
      const toRect = toInfo.el.getBoundingClientRect();
      const toCX = toRect.left - wrapRect.left + toRect.width / 2;
      const toCY = toRect.top - wrapRect.top + toRect.height / 2;

      reqs.forEach(reqId => {
        const fromInfo = nodeEls[reqId];
        if (!fromInfo) return;
        const fromRect = fromInfo.el.getBoundingClientRect();
        const fromCX = fromRect.left - wrapRect.left + fromRect.width / 2;
        const fromCY = fromRect.top - wrapRect.top + fromRect.height / 2;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromCX);
        line.setAttribute('y1', fromCY);
        line.setAttribute('x2', toCX);
        line.setAttribute('y2', toCY);

        const fromStatus = state.talentNodes[reqId];
        const toStatus = state.talentNodes[node.id];
        const active = (fromStatus === 'target' || fromStatus === 'completed')
          && (toStatus === 'target' || toStatus === 'completed');
        line.setAttribute('class', `tg-line${active ? ' active' : ''}`);
        svg.appendChild(line);
      });
    });

    // Calculate and report DOM scroll metrics
    const clientWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    const innerGraphOffsetWidth = wrap.offsetWidth;

    let maxNodeRight = 0;
    Object.values(nodeEls).forEach(info => {
      const r = info.el.getBoundingClientRect().right;
      if (r > maxNodeRight) maxNodeRight = r;
    });
    const containerRight = container.getBoundingClientRect().right;

    window.__TALENT_METRICS__ = {
      clientWidth,
      scrollWidth,
      innerGraphOffsetWidth,
      rightmostNodeRight: maxNodeRight,
      containerRight,
      isScrollable: scrollWidth > clientWidth
    };

    console.log('[TALENT METRICS]', window.__TALENT_METRICS__);
  });
}

// ── Game-Style Detail Panel ───────────────────────────────────────────────
let hoveredTalentId = null;
let leaveTimer = null;
let activeNodeEl = null;

function clearLeaveTimer() {
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
}

function startLeaveTimer() {
  clearLeaveTimer();
  leaveTimer = setTimeout(() => {
    hoveredTalentId = null;
    hideDetailPanel();
  }, 200);
}

function formatDesc(text) {
  if (!text) return '';
  return text
    .replace(/<color=#([A-Fa-f0-9]{6})>/g, '<span style="color:#$1; font-weight:600;">')
    .replace(/<\/color>/g, '</span>');
}

const detailPanel = document.createElement('div');
detailPanel.className = 'tg-detail-panel';
detailPanel.style.display = 'none';
document.body.appendChild(detailPanel);

// Keep panel open when pointer enters panel
detailPanel.addEventListener('mouseenter', () => {
  clearLeaveTimer();
});

detailPanel.addEventListener('mouseleave', () => {
  startLeaveTimer();
});

// Close handlers
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hoveredTalentId = null;
    hideDetailPanel();
  }
});

document.addEventListener('click', (e) => {
  if (detailPanel.style.display === 'none') return;
  if (detailPanel.contains(e.target)) return;
  if (e.target.closest('.tg-node')) return;
  hoveredTalentId = null;
  hideDetailPanel();
});

window.addEventListener('resize', () => {
  if (activeNodeEl && detailPanel.style.display !== 'none') {
    positionPanel(activeNodeEl);
  }
});

function showDetailPanel(nodeEl, node, char) {
  if (!node || !nodeEl) return;
  activeNodeEl = nodeEl;

  const gameData = getGameData();
  const status = state.talentNodes[node.id] || 'neutral';

  // Primary Icon: Use real skill/passive icon if available, else fallback to node icon
  const primaryIconSrc = (node.skill_meta && node.skill_meta.skill_icon) 
    ? `/${node.skill_meta.skill_icon}` 
    : `/${node.icon}`;

  // Names
  const displayName = node.name_vi || (node.skill_meta && node.skill_meta.skill_name_cn) || node.name_cn;
  const cnName = (node.name_cn && node.name_cn !== displayName) ? node.name_cn : '';

  // Status label
  const statusMap = {
    'neutral': 'Chưa mở',
    'completed': 'Đã nâng',
    'target': 'Mục tiêu'
  };
  const statusLabel = statusMap[status] || 'Chưa mở';

  // Description
  let rawDesc = node.desc_vi || node.desc_cn || (node.skill_meta ? node.skill_meta.desc_cn : '');
  const descHtml = formatDesc(rawDesc);

  // Before -> After Skill Progression Box
  let progressionHtml = '';
  if (node.skill_meta && node.skill_meta.level > 1 && node.skill_meta.prev_level) {
    const prevLvl = node.skill_meta.prev_level;
    const nextLvl = node.skill_meta.level;
    const prevDescHtml = formatDesc(node.skill_meta.prev_desc_cn);
    const nextDescHtml = formatDesc(node.skill_meta.desc_cn);

    progressionHtml = `
      <div class="tg-pop-progression">
        <div class="tg-pop-section-title">TIẾN CẤP KỸ NĂNG / THIÊN PHÚ</div>
        <div class="tg-pop-prog-row">
          <div class="tg-pop-prog-card">
            <img src="${primaryIconSrc}" class="tg-pop-prog-icon" alt="Bậc ${prevLvl}" onerror="this.src='/${node.icon}'" />
            <span class="tg-pop-prog-lvl">Bậc ${prevLvl}</span>
          </div>
          <div class="tg-pop-prog-arrow">→</div>
          <div class="tg-pop-prog-card active">
            <img src="${primaryIconSrc}" class="tg-pop-prog-icon" alt="Bậc ${nextLvl}" onerror="this.src='/${node.icon}'" />
            <span class="tg-pop-prog-lvl">Bậc ${nextLvl}</span>
          </div>
        </div>
        ${(prevDescHtml && nextDescHtml && prevDescHtml !== nextDescHtml) ? `
          <div class="tg-pop-prog-diff">
            <div class="tg-pop-prog-desc-prev"><strong>Bậc ${prevLvl}:</strong> ${prevDescHtml}</div>
            <div class="tg-pop-prog-desc-next"><strong>Bậc ${nextLvl}:</strong> ${nextDescHtml}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Costs
  let costRows = '';
  if (node.cost && node.cost.length > 0) {
    node.cost.forEach(c => {
      if (c.id === '3') {
        const coinItem = gameData ? gameData.items['3'] : null;
        const coinName = coinItem ? (coinItem.name_vi || coinItem.name_cn) : 'Đông Cốc Tệ';
        costRows += `
          <div class="tg-pop-cost-row">
            <img src="/assets/items/itemicon_3.png" class="tg-pop-item-icon" alt="${coinName}" />
            <span class="tg-pop-item-name">${coinName}</span>
            <span class="tg-pop-item-qty">×${c.count.toLocaleString('vi-VN')}</span>
          </div>`;
      } else {
        const item = gameData ? gameData.items[c.id] : null;
        const name = item ? (item.name_vi || item.name_cn) : `Vật liệu ID ${c.id}`;
        const icon = item ? item.icon : `assets/items/itemicon_${c.id}.png`;
        costRows += `
          <div class="tg-pop-cost-row">
            <img src="/${icon}" class="tg-pop-item-icon" alt="${name}" onerror="this.src='/assets/items/itemicon_3.png'"/>
            <span class="tg-pop-item-name">${name}</span>
            <span class="tg-pop-item-qty">×${c.count.toLocaleString('vi-VN')}</span>
          </div>`;
      }
    });
  }

  // Unlock Prerequisites
  let prereqItems = [];
  if (node.req_level && node.req_level > 1) {
    prereqItems.push(`Đạt cấp độ nhân vật <strong>Lv.${node.req_level}</strong>`);
  }
  if (node.req_talent && node.req_talent.length > 0 && char.talents) {
    const names = node.req_talent.map(reqId => {
      const parentNode = char.talents.find(n => n.id === reqId);
      return parentNode ? (parentNode.name_vi || parentNode.name_cn || reqId) : reqId;
    });
    prereqItems.push(`Mở thiên phú: <strong>${names.join(', ')}</strong>`);
  }

  let conditionsHtml = '';
  if (prereqItems.length > 0) {
    conditionsHtml = `
      <div class="tg-pop-section">
        <div class="tg-pop-section-title">ĐIỀU KIỆN MỞ</div>
        <ul class="tg-pop-cond-list">
          ${prereqItems.map(it => `<li>${it}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Action Button Text
  let actionText = 'Nâng Thiên Phú';
  if (status === 'completed') {
    actionText = 'Đã Nâng (Bấm để Hủy)';
  }

  detailPanel.innerHTML = `
    <button class="tg-pop-close" id="tg-pop-close-btn" title="Đóng (Esc)">×</button>
    <div class="tg-pop-header">
      <img src="${primaryIconSrc}" class="tg-pop-icon" alt="${displayName}" onerror="this.src='/${node.icon}'" />
      <div class="tg-pop-title-group">
        <div class="tg-pop-title">${displayName}</div>
        ${cnName ? `<div class="tg-pop-cn">${cnName}</div>` : ''}
        <div class="tg-pop-badges">
          ${node.req_level ? `<span class="tg-pop-badge req">Lv.${node.req_level}</span>` : ''}
          <span class="tg-pop-badge status-${status}">${statusLabel}</span>
        </div>
      </div>
    </div>

    ${descHtml ? `<div class="tg-pop-desc">${descHtml}</div>` : ''}

    ${progressionHtml}

    ${costRows ? `
      <div class="tg-pop-section">
        <div class="tg-pop-section-title">CHI PHÍ NÂNG CẤP</div>
        <div class="tg-pop-costs">${costRows}</div>
      </div>
    ` : ''}

    ${conditionsHtml}

    <div class="tg-pop-footer">
      <button class="tg-pop-action-btn ${status}" id="tg-pop-action-btn">${actionText}</button>
    </div>
  `;

  const closeBtn = detailPanel.querySelector('#tg-pop-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hoveredTalentId = null;
      hideDetailPanel();
    });
  }

  const actionBtn = detailPanel.querySelector('#tg-pop-action-btn');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      toggleTalentNode(node.id, char);
    });
  }

  detailPanel.style.display = 'block';
  positionPanel(nodeEl);
}

function positionPanel(nodeEl) {
  if (!nodeEl || detailPanel.style.display === 'none') return;
  const rect = nodeEl.getBoundingClientRect();

  const panelW = Math.min(360, window.innerWidth - 24);
  let left = rect.right + 14;
  if (left + panelW > window.innerWidth - 12) {
    left = rect.left - panelW - 14;
  }
  if (left < 12) {
    left = Math.max(12, (window.innerWidth - panelW) / 2);
  }

  let top = rect.top;
  const panelH = detailPanel.offsetHeight || 320;
  if (top + panelH > window.innerHeight - 12) {
    top = window.innerHeight - panelH - 12;
  }
  top = Math.max(12, top);

  detailPanel.style.left = `${left}px`;
  detailPanel.style.top = `${top}px`;
}

function hideDetailPanel() {
  clearLeaveTimer();
  detailPanel.style.display = 'none';
  activeNodeEl = null;
}
