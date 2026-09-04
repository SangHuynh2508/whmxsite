/**
 * Standalone Read-Only Character Talent Tree Sub-View (/characters/:slug/talents)
 */
import { getTalentIconUrl } from '../talentGraph.js';

let popupHideTimeout = null;

export function renderTalentsTab(container, char) {
  const talents = char.talents || [];

  if (talents.length === 0) {
    container.innerHTML = `
      <div class="empty-sub-state">
        <p>Nhân vật này chưa có dữ liệu cây thiên phú.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="talents-page-wrapper">
      <div class="talents-page-header">
        <div class="t-header-title">
          <h2>CÂY THIÊN PHÚ NHÂN VẬT</h2>
          <span class="t-sub-info">${talents.length} Nút thiên phú (3 Nhánh)</span>
        </div>
        <p class="t-help-tip">
          <span class="tip-icon">💡</span>
          Rê chuột hoặc nhấn vào từng nút thiên phú để xem thông số tác dụng và yêu cầu. (Chế độ tra cứu)
        </p>
      </div>

      <div class="talent-graph-subview-container readonly-talent-tree" id="char-detail-talent-graph">
        <!-- Rendered by renderReadOnlyTalentTree -->
      </div>
    </div>
  `;

  const graphContainer = document.getElementById('char-detail-talent-graph');
  if (graphContainer) {
    renderReadOnlyTalentTree(graphContainer, char);
  }
}

/**
 * Compute direct prerequisites by removing transitive redundant edges
 */
function getDirectPrerequisites(nodes) {
  const directReqs = {};
  nodes.forEach(n => {
    directReqs[n.id] = Array.isArray(n.req_talent) ? [...n.req_talent] : [];
  });

  const reduced = {};
  nodes.forEach(n => {
    const raw = directReqs[n.id];
    const eff = new Set(raw);
    for (const r1 of raw) {
      for (const r2 of raw) {
        if (r1 === r2) continue;
        const visited = new Set();
        const queue = [...(directReqs[r2] || [])];
        while (queue.length > 0) {
          const curr = queue.shift();
          if (curr === r1) {
            eff.delete(r1);
            break;
          }
          if (!visited.has(curr)) {
            visited.add(curr);
            queue.push(...(directReqs[curr] || []));
          }
        }
      }
    }
    reduced[n.id] = Array.from(eff);
  });

  return reduced;
}

/**
 * Render Full-Color Read-Only Talent Tree
 */
function renderReadOnlyTalentTree(container, char) {
  const nodes = char.talents || [];
  
  const TRACK = (icon) => {
    if (!icon) return 2;
    if (icon.includes('PasSkill') || icon.includes('EXskill')) return 1;
    if (icon.includes('Level') || icon.includes('Skin') || icon.includes('UpRare')) return 2;
    if (icon.includes('Attk') || icon.includes('Hp') || icon.includes('PhysicDef') || icon.includes('MagicDef')) return 3;
    return 2;
  };

  function computeColumns(nodesList) {
    const cols = {};
    const byLevel = {};

    nodesList.forEach(n => {
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
        const dependent = others.filter(n => (n.req_talent || []).includes(mid.id));
        const peer = others.filter(n => !(n.req_talent || []).includes(mid.id));
        peer.forEach(n => { cols[n.id] = col; });
        if (dependent.length > 0) {
          col++;
          dependent.forEach(n => { cols[n.id] = col; });
        }
      } else {
        group.forEach(n => { cols[n.id] = col; });
      }
      col++;
    }
    return cols;
  }

  const cols = computeColumns(nodes);
  const maxCol = Math.max(...Object.values(cols), 1);

  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'tg-wrap readonly-wrap';
  const graphWidth = maxCol * 58 + Math.max(0, maxCol - 1) * 2 + 32;
  wrap.style.setProperty('--talent-graph-width', `${graphWidth}px`);
  wrap.style.width = `${graphWidth}px`;
  wrap.style.gridTemplateColumns = `repeat(${maxCol}, 58px)`;

  // SVG Layer for dependency lines
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tg-svg');
  svg.style.gridColumn = `1 / span ${maxCol}`;
  svg.style.gridRow = '1 / span 3';
  wrap.appendChild(svg);

  const nodeEls = {};
  const popup = getOrCreatePopup();

  nodes.forEach(node => {
    const col = cols[node.id] || 1;
    const track = TRACK(node.icon);

    const div = document.createElement('div');
    div.className = `tg-node track-${track} readonly-node active-full-color`;
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

    // Setup Hover + Pointer + Tap events
    setupNodeEvents(div, popup, node, char);

    wrap.appendChild(div);
    nodeEls[node.id] = { el: div, col, track, node };
  });

  container.appendChild(wrap);

  // Draw connecting SVG lines using direct prerequisites
  requestAnimationFrame(() => {
    drawTalentLines(svg, wrap, nodeEls, nodes);
  });
}

function setupNodeEvents(nodeEl, popup, node, char) {
  const openPopup = () => {
    if (popupHideTimeout) {
      clearTimeout(popupHideTimeout);
      popupHideTimeout = null;
    }
    showReadOnlyTalentPopup(nodeEl, node, char);
  };

  const scheduleClose = () => {
    popupHideTimeout = setTimeout(() => {
      hideReadOnlyTalentPopup();
    }, 180);
  };

  nodeEl.addEventListener('mouseenter', openPopup);
  nodeEl.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') openPopup();
  });
  nodeEl.addEventListener('mouseleave', scheduleClose);

  nodeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openPopup();
  });
}

