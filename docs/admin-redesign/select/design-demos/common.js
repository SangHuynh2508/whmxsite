// Shared frame for the 3 Select directions: same page, same real content (A0001 voice units), only the
// open list differs. Statuses are illustrative (dev DB: almost everything is still "chưa dịch").
const STATUS = ['done', 'done', 'done', 'changed', 'legacy'];
const STATUS_VI = { done: 'đã lưu', legacy: 'bản cũ', changed: 'đổi CN', todo: 'chưa dịch' };
const MODULES = ['Tổng quan', 'Lore', 'Phòng trà', 'Lồng tiếng', 'Build', 'Trang phục', 'Nguồn', 'Lịch sử'];

function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// renderOption(item, n, status) → inner HTML of one <option>; renderGroup(group) → optgroup label HTML (a <legend>).
function mountDemo({ title, note, renderOption, renderGroup, pickClass = '' }) {
  let n = 0;
  const groups = window.VOICE_GROUPS.map((g) => {
    const opts = g.items.map((item) => {
      const i = n++;
      const status = STATUS[i] ?? 'todo';
      return `<option value="${i}"${i === 4 ? ' selected' : ''} data-status="${status}">${renderOption(item, i + 1, status)}</option>`;
    }).join('');
    return `<optgroup label="${esc(g.group)}"><legend>${renderGroup(g)}</legend>${opts}</optgroup>`;
  }).join('');
  document.body.innerHTML = `
    <header class="demo-head"><b>${esc(title)}</b><span>${esc(note)}</span></header>
    <main class="demo-main">
      <div class="demo-row">
        <span class="demo-label">Câu thoại</span>
        <select class="sel sel-voice ${pickClass}" aria-label="Chọn câu thoại">
          <button><selectedcontent></selectedcontent></button>${groups}
        </select>
        <span class="demo-count">3/44 đã lưu · 1 bản cũ · 1 đổi CN · 39 chưa dịch</span>
      </div>
      <div class="demo-row">
        <span class="demo-label">Mục hồ sơ</span>
        <select class="sel sel-short ${pickClass}" aria-label="Mục hồ sơ">
          <button><selectedcontent></selectedcontent></button>
          ${MODULES.map((m, i) => `<option${i === 3 ? ' selected' : ''}>${renderOption({ vi: m, cn: '', extra: '' }, 0, '')}</option>`).join('')}
        </select>
      </div>
    </main>`;
}
