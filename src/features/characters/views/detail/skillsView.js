/**
 * Skills Sub-View Component (/characters/:characterId/skills)
 */

export function renderSkillsTab(container, char) {
  const skills = char.skills || [];
  
  if (skills.length === 0) {
    container.innerHTML = `
      <div class="empty-sub-state">
        <p>Không có dữ liệu kỹ năng cho nhân vật này.</p>
      </div>
    `;
    return;
  }

  // Active level state per skill group: { [group_id]: levelNum }
  const skillLevelState = {};
  skills.forEach(s => {
    skillLevelState[s.group_id] = 1;
  });

  function renderSkillCard(skill, isSubEntry = false, subLabel = "") {
    const curLvlNum = skillLevelState[skill.group_id] || 1;
    const curLevelData = skill.levels.find(l => l.level === curLvlNum) || skill.levels[0] || {};
    
    const iconPath = curLevelData.icon ? `/${curLevelData.icon}` : "";
    const typeLabel = curLevelData.type || "Kỹ Năng";
    const primaryName = curLevelData.name_vi || curLevelData.name_cn || `Kỹ Năng ${skill.group_id}`;
    const secondaryName = curLevelData.name_vi ? (curLevelData.name_cn || "") : "";
    const descPrimary = curLevelData.desc_vi || curLevelData.desc_cn || curLevelData.desc_raw || "";
    const descCn = curLevelData.desc_cn || curLevelData.desc_raw || "";
    const maxLvl = skill.max_level || skill.levels.length;

    const selRange = curLevelData.select_range || "";
    const effRange = curLevelData.effect_range || 0;
    const effType = curLevelData.effect_range_type || "";

    // Check if skill has range
    const hasRangeData = (selRange && selRange !== "0,0" && selRange !== "0") || (effRange && effRange > 0);

    // Level selector buttons HTML
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

    let subFormsHtml = "";
    if (!isSubEntry) {
      if (skill.summon_skills && skill.summon_skills.length > 0) {
        subFormsHtml += '<div class="sub-skills-container summon">' + skill.summon_skills.map(s => renderSkillCard(s, true, "Triệu hồi")).join('') + '</div>';
      }
    }

    return `
      <div class="skill-card-panel ${isSubEntry ? 'sub-entry' : ''}" id="skill-card-${skill.group_id}">
        <!-- Skill Header Header -->
        <div class="skill-card-header">
          <div class="skill-icon-wrapper">
            ${iconPath ? `<img src="${iconPath}" alt="${primaryName}" class="skill-icon-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><div class="skill-icon-fallback" style="display:none;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div>` : `<div class="skill-icon-fallback"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div>`}
          </div>
          
          <div class="skill-header-meta">
            <div class="skill-title-row">
              ${isSubEntry && subLabel ? `<span class="sub-entry-label">${subLabel}</span>` : ''}
              <h3 class="skill-name-vi">${primaryName}</h3>
              <span class="skill-type-badge type-${curLevelData.type_id || 1}">${typeLabel}</span>
            </div>
            
            ${secondaryName ? `<div class="skill-name-cn cn-font">${secondaryName}</div>` : ''}

            ${lvlSelectorHtml}
          </div>
        </div>

        <div class="skill-card-body">
          <!-- Range Section -->
          <div class="skill-section range-section">
            <div class="skill-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><cross x1="12" y1="8" x2="12" y2="16"></cross></svg>
              <span>PHẠM VI</span>
            </div>
            
            <div class="range-visualizer-container" id="range-container-${skill.group_id}">
              ${renderRangeHtml(selRange, effRange, effType, hasRangeData)}
            </div>
          </div>

          <!-- Description Section -->
          <div class="skill-section desc-section">
            <div class="skill-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              <span>MÔ TẢ CHI TIẾT</span>
            </div>

            <div class="skill-desc-content">
              <p class="skill-desc-primary">${formatSkillText(descPrimary)}</p>

              <details class="skill-cn-details">
                <summary class="cn-summary">Xem văn bản gốc (Chinese)</summary>
                <p class="skill-desc-secondary cn-font">${descCn}</p>
              </details>
            </div>
          </div>
        </div>
        ${subFormsHtml}
      </div>
    `;
  }

  function buildSkillsHtml() {
    return skills.map(skill => {
      const curLvlNum = skillLevelState[skill.group_id] || 1;
      const curLevelData = skill.levels.find(l => l.level === curLvlNum) || skill.levels[0] || {};
      
      const iconPath = curLevelData.icon || `/assets/skills/${skill.group_id}.png`;
      const typeLabel = curLevelData.type || "Kỹ Năng";
      const primaryName = curLevelData.name_vi || curLevelData.name_cn || `Kỹ Năng ${skill.group_id}`;
      const secondaryName = curLevelData.name_vi ? (curLevelData.name_cn || "") : "";
      const descPrimary = curLevelData.desc_vi || curLevelData.desc_cn || curLevelData.desc_raw || "";
      const descCn = curLevelData.desc_cn || curLevelData.desc_raw || "";
      const maxLvl = skill.max_level || skill.levels.length;

      const selRange = curLevelData.select_range || "";
      const effRange = curLevelData.effect_range || 0;
      const effType = curLevelData.effect_range_type || "";

      // Check if skill has range
      const hasRangeData = (selRange && selRange !== "0,0" && selRange !== "0") || (effRange && effRange > 0);

      // Level selector buttons HTML
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
        <div class="skill-card-panel" id="skill-card-${skill.group_id}">
          <!-- Skill Header Header -->
          <div class="skill-card-header">
            <div class="skill-icon-wrapper">
              <img src="${iconPath}" 
                   alt="${primaryName}" 
                   class="skill-icon-img"
                   onerror="this.onerror=null; this.src='/assets/items/itemicon_3.png';" />
            </div>
            
            <div class="skill-header-meta">
              <div class="skill-title-row">
                <h3 class="skill-name-vi">${primaryName}</h3>
                <span class="skill-type-badge type-${curLevelData.type_id || 1}">${typeLabel}</span>
              </div>
              
              ${secondaryName ? `<div class="skill-name-cn cn-font">${secondaryName}</div>` : ''}

              ${lvlSelectorHtml}
            </div>
          </div>

          <div class="skill-card-body">
            <!-- Range Section -->
            <div class="skill-section range-section">
              <div class="skill-section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><cross x1="12" y1="8" x2="12" y2="16"></cross></svg>
                <span>PHẠM VI</span>
              </div>
              
              <div class="range-visualizer-container" id="range-container-${skill.group_id}">
                ${renderRangeHtml(selRange, effRange, effType, hasRangeData)}
              </div>
            </div>

            <!-- Description Section -->
            <div class="skill-section desc-section">
              <div class="skill-section-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span>MÔ TẢ CHI TIẾT</span>
              </div>

              <div class="skill-desc-content">
                <p class="skill-desc-primary">${formatSkillText(descPrimary)}</p>

                <details class="skill-cn-details">
                  <summary class="cn-summary">Xem văn bản gốc (Chinese)</summary>
                  <p class="skill-desc-secondary cn-font">${descCn}</p>
                </details>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="skills-page-wrapper">
      <div class="skills-page-header">
        <h2>DANH SÁCH KỸ NĂNG</h2>
        <span class="skills-count-badge">${skills.length} Kỹ năng</span>
      </div>

      <div class="skills-list" id="skills-list-container">
        ${buildSkillsHtml()}
      </div>
    </div>
  `;

  // Attach event listeners for Level Selector buttons
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.lvl-btn');
    if (!btn) return;
    
    const group = btn.dataset.group;
    const level = parseInt(btn.dataset.level, 10);
    if (!group || !level) return;

    skillLevelState[group] = level;
    
    // Re-render skills list container
    const listContainer = document.getElementById('skills-list-container');
    if (listContainer) {
      listContainer.innerHTML = buildSkillsHtml();
    }
  });
}

/**
 * Clean & format skill description text into safe HTML
 */
function formatSkillText(text) {
  if (!text) return "Chưa có mô tả.";
  
  let formatted = text
    .replace(/\[[A-Za-z0-9_]+,\d+\]/g, 'X')
    .replace(/\{Buff_[^}]+\}/g, '')
    .replace(/<color=#([0-9a-fA-F]{6})>(.*?)<\/color>/g, '<span class="highlight-val" style="color: #$1">$2</span>')
    .replace(/\n/g, '<br/>');
    
  return formatted;
}

/**
 * Diagnostic Range HTML Renderer Component (Data-Safe & Conservative)
 */
function renderRangeHtml(selectRangeStr, effectRangeVal, effectRangeType, hasRange) {
  if (!hasRange) {
    return `
      <div class="range-diagnostic-box empty-range">
        <span class="diag-muted">Kỹ năng nội tại / Không có phạm vi kích hoạt mục tiêu.</span>
      </div>
    `;
  }

  const selectRangeDisplay = selectRangeStr || "0,0";
  const effectRangeDisplay = (effectRangeVal !== undefined && effectRangeVal !== "") ? effectRangeVal : 0;
  const effectTypeDisplay = effectRangeType || "Không có";

  return `
    <div class="range-diagnostic-box">
      <div class="range-diag-info">
        <div class="diag-item">
          <span class="diag-lbl">Phạm vi chọn mục tiêu:</span> 
          <span class="diag-val">${selectRangeDisplay}</span>
        </div>
        <div class="diag-item">
          <span class="diag-lbl">Phạm vi hiệu ứng:</span> 
          <span class="diag-val">${effectRangeDisplay}</span>
        </div>
        <div class="diag-item">
          <span class="diag-lbl">Kiểu phạm vi:</span> 
          <span class="diag-val code-font">${effectTypeDisplay}</span>
        </div>
      </div>

      <div class="range-origin-preview">
        <div class="origin-chip">
          <span class="lg-symbol cell-origin">●</span>
          <span class="origin-label">Vị trí bản thân</span>
        </div>
        <span class="range-unverified-note">Thông số phạm vi hiển thị dạng thô (chờ xác minh sơ đồ bản đồ trong game).</span>
      </div>
    </div>
  `;
}