function drawTalentLines(svg, wrap, nodeEls, nodes) {
  svg.innerHTML = '';
  const wrapRect = wrap.getBoundingClientRect();
  const directReqs = getDirectPrerequisites(nodes);

  nodes.forEach(node => {
    const targetInfo = nodeEls[node.id];
    if (!targetInfo) return;

    (directReqs[node.id] || []).forEach(reqId => {
      const srcInfo = nodeEls[reqId];
      if (!srcInfo) return;

      const srcRect = srcInfo.el.getBoundingClientRect();
      const tgtRect = targetInfo.el.getBoundingClientRect();

      const x1 = srcRect.left + srcRect.width / 2 - wrapRect.left;
      const y1 = srcRect.top + srcRect.height / 2 - wrapRect.top;
      const x2 = tgtRect.left + tgtRect.width / 2 - wrapRect.left;
      const y2 = tgtRect.top + tgtRect.height / 2 - wrapRect.top;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('class', 'tg-line active-line');
      svg.appendChild(line);
    });
  });
}

function getOrCreatePopup() {
  let popup = document.getElementById('readonly-talent-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'readonly-talent-popup';
    popup.className = 'readonly-talent-popup';
    document.body.appendChild(popup);

    popup.addEventListener('mouseenter', () => {
      if (popupHideTimeout) {
        clearTimeout(popupHideTimeout);
        popupHideTimeout = null;
      }
    });

    popup.addEventListener('mouseleave', () => {
      hideReadOnlyTalentPopup();
    });
  }
  return popup;
}

function hideReadOnlyTalentPopup() {
  const popup = document.getElementById('readonly-talent-popup');
  if (popup) {
    popup.style.display = 'none';
  }
}

function showReadOnlyTalentPopup(nodeEl, node, char) {
  const popup = getOrCreatePopup();
  const nameVi = node.name_vi || node.name_cn;
  const nameCn = node.name_cn !== nameVi ? node.name_cn : '';
  const descVi = node.desc_vi || node.desc_cn || 'Chưa có mô tả.';
  const iconUrl = getTalentIconUrl(node);

  const iconHtml = iconUrl 
    ? `<img src="${iconUrl}" alt="${nameVi}" class="rot-pop-icon" onerror="this.onerror=null; this.style.display='none';" />`
    : `<div class="rot-pop-icon rot-pop-icon-placeholder"></div>`;

  popup.innerHTML = `
    <div class="rot-pop-header">
      ${iconHtml}
      <div class="rot-pop-title-box">
        <h4 class="rot-pop-name">${nameVi}</h4>
        ${nameCn ? `<span class="rot-pop-cn cn-font">${nameCn}</span>` : ''}
        ${node.req_level ? `<span class="rot-pop-badge">Yêu cầu Lv. ${node.req_level}</span>` : ''}
      </div>
      <button type="button" class="rot-pop-close" id="rot-pop-close" aria-label="Đóng">×</button>
    </div>

    <div class="rot-pop-body">
      <p class="rot-pop-desc">${descVi}</p>
    </div>
  `;

  popup.style.display = 'block';
  positionPopup(popup, nodeEl);

  const closeBtn = popup.querySelector('#rot-pop-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideReadOnlyTalentPopup();
    });
  }
}

function positionPopup(popup, nodeEl) {
  const rect = nodeEl.getBoundingClientRect();
  const popupW = Math.min(340, window.innerWidth - 24);

  let left = rect.right + 12;
  if (left + popupW > window.innerWidth - 12) {
    left = rect.left - popupW - 12;
  }
  if (left < 12) {
    left = Math.max(12, (window.innerWidth - popupW) / 2);
  }

  let top = rect.top;
  const popupH = popup.offsetHeight || 220;
  if (top + popupH > window.innerHeight - 12) {
    top = window.innerHeight - popupH - 12;
  }
  top = Math.max(12, top);

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

