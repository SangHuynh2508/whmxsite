/**
 * Overview Sub-View Component (/characters/:slug)
 * Profile & Identity Information ONLY (Compact Overview)
 */
export function renderOverviewTab(container, char) {
  const jobNames = { 1: "Túc Vệ", 2: "Khinh Nhuệ", 3: "Viễn Kích", 4: "Cấu Thuật", 5: "Chiến Lược" };
  const rarityMap = { 4: { label: "SSR", class: "ssr" }, 3: { label: "SR", class: "sr" }, 2: { label: "R", class: "r" } };

  const rarityInfo = rarityMap[char.rare] || { label: `★${char.rare}`, class: "sr" };
  const jobName = jobNames[char.job] || "Chưa xác định";
  const attackTypeStr = char.attacktype === 1 ? "Cận chiến" : char.attacktype === 2 ? "Tầm xa" : "Đặc biệt";

  const mainCardImg = char.cards && char.cards.length > 0 ? `/assets/cards/${char.cards[0]}` : char.icon;
  const nickname = (char.nickname_vi || "").trim();
  const profile = char.profile || {};

  container.innerHTML = `
    <div class="char-overview-wrapper">
      <section class="overview-top-section">
        <!-- Compact Profile List Block -->
        <div class="overview-info-block">
          <div class="overview-section-header">
            <h3>HỒ SƠ KHÍ GIẢ</h3>
            <span class="rarity-badge ${rarityInfo.class}">${rarityInfo.label}</span>
          </div>

          <div class="overview-info-grid">
            <!-- LEFT COLUMN -->
            <div class="overview-info-col">
              <!-- 1. Tên hiển thị -->
              <div class="info-cell">
                <span class="info-label">Tên hiển thị:</span>
                <span class="info-val highlight">${char.name_vi || char.name_cn}</span>
              </div>

              <!-- 2. Tên đầy đủ -->
              ${char.fullname_vi ? `
              <div class="info-cell">
                <span class="info-label">Tên đầy đủ:</span>
                <span class="info-val">${char.fullname_vi}</span>
              </div>
              ` : ''}

              <!-- 3. Khí Giả -->
              <div class="info-cell">
                <span class="info-label">Khí Giả:</span>
                <span class="info-val job-val">
                  <img src="/assets/jobs/job_${char.job}.png" alt="${jobName}" class="job-icon-small" />
                  ${jobName}
                </span>
              </div>

              <!-- 4. Loại banner -->
              <div class="info-cell">
                <span class="info-label">Loại banner:</span>
                <span class="info-val">${char.is_limited ? '<span class="limited-tag">Limited</span>' : 'Thường'}</span>
              </div>

              <!-- 5. Tình trạng nhân sự -->
              ${profile.staff_status ? `
              <div class="info-cell">
                <span class="info-label">Tình trạng nhân sự:</span>
                <span class="info-val">${profile.staff_status}</span>
              </div>
              ` : ''}

              <!-- 6. Mã hồ sơ -->
              ${profile.record_id ? `
              <div class="info-cell">
                <span class="info-label">Mã hồ sơ:</span>
                <span class="info-val record-id-val">${profile.record_id}</span>
              </div>
              ` : ''}
            </div>

            <!-- RIGHT COLUMN -->
            <div class="overview-info-col">
              <!-- 1. Tên thường gọi -->
              ${nickname ? `
              <div class="info-cell">
                <span class="info-label">Tên thường gọi:</span>
                <span class="info-val">${nickname}</span>
              </div>
              ` : ''}

              <!-- 2. Tên gốc (CN) -->
              <div class="info-cell">
                <span class="info-label">Tên gốc (CN):</span>
                <span class="info-val cn-font">${char.fullname_cn || char.name_cn}</span>
              </div>

              <!-- 3. Kiểu tấn công -->
              <div class="info-cell">
                <span class="info-label">Kiểu tấn công:</span>
                <span class="info-val">${attackTypeStr}</span>
              </div>

              <!-- 4. Trực thuộc -->
              ${profile.department ? `
              <div class="info-cell">
                <span class="info-label">Trực thuộc:</span>
                <span class="info-val highlight-dept">${profile.department}</span>
              </div>
              ` : ''}

              <!-- 5. Tình trạng bản thể -->
              ${profile.entity_status ? `
              <div class="info-cell">
                <span class="info-label">Tình trạng bản thể:</span>
                <span class="info-val">${profile.entity_status}</span>
              </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Artwork Showcase Block -->
        <div class="overview-art-block">
          <div class="art-frame">
            <img src="${mainCardImg}" alt="${char.name_vi || char.name_cn}" class="overview-art-img" />
          </div>
          <div class="art-caption">
            <span class="art-title">${char.name_vi || char.name_cn}</span>
          </div>
        </div>
      </section>
    </div>
  `;
}
