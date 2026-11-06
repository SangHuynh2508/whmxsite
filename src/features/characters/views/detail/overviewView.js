/**
 * Overview Sub-View Component (/characters/:slug)
 * Profile & Identity Information ONLY (Compact Overview)
 */
import { getCharacterCardUrl } from '../../../assets/assetPaths.js';
import { escapeHtml } from '../../../../lib/escapeHtml.mts';
import { jobName as jobLabel, RARITY_LABELS } from '../../../../ui/utils/gameLabels.mts';
import { getLang, txt } from '../../../../i18n/lang.mts';
import { s } from '../../../../i18n/strings.mts';
import { ticketHtml } from '../../catalogCard.mts';

export function renderOverviewTab(container, char) {

  const rarityLabel = RARITY_LABELS[char.rare] || `★${char.rare}`;
  const rarityInfo = { label: rarityLabel, class: RARITY_LABELS[char.rare] ? rarityLabel.toLowerCase() : "sr" };
  const jobName = jobLabel(char.job) || s('ovUnknown');
  const attackStyleMap = {
    1: s('ovMelee'),
    2: s('ovRanged')
  };
  const attackTypeStr = attackStyleMap[char.attack_style_type] || s('ovUnknown');

  const mainCardImg = char.cards && char.cards.length > 0 ? getCharacterCardUrl(char.cards[0]) : char.icon;
  const cn = getLang() === 'cn';
  const nickname = cn ? '' : String(char.nickname_vi ?? "").trim();
  const fullname = cn ? (char.fullname_cn ?? '') : (char.fullname_vi ?? '');
  const profile = char.profile || {};

  container.innerHTML = `
    <div class="char-overview-wrapper">
      <section class="overview-top-section">
        <!-- Compact Profile List Block -->
        <div class="overview-info-block">
          <div class="overview-section-header">
            <h2>${s('ovTitle')}</h2>
            <span class="rarity-badge ${rarityInfo.class}">${rarityInfo.label}</span>
          </div>

          <div class="overview-info-grid">
            <!-- LEFT COLUMN -->
            <div class="overview-info-col">
              <!-- 1. Tên hiển thị -->
              <div class="info-cell">
                <span class="info-label">${s('ovName')}</span>
                <span class="info-val highlight" data-field="name_vi">${txt(char, 'name')}</span>
              </div>

              <!-- 2. Tên đầy đủ (always rendered: inline edit un-hides empty editable fields) -->
              <div class="info-cell${fullname ? '' : ' hidden'}">
                <span class="info-label">${s('ovFullname')}</span>
                <span class="info-val" data-field="fullname_vi">${fullname}</span>
              </div>

              <!-- 3. Khí Giả -->
              <div class="info-cell">
                <span class="info-label">${s('ovJob')}</span>
                <span class="info-val job-val">
                  <img src="/assets/jobs/job_${char.job}.png" alt="${jobName}" class="job-icon-small" />
                  ${jobName}
                </span>
              </div>

              <!-- 4. Loại banner -->
              <div class="info-cell">
                <span class="info-label">${s('ovBanner')}</span>
                <span class="info-val">${char.is_limited ? `<span class="limited-tag">${s('limited')}</span>` : s('catStandard')}</span>
              </div>

              <!-- 5. Tình trạng nhân sự -->
              ${profile.staff_status ? `
              <div class="info-cell">
                <span class="info-label">${s('ovStaff')}</span>
                <span class="info-val">${escapeHtml(profile.staff_status)}</span>
              </div>
              ` : ''}

              <!-- 6. Mã hồ sơ -->
              ${profile.record_id ? `
              <div class="info-cell">
                <span class="info-label">${s('ovRecord')}</span>
                <span class="info-val record-id-val">${escapeHtml(profile.record_id)}</span>
              </div>
              ` : ''}
            </div>

            <!-- RIGHT COLUMN -->
            <div class="overview-info-col">
              <!-- 1. Tên thường gọi (always rendered, see above) -->
              <div class="info-cell${nickname ? '' : ' hidden'}">
                <span class="info-label">${s('ovNickname')}</span>
                <span class="info-val" data-field="nickname_vi">${nickname}</span>
              </div>

              <!-- 2. Tên gốc (CN) -->
              <div class="info-cell${cn ? ' hidden' : ''}">
                <span class="info-label">${s('ovCnName')}</span>
                <span class="info-val cn-font">${char.fullname_cn || char.name_cn}</span>
              </div>

              <!-- 3. Kiểu tấn công -->
              <div class="info-cell">
                <span class="info-label">${s('ovAttack')}</span>
                <span class="info-val">${attackTypeStr}</span>
              </div>

              <!-- 4. Trực thuộc -->
              ${profile.department ? `
              <div class="info-cell">
                <span class="info-label">${s('ovDept')}</span>
                <span class="info-val highlight-dept">${escapeHtml(profile.department)}</span>
              </div>
              ` : ''}

              <!-- 5. Tình trạng bản thể -->
              ${profile.entity_status ? `
              <div class="info-cell">
                <span class="info-label">${s('ovEntity')}</span>
                <span class="info-val">${escapeHtml(profile.entity_status)}</span>
              </div>
              ` : ''}
            </div>
          </div>
          <!-- recruit-line quote: React island mounted by characterDetail (mountLoreQuote) -->
          <div class="overview-quote-slot"></div>
        </div>

        <!-- Artwork Showcase Block -->
        <div class="overview-art-block">
          <div class="art-frame">
            ${ticketHtml({ image: mainCardImg, rare: char.rare, job: char.job, name: txt(char, 'name') })}
          </div>
        </div>
      </section>
    </div>
  `;
}
