import { resolveCharacterStats } from '../../../../data/statResolver.js';
import { getGameData } from '../../../../data/loader.js';

const KNOWN_RANGE_ASSETS = new Set([
  "Cross_2_7.png", "Overlap_1.png", "Overlap_2.png", "Overlap_3.png",
  "Overlap_4.png", "RandomType_Overlap_3_2.png", "Rect1_2.png",
  "Rect1_3.png", "Rect1_4.png", "Rect1_5.png", "Rect3_1.png",
  "Rect3_2.png", "Rect3_3.png", "Rect3_4.png", "Rect3_5.png",
  "Rect5_1.png", "Special1_4.png", "SpecialSquareNxN_1.png",
  "Square_1.png", "Square_3.png", "Square_5.png"
]);

function resolveSkillRangeAsset(effType, effRange, selRange) {
  if (!effType) return null;
  const filename = `${effType}_${effRange}.png`;
  if (KNOWN_RANGE_ASSETS.has(filename)) return `/assets/skill-range/${filename}`;
  if (effType === "RandomType_Overlap_3" && effRange === 2) return `/assets/skill-range/RandomType_Overlap_3_2.png`;
  if (effType === "SpecialSquareNxN" && effRange === 1) return `/assets/skill-range/SpecialSquareNxN_1.png`;
  if (effType === "Special1" && effRange === 4) return `/assets/skill-range/Special1_4.png`;
  if (effType === "Cross" && (selRange === "1,2" || effRange === 2)) return `/assets/skill-range/Cross_2_7.png`;
  return null;
}

function resolveCastRangeText(selRange, selType, selRangeType, isPassive) {
  if (isPassive && (!selRange || selRange === "0" || selRange === "0,0")) return "Nội tại";
  if (selRange === "0" || selRange === "0,0") return "Bản thân";
  if (selRange === "0,99" || selRangeType === "FullMap") return "Toàn bản đồ";
  if (selRange) {
    if (selRange.includes(",")) {
      const parts = selRange.split(",").map(p => p.trim());
      if (parts.length === 2) {
        if (parts[0] === parts[1]) return `${parts[0]} ô`;
        return `${parts[0]}–${parts[1]} ô`;
      }
    } else if (!isNaN(selRange)) {
      return `${selRange} ô`;
    }
    return `${selRange} ô`;
  }
  return isPassive ? "Nội tại" : "Tự động";
}

function resolveEffectAreaText(effType, effRange) {
  if (!effType && (!effRange || effRange === 0)) return "";
  if (effType === "Square") return effRange === 1 ? "1 mục tiêu (Đơn thể)" : `Diện rộng ${effRange} × ${effRange} ô`;
  if (effType === "Overlap") return `Xung quanh ${effRange} ô`;
  if (effType === "Rect1") return `Hàng thẳng 1 × ${effRange} ô`;
  if (effType === "Rect3") return `Hàng ngang 3 × ${effRange} ô`;
  if (effType === "Rect5") return `Hàng ngang 5 × ${effRange} ô`;
  if (effType === "FullMap" || effRange === 99) return "Toàn bản đồ";
  if (effType === "DashLine") return `Đường lướt ${effRange} ô`;
  if (effType === "PierceLine") return `Hàng thẳng xuyên thấu ${effRange} ô`;
  if (effType === "Cross") return `Chữ thập`;

  const knownInternalTypes = [
    "BossDitu1", "BossDitu2", "BossDituEx1", "BossDituEx2", "BossDituEx3",
    "FaceDir2Strip", "FaceDir3Strip", "Overlap_1_Not_Square_1", "Overlap_2_Not_Square_1",
    "R3NF2", "R3NF3", "Random2WithSquare3", "Random3WithCross1", "Random3WithOverlap2",
    "RandomCellEmpty", "RandomCellEnemy", "SelectAllMarkCells", "SpecialSquare", "TileGroup",
    "SpecialSquareNxN", "RandomType_Overlap_3", "Special1"
  ];
  if (knownInternalTypes.includes(effType)) return `Đặc biệt (${effRange > 0 ? effRange + ' ô' : 'Phạm vi'})`;
  if (effType && effRange) return `Đặc biệt ${effRange}`;
  return "";
}

// ==================================================
// NESTED TOOLTIP SYSTEM
// ==================================================

let tooltipTimer = null;
const tooltipStack = [];
let popupScopes = new Map();
let tooltipEventsAttached = false;
let popupScopeSequence = 0;

function getOrCreateTooltipEl(depth) {
  let el = document.getElementById(`mech-tooltip-${depth}`);
  if (!el) {
    el = document.createElement('div');
    el.id = `mech-tooltip-${depth}`;
    el.className = 'mechanic-tooltip-global';
    
    el.addEventListener('mouseenter', cancelClose);
    el.addEventListener('mouseleave', () => scheduleClose(depth));
    
    document.body.appendChild(el);
  }
  return el;
}

function scheduleClose(fromDepth = 0) {
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    while (tooltipStack.length > fromDepth) {
      const top = tooltipStack.pop();
      if (top.el) top.el.classList.remove('show');
    }
  }, 150);
}

function cancelClose() {
  clearTimeout(tooltipTimer);
}

