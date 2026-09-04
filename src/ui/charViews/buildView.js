/**
 * Build Sub-View Component (/characters/:characterId/build)
 * Editorial & Community Build Guides Schema & Template
 */
export function renderBuildTab(container, char) {
  const buildData = char.build || null;

  if (!buildData || Object.keys(buildData).length === 0) {
    container.innerHTML = `
      <div class="build-page-wrapper">
        <div class="build-empty-state">
          <div class="build-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </div>
          <h3 class="build-empty-title">Chưa có hướng dẫn build</h3>
          <p class="build-empty-desc">
            Dữ liệu khuyến nghị trang bị, thâm tạo và đội hình cho <strong>${char.name_vi || char.name_cn}</strong> đang được tổng hợp từ phiên bản thử nghiệm.
          </p>
          <div class="build-schema-preview">
            <span class="schema-badge">Dữ liệu biên tập (Editorial Schema)</span>
            <p>Hệ thống hỗ trợ cập nhật động các mục: Vai trò, Vũ khí đề xuất, Thâm tạo, Đội hình, Rotation & Ưu/Nhược điểm.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Render editorial build data if present in char.build
  container.innerHTML = `
    <div class="build-page-wrapper">
      <div class="build-header">
        <h2>HƯỚNG DẪN BUILD & NÂNG CẤP</h2>
        <span class="build-author">Biên tập: ${buildData.author || "Cộng đồng"}</span>
      </div>

      <div class="build-sections-grid">
        <!-- 1. Role / Summary -->
        <div class="build-card role-card">
          <h3>VAI TRÒ TRONG ĐỘI HÌNH</h3>
          <p>${buildData.role || "Chưa có thông tin"}</p>
        </div>

        <!-- 2. Recommended Weapons -->
        <div class="build-card weapons-card">
          <h3>VŨ KHÍ ĐỀ XUẤT</h3>
          <ul class="build-item-list">
            ${(buildData.weapons || []).map(w => `<li><strong>${w.name}</strong> - ${w.desc}</li>`).join('') || '<li>Đang cập nhật...</li>'}
          </ul>
        </div>

        <!-- 3. Engravings / Thâm tạo -->
        <div class="build-card engraving-card">
          <h3>THÂM TẠO (BỘ TRANG BỊ)</h3>
          <ul class="build-item-list">
            ${(buildData.engravings || []).map(e => `<li><strong>${e.name}</strong>: ${e.effect}</li>`).join('') || '<li>Đang cập nhật...</li>'}
          </ul>
        </div>

        <!-- 4. Team Comps -->
        <div class="build-card team-card">
          <h3>ĐỘI HÌNH PHÙ HỢP</h3>
          <p>${buildData.team_comps || "Đang cập nhật..."}</p>
        </div>

        <!-- 5. Rotation / Playstyle -->
        <div class="build-card rotation-card">
          <h3>CÁCH CHƠI / ROTATION</h3>
          <p>${buildData.rotation || "Đang cập nhật..."}</p>
        </div>

        <!-- 6. Pros & Cons -->
        <div class="build-card pros-cons-card">
          <div class="pros-col">
            <h4 class="pros-title">ƯU ĐIỂM</h4>
            <ul>
              ${(buildData.pros || []).map(p => `<li>${p}</li>`).join('') || '<li>Chưa liệt kê</li>'}
            </ul>
          </div>
          <div class="cons-col">
            <h4 class="cons-title">NHƯỢC ĐIỂM</h4>
            <ul>
              ${(buildData.cons || []).map(c => `<li>${c}</li>`).join('') || '<li>Chưa liệt kê</li>'}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
}
