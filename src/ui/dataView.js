/**
 * Standalone Data Page Sub-View (/data)
 */

export function renderDataView(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="data-page-wrapper">
      <div class="data-page-card">
        <h2 class="data-card-title">chưa biết nên làm gì</h2>
      </div>
    </div>
  `;
}