function closeAllTooltips() {
  scheduleClose(0);
}

function openTooltip(keywordEl, depth) {
  cancelClose();
  
  // The active-ID guard below handles cycles. Keep this only as a generous
  // last-resort protection for malformed source graphs, not a normal path cap.
  if (depth > 8) {
    console.warn('POPUP_DEPTH_GUARD', { depth, buffId: keywordEl?.dataset?.buffId });
    return;
  }
  
  while (tooltipStack.length > depth) {
    const top = tooltipStack.pop();
    if (top.el) top.el.classList.remove('show');
  }
  
  // Cycle protection
  const scopeId = keywordEl.dataset.popupScope;
  const buffId = keywordEl.dataset.buffId;
  const scope = popupScopes.get(scopeId);
  if (!scope?.allowedBuffIds?.has(buffId)) return;
  // The registry is title/template authority only. Card-local binding provides
  // every player-facing body and exact parameter context.
  const canonical = scope.buffRegistry?.[buffId];
  const bindingKey = keywordEl.dataset.popupBinding;
  const binding = scope.bindings?.[bindingKey];
  if (!binding) {
    console.error('POPUP_RESOLUTION_TRACE', {
      runtimeVerdict: 'BINDING_LOOKUP_FAILED', scopeId, buffId, bindingKey,
      clickedTerm: keywordEl.textContent,
    });
    return;
  }
  const isMultiVariant = binding.kind === 'MULTI_VARIANT_CONTROLLER';
  const mech = isMultiVariant
    ? binding
    : canonical && { ...canonical, desc_cn: binding.desc_cn, desc_vi: binding.desc_vi };
  if (!mech || tooltipStack.some(t => t.id === `${scopeId}:${buffId}`)) return;

  const tt = getOrCreateTooltipEl(depth);
  
  let rootKeywordEl = keywordEl;
  if (depth > 0 && tooltipStack.length > 0) {
    rootKeywordEl = tooltipStack[0].keywordEl;
  }
  
  const unresolvedParamRe = /\[(?:EffectParam|EffectPara|BuffParam|Effect[1-5]Para|Condition[1-5]Para)(?:,[^\]]*)?\]|(?<![A-Za-z0-9_])#\d+\b/;
  const mechName = (mech.name_vi || keywordEl.dataset.popupAlias || mech.name_cn || "").replace(/<[^>]*>/g, '').trim();
  const bindingHasPlaceholder = !isMultiVariant && unresolvedParamRe.test(`${binding.desc_vi || ''}${binding.desc_cn || ''}`);
  const runtimeVerdict = bindingHasPlaceholder
    ? 'BINDING_FOUND_BUT_UNRESOLVED'
    : binding.desc_vi
      ? 'BINDING_FOUND_RESOLVED_VI'
      : binding.canonical_vi_missing
        ? 'CANONICAL_VI_TEMPLATE_MISSING'
        : 'BINDING_FOUND_RESOLVED_CN_ONLY';
  if (runtimeVerdict === 'BINDING_FOUND_RESOLVED_CN_ONLY') {
    throw new Error(`BINDING_FOUND_RESOLVED_CN_ONLY: ${JSON.stringify({ scopeId, buffId, bindingKey })}`);
  }
  const mechDesc = binding.desc_vi || (binding.canonical_vi_missing ? binding.desc_cn : "");
  const finalBodySource = binding.desc_vi ? 'binding.desc_vi' : 'binding.desc_cn:canonical_vi_missing';
  if (!isMultiVariant && unresolvedParamRe.test(mechDesc)) {
    throw new Error(`UNRESOLVED_EFFECT_PARAM: ${JSON.stringify({ scopeId, buffId, bindingKey, finalBodySource, mechDesc })}`);
  }
  let descHtml;
  if (isMultiVariant) {
    const variants = binding.variant_children || [];
    if (variants.length < 2) {
      throw new Error(`INVALID_MULTI_VARIANT_BINDING: ${JSON.stringify({ scopeId, buffId, bindingKey })}`);
    }
    descHtml = variants.map(variant => {
      const child = scope.bindings?.[variant.binding_key];
      const childBody = child?.desc_vi || (child?.canonical_vi_missing ? child?.desc_cn : "");
      if (!child || !childBody || unresolvedParamRe.test(childBody)) {
        throw new Error(`UNRESOLVED_MULTI_VARIANT_CHILD: ${JSON.stringify({ scopeId, bindingKey, variant })}`);
      }
      const childName = (variant.name_vi || variant.name_cn || child.name_vi || child.name_cn || "").replace(/<[^>]*>/g, "");
      return `<div class="mech-tt-variant"><div class="mech-tt-variant-title">${childName}</div><div class="mech-tt-variant-desc">${renderRichGameText(childBody, scope, depth + 1, scopeId, variant.buff_id)}</div></div>`;
    }).join("");
  } else {
    descHtml = renderRichGameText(mechDesc, scope, depth + 1, scopeId, buffId);
  }
  if (new URLSearchParams(window.location.search).has('debugPopup')) {
    console.debug('POPUP_RESOLUTION_TRACE', {
      runtimeVerdict,
      clickedTerm: keywordEl.textContent,
      buffId,
      bindingKey,
      parentBuffId: tooltipStack[depth - 1]?.id || null,
      sourceCardId: scopeId,
      binding,
      bindingDescCn: binding.desc_cn,
      bindingDescVi: binding.desc_vi,
      registryDescCn: canonical?.desc_cn,
      registryDescVi: canonical?.desc_vi,
      finalBody: isMultiVariant ? binding.variant_children : mechDesc,
      finalBodySource,
    });
  }
  
  tt.innerHTML = `<div class="mech-tt-title">${mechName}</div><div class="mech-tt-desc">${descHtml}</div>`;
  tt.classList.add('show');
  
  tooltipStack.push({ id: `${scopeId}:${buffId}`, el: tt, keywordEl });
  
  // Position
  const rect = keywordEl.getBoundingClientRect();
  const ttRect = tt.getBoundingClientRect();
  const pad = 12;
  
  let left, top;
  
  if (depth === 0) {
    top = rect.top - ttRect.height - 8;
    left = rect.left + (rect.width / 2) - (ttRect.width / 2);
    if (top < pad) {
      top = rect.bottom + 8;
    }
  } else {
    const parentEl = tooltipStack[depth - 1].el;
    const parentRect = parentEl.getBoundingClientRect();
    top = rect.top;
    left = parentRect.right + 8;
    if (left + ttRect.width > window.innerWidth - pad) {
      left = parentRect.left - ttRect.width - 8;
    }
  }
  
  left = Math.max(pad, Math.min(left, window.innerWidth - ttRect.width - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - ttRect.height - pad));
  
  tt.style.left = `${left}px`;
  tt.style.top = `${top}px`;
}

