// Shared helpers for the Build-tab demos (render from window.BUILD). Each block is a function of the data, like the
// React components will be (one component per block, each with a slot for a later "Sửa" action).
const B = window.BUILD;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// game name: VI when translated, else CN + dot
const nm = (n) => (n?.vi ? esc(n.vi) : `<span class="cn" lang="zh">${esc(n?.cn)}</span>`);
const affix = (a) => nm({ vi: a.name.vi && `${a.name.vi}${a.percent ? ' %' : ''}`, cn: `${a.name.cn}${a.percent ? ' %' : ''}` });
const frame = (rare) => `assets/itemRare${rare ?? 'K'}.png`;
let popN = 0;
function weaponTile(w, size) {
  const id = `pop-${++popN}`;
  return `<button class="wtile" style="--tile:${size || 72}px;background-image:url(${frame(w.rare)})" popovertarget="${id}" aria-label="${esc(w.name.vi || w.name.cn)}">
    <img src="${w.icon}" alt=""></button>
  <div popover id="${id}"><div class="pop-head"><span class="wtile" style="--tile:56px;background-image:url(${frame(w.rare)})"><img src="${w.icon}" alt=""></span>
    <div><h4>${nm(w.name)}</h4><small>★${w.rare} · ${esc(w.label)}</small></div></div>
    ${w.skills.map((s) => `<div class="pop-skill"><h5>${nm(s.name) || 'Kỹ năng'}</h5><p>${s.text}</p></div>`).join('')}</div>`;
}
const avatar = (m) => `<a class="ava" data-rare="${m.rare}" href="#"><img src="${m.avatar}" alt=""><span>${esc(m.name)}</span></a>`;
const shell = (inner) => `<main class="shell">
  <header class="char"><img src="${B.character.avatar}" alt=""><div><h1>${esc(B.character.name_vi)}</h1><p lang="zh">${esc(B.character.name_cn)}</p></div></header>
  <nav class="tabs"><span>Tổng Quan</span><span>Thông Tin</span><span>Thiên Phú</span><span class="on">Build</span><span>Hồ Sơ Lưu Trữ</span><span>Thư Viện</span></nav>
  ${inner}</main>`;
