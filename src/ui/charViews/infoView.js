/**
 * Info Sub-View Component (/characters/:slug/info)
 * Combat Gameplay Page: Stats + Skills List
 */

export function renderInfoTab(container, char) {
  const stats = char.stats || null;
  const skills = char.skills || [];

  // Skill level state per group
  const skillLevelState = {};
  skills.forEach(s => {
    skillLevelState[s.group_id] = 1;
  });

  function formatNum(val) {
    if (val === undefined || val === null) return '0';
    return val.toLocaleString('vi-VN');
  }

  function buildStatsHtml() {
    if (!stats) {
      return `<p class="empty-sub-state-text">Chưa có dữ liệu chỉ số chiến đấu cho nhân vật này.</p>`;
    }

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-lbl">Sinh Mệnh (HP)</span>
          <span class="stat-val highlight-hp">${formatNum(stats.hp_base)} → ${formatNum(stats.hp_max)}</span>
        </div>

        <div class="stat-card">
          <span class="stat-lbl">Tấn Công (ATK)</span>
          <span class="stat-val highlight-atk">${formatNum(stats.atk_base)} → ${formatNum(stats.atk_max)}</span>
        </div>

        <div class="stat-card">
          <span class="stat-lbl">Phòng Thủ Vật Lý</span>
          <span class="stat-val">${formatNum(stats.def_physic_base)} → ${formatNum(stats.def_physic_max)}</span>
        </div>

        <div class="stat-card">
          <span class="stat-lbl">Phòng Thủ Cấu Thuật</span>
          <span class="stat-val">${formatNum(stats.def_magic_base)} → ${formatNum(stats.def_magic_max)}</span>
        </div>

        <div class="stat-card">
          <span class="stat-lbl">Tốc Độ (SPD)</span>
          <span class="stat-val">${formatNum(stats.speed)}</span>
        </div>

        <div class="stat-card">
          <span class="stat-lbl">Di Chuyển (MOV)</span>
          <span class="stat-val">${formatNum(stats.mov)} ô</span>
        </div>
      </div>
    `;
  }

  function buildSkillsListHtml() {
    if (skills.length === 0) {
      return `<p class="empty-sub-state-text">Chưa có thông tin kỹ năng cho nhân vật này.</p>`;
    }

    return skills.map(skill => {
      const curLvlNum = skillLevelState[skill.group_id] || 1;
      const curLevelData = skill.levels.find(l => l.level === curLvlNum) || skill.levels[0] || {};

      const iconPath = curLevelData.icon || `/assets/skills/${skill.group_id}.png`;
      const nameVi = curLevelData.name_vi || curLevelData.name_cn || `Kỹ Năng ${skill.group_id}`;
      const nameCn = curLevelData.name_cn || "";
      const descCn = curLevelData.desc_cn || curLevelData.desc_raw || "";
      const maxLvl = skill.max_level || skill.levels.length;
      const typeId = curLevelData.type_id || 1;

      // DO NOT show generic/meaningless badges such as "Thường" (type_id === 1)
      const showTypeBadge = typeId !== 1;
      const typeLabel = curLevelData.type || "";

      const selRange = curLevelData.select_range || "";
      const effRange = curLevelData.effect_range || 0;
      const effType = curLevelData.effect_range_type || "";
      const isPassive = typeId === 3 || typeId === 5 || typeId === 6;

      // Level selector buttons
      let lvlSelectorHtml = "";
      if (maxLvl > 1) {
        lvlSelectorHtml = `
          <div class="skill-lvl-selector">
            <span class="lvl-sel-label">Cấp độ:</span>
            <div class="lvl-btn-group">
              ${skill.levels.map(l => `
                <button type="button" 
                        class="lvl-btn ${l.level === curLvlNum ? 'active' : ''}"
                        data-group="${skill.group_id}" 
                        data-level="${l.level}">
                  Lv. ${l.level}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="skill-entry-card" id="skill-entry-${skill.group_id}">
          <div class="skill-entry-header">
            <div class="skill-icon-wrapper">
              <img src="${iconPath}" 
                   alt="${nameVi}" 
                   class="skill-icon-img"
                   onerror="this.onerror=null; this.src='/assets/items/itemicon_3.png';" />
            </div>

            <div class="skill-header-meta">
              <div class="skill-title-row">
                <h4 class="skill-name-vi">${nameVi}</h4>
                ${showTypeBadge ? `<span class="skill-type-badge type-${typeId}">${typeLabel}</span>` : ''}
              </div>

              ${nameCn ? `<div class="skill-name-cn cn-font">${nameCn}</div>` : ''}
              ${lvlSelectorHtml}
            </div>
          </div>

          <div class="skill-entry-body">
            <!-- Range Section -->
            ${renderRangeSection(selRange, effRange, effType, isPassive)}

            <!-- Resolved Description -->
            <div class="skill-desc-block">
              <p class="skill-desc-primary">${formatSkillText(descCn)}</p>
              <details class="skill-cn-details">
                <summary class="cn-summary">Xem văn bản gốc (Chinese)</summary>
                <p class="skill-desc-secondary cn-font">${descCn}</p>
              </details>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="char-info-wrapper">
      <!-- Section A: Stats (CHỈ SỐ) -->
      <section class="info-stats-section">
        <div class="info-section-header">
          <h3>CHỈ SỐ CHIẾN ĐẤU</h3>
          <span class="stats-level-badge">Lv.1 → Lv.120 (Tối đa)</span>
        </div>
        ${buildStatsHtml()}
      </section>

      <!-- Section B: Skills List (KỸ NĂNG) -->
      <section class="info-skills-section">
        <div class="info-section-header">
          <h3>DANH SÁCH KỸ NĂNG</h3>
          <span class="skills-count-badge">${skills.length} Kỹ Năng</span>
        </div>

        <div class="skills-entries-list" id="info-skills-list">
          ${buildSkillsListHtml()}
        </div>
      </section>
    </div>
  `;

  // Attach event listener for Skill Level selectors
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.lvl-btn');
    if (!btn) return;

    const group = btn.dataset.group;
    const level = parseInt(btn.dataset.level, 10);
    if (!group || !level) return;

    skillLevelState[group] = level;

    const listContainer = document.getElementById('info-skills-list');
    if (listContainer) {
      listContainer.innerHTML = buildSkillsListHtml();
    }
  });
}

function formatSkillText(text) {
  if (!text) return "Chưa có mô tả.";

  return text
    .replace(/\[[A-Za-z0-9_]+,\d+\]/g, 'X')
    .replace(/<color=#([0-9a-fA-F]{6})>(.*?)<\/color>/g, '<span class="highlight-val" style="color: #$1">$2</span>')
    .replace(/\n/g, '<br/>');
}

function renderRangeSection(selectRangeStr, effectRangeVal, effectRangeType, isPassive) {
  if (isPassive) {
    return `
      <div class="skill-range-compact">
        <span class="range-subtle-tag">Kỹ năng bị động</span>
      </div>
    `;
  }

  const hasRangeData = (selectRangeStr && selectRangeStr !== "0,0" && selectRangeStr !== "0") || (effectRangeVal && effectRangeVal > 0);
  if (!hasRangeData) return '';

  return `
    <div class="skill-range-compact">
      <span class="range-lbl">Phạm vi chọn: <strong>${selectRangeStr || 'Tự động'}</strong></span>
      ${effectRangeVal ? `<span class="range-lbl">Hiệu ứng: <strong>${effectRangeVal}</strong></span>` : ''}
    </div>
  `;
}