function initTooltipEvents() {
  if (tooltipEventsAttached) return;
  tooltipEventsAttached = true;
  
  document.addEventListener('mouseover', (e) => {
    const keyword = e.target.closest('.mechanic-keyword');
    if (keyword) {
      const depth = parseInt(keyword.dataset.depth || "0", 10);
      openTooltip(keyword, depth);
    }
  });
  
  document.addEventListener('mouseout', (e) => {
    const keyword = e.target.closest('.mechanic-keyword');
    if (keyword && !e.relatedTarget?.closest?.('.mechanic-keyword')) {
      const depth = parseInt(keyword.dataset.depth || "0", 10);
      scheduleClose(depth);
    }
  });
  
  document.addEventListener('focusin', (e) => {
    const keyword = e.target.closest('.mechanic-keyword');
    if (keyword) {
      const depth = parseInt(keyword.dataset.depth || "0", 10);
      openTooltip(keyword, depth);
    }
  });
  
  document.addEventListener('focusout', (e) => {
    const keyword = e.target.closest('.mechanic-keyword');
    if (keyword) {
      const depth = parseInt(keyword.dataset.depth || "0", 10);
      scheduleClose(depth);
    }
  });
  
  document.addEventListener('click', (e) => {
    const keyword = e.target.closest('.mechanic-keyword');
    if (keyword) {
      const depth = parseInt(keyword.dataset.depth || "0", 10);
      openTooltip(keyword, depth);
      return;
    }
    
    if (!e.target.closest('.mechanic-tooltip-global')) {
      closeAllTooltips();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllTooltips();
  });
  
  document.addEventListener('scroll', () => {
    closeAllTooltips();
  }, { capture: true, passive: true });
}

function createPopupScope(mechanics) {
  const gameData = getGameData() || {};
  const allowedBuffIds = new Set(
    (mechanics || []).map(mech => mech?.key).filter(Boolean)
  );
  return {
    mechanics: mechanics || [],
    allowedBuffIds,
    bindings: Object.fromEntries((mechanics || []).filter(mech => mech?.key).map(mech => [mech.key, mech])),
    buffRegistry: gameData.buff_registry || {}
  };
}

function deriveCardLocalAlias(mech, term) {
  if (term.name_vi || !mech?.desc_cn || !mech?.desc_vi) return term.name_vi || "";
  const colouredTerms = text => [...text.matchAll(/<color=[^>]+>(.*?)<\/color>/gi)]
    .map(match => match[1].replace(/<[^>]*>/g, '').trim());
  const cnTerms = colouredTerms(mech.desc_cn);
  const viTerms = colouredTerms(mech.desc_vi);
  if (cnTerms.length !== viTerms.length) return "";
  const aliases = viTerms.filter((value, index) => cnTerms[index] === term.name_cn && value);
  return aliases.length && new Set(aliases).size === 1 ? aliases[0] : "";
}

function renderRichGameText(text, scope, contextDepth = 0, popupScope = "", parentBuffId = null) {
  if (!text) return "Chưa có mô tả.";

  const cleanRichTerm = value => String(value || '').replace(/<[^>]*>/g, '').trim();
  // A source may colour a longer gameplay phrase while only a shorter child
  // status has a binding. Preserve the whole phrase as ordinary text unless
  // the raw export supplied an exact binding for that phrase.
  const colouredSourceTerms = [...String(text).matchAll(/<color=[^>]+>(.*?)<\/color>/gi)]
    .map(match => cleanRichTerm(match[1]))
    .filter(Boolean);
  let formatted = text
    .replace(/<color=#([0-9a-fA-F]{6})>(.*?)<\/color>/gi, '<span class="highlight-val" style="color: #$1">$2</span>')
    .replace(/\n/g, '<br/>');

  if (scope?.mechanics?.length) {
    const targets = [];
    // At the root, only direct card terms are eligible.  Inside a popup, only
    // that popup's own deterministic child terms are eligible.  Never scan the
    // rest of the card or match against a global name index.
    const sourceMechanics = parentBuffId
      ? scope.mechanics.filter(mech => mech?.key === parentBuffId)
      : scope.mechanics.filter(mech => mech?.is_direct_popup_target);
    sourceMechanics.forEach(mech => {
      // Popup eligibility is exported from the raw buff relation.  Do not turn a
      // coloured word into a popup merely because it happens to match a buff name.
      const popupTerms = Array.isArray(mech.popup_terms) ? mech.popup_terms : [];
      popupTerms.forEach(term => {
        const nameVi = (term.name_vi || deriveCardLocalAlias(mech, term) || "").replace(/<[^>]*>/g, '').trim();
        const nameCn = (term.name_cn || "").replace(/<[^>]*>/g, '').trim();
        const buffId = term.buff_id;
        const bindingKey = term.binding_key;
        if (!buffId || !bindingKey || !scope.bindings?.[bindingKey]) return;
        // The current popup already is this exact buff.  Leave its visible text
        // ordinary rather than rendering a dead-looking nested trigger.
        if (parentBuffId && (buffId === parentBuffId || tooltipStack.some(entry => entry.id === `${popupScope}:${buffId}`))) return;
        if (nameVi) targets.push({ name: nameVi, buffId, bindingKey });
        if (nameCn && nameCn !== nameVi) targets.push({ name: nameCn, buffId, bindingKey });
      });
    });

    targets.sort((a, b) => b.name.length - a.name.length);

    // Protect coloured phrases such as "Triện Phóng Lĩnh Vực" from matching a
    // shorter eligible term such as "Triện Phóng". This is data-driven: the
    // condition applies to any longer coloured phrase without its own exact
    // exported popup binding, rather than any character-specific alias.
    const exactTargetNames = new Set(targets.map(target => target.name));
    const protectedTerms = [...new Set(colouredSourceTerms.filter(sourceTerm =>
      !exactTargetNames.has(sourceTerm) && targets.some(target => sourceTerm.includes(target.name))
    ))];
    protectedTerms.forEach((term, idx) => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const termRe = new RegExp(`(<span[^>]*>)(${escapedTerm})(<\\/span>)`, 'g');
      formatted = formatted.replace(termRe, `$1%%PROTECTED_TERM_${idx}%%$3`);
    });

    targets.forEach((target, idx) => {
      const parts = formatted.split(/(<[^>]*>)/g);
      for (let i = 0; i < parts.length; i++) {
        if (!parts[i].startsWith('<')) {
          const escapedName = target.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(${escapedName})`, 'g');
          parts[i] = parts[i].replace(regex, `%%MECH_${idx}%%`);
        }
      }
      formatted = parts.join('');
    });

    targets.forEach((target, idx) => {
      const html = `<span class="mechanic-keyword status-keyword" tabindex="0" data-popup-scope="${popupScope}" data-buff-id="${target.buffId}" data-popup-binding="${target.bindingKey}" data-popup-alias="${target.name}" data-depth="${contextDepth}">${target.name}</span>`;
      formatted = formatted.split(`%%MECH_${idx}%%`).join(html);
    });
    protectedTerms.forEach((term, idx) => {
      formatted = formatted.split(`%%PROTECTED_TERM_${idx}%%`).join(term);
    });
  }

  // Final safety strip of any residual raw buff markers
  formatted = formatted.replace(/\{Buff_[^}]+\}/g, '');

  // Wrap trailing punctuation attached to interactive terms to prevent orphan punctuation lines
  formatted = formatted.replace(/(<span class="mechanic-keyword"[^>]*>[^<]*<\/span>(?:<\/[a-z0-9]+>)*)([。，、；：！？.,;:!?]+)/gi, '<span class="term-punct-group">$1$2</span>');

  return formatted;
}

// ==================================================
// RENDER COMPONENT
// ==================================================

export function renderInfoTab(container, char) {
  initTooltipEvents();
  
  const skills = char.skills || [];
  let currentStatsLevel = 120;

  function formatNum(val) {
    if (val === undefined || val === null) return '';
    return val.toLocaleString('vi-VN');
  }

  function buildStatsHtml() {
    const resolved = resolveCharacterStats(char, currentStatsLevel);
    if (!resolved) {
      return `
        <div class="info-section-header">
          <h3>Chỉ Số Chiến Đấu</h3>
        </div>
        <p class="empty-sub-state-text">Chưa có dữ liệu chỉ số chiến đấu cho nhân vật này.</p>
      `;
    }

    const formatStatCard = (label, statObj, unit = '', highlightClass = '') => {
      if (!statObj || statObj.base === null || statObj.base === undefined) return '';
      const baseStr = formatNum(statObj.base);
      const tgtStr = statObj.target !== null && statObj.target !== undefined ? formatNum(statObj.target) : null;
      
      const valHtml = tgtStr !== null && tgtStr !== baseStr
        ? `${baseStr} → ${tgtStr}${unit ? ' ' + unit : ''}`
        : `${baseStr}${unit ? ' ' + unit : ''}`;

      return `
        <div class="stat-card">
          <span class="stat-lbl">${label}</span>
          <span class="stat-val ${highlightClass}">${valHtml}</span>
        </div>
      `;
    };

    const hpCard = formatStatCard('Sinh Mệnh (HP)', resolved.hp, '', 'highlight-hp');
    const atkCard = formatStatCard('Tấn Công (ATK)', resolved.atk, '', 'highlight-atk');
    const pdefCard = formatStatCard('Phòng Ngự Vật Lý', resolved.defPhysic, '');
    const mdefCard = formatStatCard('Phòng Ngự Cấu Thuật', resolved.defMagic, '');
    
    const spdCard = resolved.speed !== null && resolved.speed !== undefined ? `
      <div class="stat-card">
        <span class="stat-lbl">Tốc Độ (SPD)</span>
        <span class="stat-val">${formatNum(resolved.speed)}</span>
      </div>
    ` : '';
    const movCard = resolved.mov !== null && resolved.mov !== undefined ? `
      <div class="stat-card">
        <span class="stat-lbl">Di Chuyển (MOV)</span>
        <span class="stat-val">${formatNum(resolved.mov)} ô</span>
      </div>
    ` : '';
    const critCard = resolved.crit !== null && resolved.crit !== undefined ? `
      <div class="stat-card">
        <span class="stat-lbl">Tỷ Lệ Bạo Kích</span>
        <span class="stat-val">${resolved.crit}%</span>
      </div>
    ` : '';
    const critDmgCard = resolved.critDmg !== null && resolved.critDmg !== undefined ? `
      <div class="stat-card">
        <span class="stat-lbl">Sát Thương Bạo Kích</span>
        <span class="stat-val">${resolved.critDmg}%</span>
      </div>
    ` : '';

    const levelBadgeText = currentStatsLevel === 120 ? 'Lv.1 → Lv.120 (Tối đa)' : 'Lv.1 → Lv.100';

    return `
      <div class="info-section-header">
        <h3>Chỉ Số Chiến Đấu</h3>
        <div class="stats-header-actions">
          <span class="stats-level-badge">${levelBadgeText}</span>
          <div class="stats-lvl-toggle">
            <button type="button" class="stat-toggle-btn ${currentStatsLevel === 100 ? 'active' : ''}" data-targetlvl="100">Lv.100</button>
            <button type="button" class="stat-toggle-btn ${currentStatsLevel === 120 ? 'active' : ''}" data-targetlvl="120">Lv.120</button>
          </div>
        </div>
      </div>
      <div class="stats-grid">
        ${hpCard}${atkCard}${pdefCard}${mdefCard}
        ${spdCard}${movCard}${critCard}${critDmgCard}
      </div>
    `;
  }

  function renderSkillEntry(skill, isSubEntry = false, subLabel = "") {
    const curLevelData = skill.levels[0] || {};
    const mechs = curLevelData.mechanics || [];
    const popupScope = `card-${++popupScopeSequence}`;
    popupScopes.set(popupScope, createPopupScope(mechs));

    const iconPath = curLevelData.icon ? `/${curLevelData.icon}` : "";
    const nameVi = String(curLevelData.name_vi ?? "").trim();
    const nameCn = String(curLevelData.name_cn ?? "").trim();
    
    const primaryName = nameVi || nameCn || "Kỹ Năng";
    const secondaryName = nameVi ? nameCn : "";
    const descPrimary = curLevelData.desc_vi || curLevelData.desc_cn || curLevelData.desc_raw || "";
    const descCn = curLevelData.desc_cn || curLevelData.desc_raw || "";
    const typeId = curLevelData.type_id || 1;
    const showTypeBadge = true;
    const typeLabel = curLevelData.type || "";
    const selRange = curLevelData.select_range || "";
    const selType = curLevelData.select_type || "";
    const selRangeType = curLevelData.select_range_type || "";
    const effRange = curLevelData.effect_range || 0;
    const effType = curLevelData.effect_range_type || "";
    const isPassive = [4, 5, 6, 11].includes(typeId);
    const cooldown = curLevelData.cooldown_rounds || 0;
    const costEnergy = curLevelData.cost_energy || 0;
    const recoverEnergy = curLevelData.recover_energy || 0;

    let metaItemsHtml = "";
    if (cooldown > 0) metaItemsHtml += `<span class="skill-meta-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Hồi chiêu: <strong>${cooldown} lượt</strong></span>`;
    if (costEnergy > 0) metaItemsHtml += `<span class="skill-meta-pill cost"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Tiêu hao: <strong>${costEnergy} VP</strong></span>`;
    if (recoverEnergy > 0) metaItemsHtml += `<span class="skill-meta-pill recover"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg> Hồi VP: <strong>${recoverEnergy}</strong></span>`;

    const rangeImgUrl = resolveSkillRangeAsset(effType, effRange, selRange);
    const castRangeText = resolveCastRangeText(selRange, selType, selRangeType, isPassive);
    const effectText = resolveEffectAreaText(effType, effRange);
    const showRangeSection = rangeImgUrl || effectText || (castRangeText && castRangeText !== "Nội tại");

    let subFormsHtml = "";
    if (!isSubEntry) {
      if (skill.summon_skills && skill.summon_skills.length > 0) {
        subFormsHtml += '<div class="sub-skills-container summon">' + skill.summon_skills.map(s => renderSkillEntry(s, true, "Triệu hồi")).join('') + '</div>';
      }
    }

    return `
      <div class="skill-entry-card ${isSubEntry ? 'sub-entry' : ''}">
        <div class="skill-entry-header">
          <div class="skill-icon-wrapper">
            ${iconPath ? `<img src="${iconPath}" alt="${primaryName}" class="skill-icon-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><div class="skill-icon-fallback" style="display:none;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div>` : `<div class="skill-icon-fallback"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div>`}
          </div>
          <div class="skill-header-meta">
            <div class="skill-title-row">
              ${isSubEntry && subLabel ? `<span class="sub-entry-label">${subLabel}</span>` : ''}
              <h4 class="skill-name-vi">${primaryName}</h4>
              ${showTypeBadge ? `<span class="skill-type-badge type-${typeId}">${typeLabel}</span>` : ''}
            </div>
            ${secondaryName ? `<div class="skill-name-cn cn-font">${secondaryName}</div>` : ''}
          </div>
        </div>
        <div class="skill-entry-body">
          <div class="skill-desc-block">
            <p class="skill-desc-primary">${renderRichGameText(descPrimary, popupScopes.get(popupScope), 0, popupScope)}</p>
            <details class="skill-cn-details">
              <summary class="cn-summary">Xem văn bản gốc (Chinese)</summary>
              <p class="skill-desc-secondary cn-font">${descCn}</p>
            </details>
          </div>
          ${metaItemsHtml ? `<div class="skill-meta-bar">${metaItemsHtml}</div>` : ''}
          ${showRangeSection ? `
          <div class="skill-range-section">
            <div class="range-header-lbl">PHẠM VI</div>
            <div class="range-body">
              <div class="range-info-col">
                ${castRangeText ? `<div class="range-metric"><span class="range-metric-lbl">Tầm thi triển:</span><span class="range-metric-val">${castRangeText}</span></div>` : ''}
                ${effectText ? `<div class="range-metric"><span class="range-metric-lbl">Hiệu ứng:</span><span class="range-metric-val">${effectText}</span></div>` : ''}
              </div>
              ${rangeImgUrl ? `<div class="range-preview-col"><img src="${rangeImgUrl}" alt="Phạm vi kỹ năng" class="range-preview-img" loading="lazy" /></div>` : ''}
            </div>
          </div>
          ` : ''}
        </div>
        ${subFormsHtml}
      </div>
    `;
  }

  function buildSkillsListHtml() {
    closeAllTooltips();
    popupScopes.clear();
    popupScopeSequence = 0;
    
    if (skills.length === 0) {
      return `<p class="empty-sub-state-text">Chưa có thông tin kỹ năng cho nhân vật này.</p>`;
    }

    return skills.map(skill => renderSkillEntry(skill)).join('');
  }

  function buildZhizhiHtml() {
    const zhizhi = char.zhizhi || [];
    if (zhizhi.length === 0) {
      return `<p class="empty-sub-state-text">Nhân vật này chưa có dữ liệu Trí Tri.</p>`;
    }

    const rowsHtml = zhizhi.map(row => {
      const star = row.star;
      const numImgUrl = `/assets/zhizhi/ui_zz_txt_0${star}.png`;
      const isSkillUp = row.type === 'skill_upgrade' && row.skill_upgrade;

      let contentHtml = '';

      if (isSkillUp) {
        const baseSkill = row.skill_upgrade.base_skill || {};
        const enhancedSkill = row.skill_upgrade.enhanced_skill || {};
        const badgeText = row.skill_upgrade.upgrade_badge_vi || 'CƯỜNG HÓA KỸ NÂNG';
        
        const nameVi = enhancedSkill.name_vi || baseSkill.name_vi || enhancedSkill.name_cn || baseSkill.name_cn || 'Kỹ Năng';
        const nameCn = (enhancedSkill.name_vi || baseSkill.name_vi) ? (enhancedSkill.name_cn || baseSkill.name_cn || '') : '';
        const iconPath = enhancedSkill.icon ? `/${enhancedSkill.icon}` : (baseSkill.icon ? `/${baseSkill.icon}` : '');
        const descPrimary = enhancedSkill.desc_vi || enhancedSkill.desc_cn || '';
        const mechs = enhancedSkill.mechanics || [];
        const popupScope = `card-${++popupScopeSequence}`;
    popupScopes.set(popupScope, createPopupScope(mechs));

        contentHtml = `
          <div class="zhizhi-skill-block">
            <div class="zhizhi-skill-header">
              <div class="skill-icon-wrapper mini">
                ${iconPath ? `<img src="${iconPath}" alt="${nameVi}" class="skill-icon-img" onerror="this.style.display='none';" />` : ''}
              </div>
              <div class="zhizhi-skill-title-box">
                <div class="zhizhi-skill-name-row">
                  <span class="zhizhi-skill-name-vi">${nameVi}</span>
                  <span class="zhizhi-skill-tag">[${badgeText}]</span>
                </div>
                ${nameCn ? `<div class="zhizhi-skill-name-cn cn-font">${nameCn}</div>` : ''}
              </div>
            </div>
            <div class="zhizhi-skill-desc">
              ${renderRichGameText(descPrimary, popupScopes.get(popupScope), 0, popupScope)}
            </div>
          </div>
        `;
      } else {
        const bonuses = row.bonuses || [];
        contentHtml = `
          <div class="zhizhi-stat-list">
            ${bonuses.map(b => `
              <div class="zhizhi-stat-item">
                <span class="zhizhi-stat-name">${b.label_vi}</span>
                <span class="zhizhi-stat-val">${b.val_formatted}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      return `
        <div class="zhizhi-row ${isSkillUp ? 'skill-up-row' : ''}">
          <div class="zhizhi-num-col">
            <img src="${numImgUrl}" alt="Trí Tri ${star}" class="zhizhi-num-img" />
          </div>
          <div class="zhizhi-content-col">
            ${contentHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="zhizhi-table">
        ${rowsHtml}
      </div>
    `;
  }

  function buildHuanzhangPanelHtml() {
    closeAllTooltips();
    popupScopes.clear();
    popupScopeSequence = 0;

    const bInfo = char.brilliant_info;
    const bSkills = char.brilliant_skills || [];

    if (!bInfo && bSkills.length === 0) {
      return `<p class="empty-sub-state-text">Nhân vật này chưa có dữ liệu Hoán Chương.</p>`;
    }

    const hzTitle = (bInfo && (bInfo.name_vi || bInfo.name_cn)) || (bSkills[0]?.levels[0]?.name_vi) || (bSkills[0]?.levels[0]?.name_cn) || "Hoán Chương";
    const iconUrl = bInfo?.icon ? `/${bInfo.icon}` : null;
    const propRows = bInfo?.property_up || [];
    const buffShowPrimary = bInfo?.buff_show_vi || bInfo?.buff_show_cn || "";
    const infoStoryPrimary = bInfo?.info_vi || bInfo?.info_cn || "";

    // Build property table HTML
    let propTableHtml = "";
    if (propRows.length > 0) {
      const rowsHtml = propRows.map(row => `
        <tr class="hz-prop-row">
          <td class="hz-prop-label">${row.label_vi}</td>
          <td class="hz-prop-values-cell">
            ${row.values.map((v, i) => `<span class="hz-stage-val s-${i + 1}">${v}</span>`).join(' <span class="hz-stage-arrow">→</span> ')}
          </td>
        </tr>
      `).join('');

      propTableHtml = `
        <div class="hz-prop-block">
          <div class="hz-block-sub-title">TĂNG CƯỜNG THUỘC TÍNH</div>
          <table class="hz-prop-table">
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }

    // Build compact Hoán Chương materials HTML
    const gameData = getGameData();
    const itemsDb = gameData?.items || {};
    const matIds = bInfo?.materials || [];

    let matsHtml = "";
    if (matIds.length > 0) {
      const itemChips = matIds.map(mId => {
        const itemObj = itemsDb[mId] || {};
        const itemName = itemObj.name_vi || itemObj.name_cn || `Vật liệu ${mId}`;
        const itemIcon = itemObj.icon ? `/${itemObj.icon}` : `/assets/items/itemicon_${mId}.png`;
        return `
          <div class="hz-mat-chip" title="${itemName}">
            <img src="${itemIcon}" alt="${itemName}" class="hz-mat-icon" onerror="this.style.display='none';" />
            <span class="hz-mat-name">${itemName}</span>
          </div>
        `;
      }).join('');

      matsHtml = `
        <div class="hz-mats-block">
          <div class="hz-mats-title">NGUYÊN LIỆU HOÁN CHƯƠNG</div>
          <div class="hz-mats-list">
            ${itemChips}
          </div>
        </div>
      `;
    }

    // Large Artwork Top Hero HTML
    let visualHeroHtml = "";
    if (iconUrl) {
      visualHeroHtml = `
        <div class="hz-artwork-hero">
          <div class="hz-artwork-frame">
            <img src="${iconUrl}" alt="${hzTitle}" class="hz-artwork-img" onerror="this.parentElement.style.display='none';" />
          </div>
        </div>
      `;
    }

    // A linked gameplay card owns the visual surface.  build_web_data may supply
    // a proven HUANZHANG BuffShow translation as that card's fallback, preserving
    // the SKILL's card title, original text, mechanics, and scoped popups.
    const buffShowHtml = bSkills.length === 0 && buffShowPrimary
      ? `<p class="skill-desc-primary">${renderRichGameText(buffShowPrimary, [], 0)}</p>`
      : "";
    const skillsContentHtml = bSkills.length > 0
      ? bSkills.map(skill => renderSkillEntry(skill)).join('')
      : (!buffShowHtml ? `<p class="empty-sub-state-text">Không có chi tiết kỹ năng Hoán Chương.</p>` : "");

    // Top Area: 35% Property Table + 65% Effect / Skill Section
    const infoGridHtml = `
      <div class="hz-info-grid ${!propTableHtml ? 'no-prop' : ''}">
        <div class="hz-prop-col">
          ${propTableHtml}
        </div>
        <div class="hz-effects-col">
          <div class="hz-sub-header">
            <h4>HIỆU ỨNG / KỸ NĂNG HOÁN CHƯƠNG</h4>
          </div>
          <div class="hz-effects-body">
            ${buffShowHtml}
            ${skillsContentHtml}
          </div>
        </div>
      </div>
    `;

    // Lore / Background story block if available
    let storyHtml = "";
    if (infoStoryPrimary) {
      storyHtml = `
        <details class="hz-story-details">
          <summary class="hz-story-summary">
            <span class="hz-story-title">Xem điển cố / cốt truyện Hoán Chương</span>
            <svg class="hz-story-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </summary>
          <div class="hz-story-content">
            <p class="skill-desc-secondary">${renderRichGameText(infoStoryPrimary, [], 0)}</p>
          </div>
        </details>
      `;
    }

    return `
      <div class="hz-panel-container">
        <!-- 1. Top Title Bar -->
        <div class="hz-title-bar">
          <h4 class="hz-title-text">${hzTitle}</h4>
        </div>

        <!-- 2. Large Hoán Chương Artwork Centered Above -->
        ${visualHeroHtml}

        <!-- 3. Information Row: 35% Attribute Upgrades | 65% Effect / Skill -->
        ${infoGridHtml}

        <!-- 4. Deduplicated Hoán Chương Upgrade Materials -->
        ${matsHtml}

        <!-- 5. Story / Lore Disclosure Below -->
        ${storyHtml}
      </div>
    `;
  }

  function buildCombinedSkillsAndZhizhiHtml() {
    const skillsHtml = buildSkillsListHtml();
    const zhizhiHtml = buildZhizhiHtml();

    return `
      <div class="skills-entries-list" id="info-skills-list">
        ${skillsHtml}
      </div>

      <div class="info-sub-section zhizhi-sub-section">
        <div class="info-section-header">
          <h3>Trí Tri</h3>
        </div>
        ${zhizhiHtml}
      </div>
    `;
  }

  let currentInfoMode = 'skills'; // 'skills' | 'huanzhang'

  const sectionTitles = {
    skills: 'Thông Tin Kỹ Năng',
    huanzhang: 'Thông Tin Hoán Chương'
  };

  function renderModeContent() {
    if (currentInfoMode === 'huanzhang') {
      return buildHuanzhangPanelHtml();
    }
    return buildCombinedSkillsAndZhizhiHtml();
  }

  function renderFullView() {
    container.innerHTML = `
      <div class="char-info-wrapper">
        <section class="info-stats-section" id="info-stats-container">${buildStatsHtml()}</section>
        
        <!-- Local Sub-Mode Switch (Kỹ Năng / Hoán Chương) - Text Only, No Icons -->
        <div class="info-mode-switch-wrapper">
          <div class="info-mode-switch" role="tablist" aria-label="Nội dung thông tin nhân vật">
            <button type="button" class="info-mode-btn ${currentInfoMode === 'skills' ? 'active' : ''}" data-mode="skills">
              <span>Kỹ Năng</span>
            </button>
            <button type="button" class="info-mode-btn ${currentInfoMode === 'huanzhang' ? 'active' : ''}" data-mode="huanzhang">
              <span>Hoán Chương</span>
            </button>
          </div>
        </div>

        <!-- Dynamic Content Section -->
        <section class="info-dynamic-section">
          <div class="info-section-header">
            <h3 id="info-mode-section-title">${sectionTitles[currentInfoMode]}</h3>
          </div>
          <div id="info-mode-body">
            ${renderModeContent()}
          </div>
        </section>
      </div>
    `;
  }

  renderFullView();

  // Local click events for stat toggle & mode switch
  container.addEventListener('click', (e) => {
    const statBtn = e.target.closest('.stat-toggle-btn');
    if (statBtn) {
      const tgtLvl = parseInt(statBtn.dataset.targetlvl, 10);
      if (tgtLvl && tgtLvl !== currentStatsLevel) {
        currentStatsLevel = tgtLvl;
        const statsContainer = document.getElementById('info-stats-container');
        if (statsContainer) statsContainer.innerHTML = buildStatsHtml();
      }
      return;
    }

    const modeBtn = e.target.closest('.info-mode-btn');
    if (modeBtn) {
      const newMode = modeBtn.dataset.mode;
      if (newMode && newMode !== currentInfoMode && sectionTitles[newMode]) {
        currentInfoMode = newMode;
        
        // Update active class on buttons
        container.querySelectorAll('.info-mode-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === currentInfoMode);
        });

        // Update section title
        const titleEl = document.getElementById('info-mode-section-title');
        if (titleEl) titleEl.textContent = sectionTitles[currentInfoMode];

        // Update mode content body
        const bodyEl = document.getElementById('info-mode-body');
        if (bodyEl) bodyEl.innerHTML = renderModeContent();
      }
    }
  });
}
