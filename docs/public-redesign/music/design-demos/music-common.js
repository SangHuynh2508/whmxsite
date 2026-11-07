// Shared by the three Âm nhạc directions: labels (= src/i18n/strings.mts vi), filtering (= musicData.mts), icons
// (lucide paths), and local asset paths. Audio and covers are read from the WHMX_Tool export next to this repo
// (D:\BaiTapCode\WHMX\WHMX_Tool\Xuat\Audio\bgm) — on the site they come from R2.
(function () {
  const BASE = '../../../../../WHMX_Tool/Xuat/Audio/bgm/';
  const L = { all: 'Tất cả', jukebox: 'Máy hát', story: 'Truyện', stage: 'Màn đánh', area: 'Bản đồ', other: 'Khác',
    search: 'Tìm theo tên hoặc mã bài', empty: 'Không có bài nào phù hợp.', playError: 'Không phát được bài này.',
    usedStory: 'Dùng trong truyện', usedStage: 'Dùng trong màn đánh', usedArea: 'Dùng ở bản đồ' };
  const GROUPS = ['jukebox', 'story', 'stage', 'area', 'other'];
  const P = {
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    prev: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',
    next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    vol: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    mute: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  };
  const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // The last glyph and the dot share a no-wrap span, so the dot never sits alone on a line.
  const cn = (v) => { const c = Array.from(v); return `<span class="cn">${esc(c.slice(0, -1).join(''))}<span class="nw">${esc(c.slice(-1).join(''))}<span class="dot" aria-hidden="true"></span></span></span><span class="sr">(chưa dịch)</span>`; };

  const tracks = window.MUSIC.tracks;
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const audio = (t) => BASE + t.file.split('/').pop();
  const cover = (t) => (t.cover ? BASE + 'bia/' + t.cover.split('/').pop().replace(/\.webp$/, '.png') : '');
  // Title: jukebox name (Chinese, untranslated) → "<kind> · <first use>" → the file id.
  const title = (t) => (t.name_cn ? cn(t.name_cn)
    : t.label_kind ? `${L[t.label_kind]} · ${cn(t.label_cn)}` : `<span class="code">${esc(t.id)}</span>`);
  const titleText = (t) => t.name_cn || (t.label_kind ? `${L[t.label_kind]} · ${t.label_cn}` : t.id);
  const short = (g) => g.split(' — ')[0];
  // One ash line of where the track is heard.
  function usage(t) {
    const out = [];
    if (t.stories_total) out.push(`${L.story}: ${t.stories.slice(0, 2).map((s) => esc(short(s.group_cn))).join(', ')}${t.stories_total > 2 ? ` · ${t.stories_total} cảnh` : ''}`);
    if (t.stages.count) out.push(`${L.stage}: ${t.stages.names_cn.slice(0, 2).map(esc).join(', ')}${t.stages.count > 2 ? ` +${t.stages.count - 2}` : ''}`);
    if (t.areas_cn.length) out.push(`${L.area}: ${t.areas_cn.slice(0, 3).map(esc).join(', ')}`);
    return out.join('  ·  ') || 'Chưa rõ nơi dùng';
  }
  // Full "where it is heard" block for a detail view.
  function uses(t) {
    let h = '';
    if (t.stories.length) h += `<h3>${L.usedStory}</h3><ul>${t.stories.map((s) => `<li><span class="cn">${esc(short(s.group_cn))}</span>${s.count > 1 ? `<span class="n">${s.count} cảnh</span>` : ''}</li>`).join('')}</ul>${t.stories_total > t.stories.reduce((a, s) => a + s.count, 0) ? `<p class="more">Tổng ${t.stories_total} cảnh truyện</p>` : ''}`;
    if (t.stages.count) h += `<h3>${L.usedStage}</h3><ul>${t.stages.names_cn.map((n) => `<li class="cn">${esc(n)}</li>`).join('')}</ul>${t.stages.count > t.stages.names_cn.length ? `<p class="more">+${t.stages.count - t.stages.names_cn.length} màn khác</p>` : ''}`;
    if (t.areas_cn.length) h += `<h3>${L.usedArea}</h3><ul>${t.areas_cn.map((n) => `<li class="cn">${esc(n)}</li>`).join('')}</ul>`;
    return h || '<p class="more">Không tìm thấy nơi game dùng bài này (có thể là bản thừa hoặc dùng ở chỗ chưa giải mã).</p>';
  }
  function filter(group, q) {
    q = q.trim().toLowerCase();
    return tracks.filter((t) => (group === 'all' || t.groups.includes(group))
      && (!q || [t.name_cn, t.name_vi, t.label_cn, t.id].some((v) => v.toLowerCase().includes(q))));
  }
  const counts = () => Object.fromEntries(GROUPS.map((g) => [g, tracks.filter((t) => t.groups.includes(g)).length]));
  const disc = (t, cls = '') => (t.cover ? `<img class="disc ${cls}" src="${cover(t)}" alt="" loading="lazy">` : `<span class="disc blank ${cls}" aria-hidden="true"></span>`);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Group tabs with the site's selection ink: leading edge runs (0.3 s), trailing edge follows (0.55 s).
  function tabs(el, current, onPick) {
    const c = counts();
    el.innerHTML = '<span class="ink"></span>' + ['all', ...GROUPS].map((g) => `<button type="button" data-g="${g}" aria-pressed="${g === current}">${L[g]}<span>${g === 'all' ? tracks.length : c[g]}</span></button>`).join('');
    const ink = el.querySelector('.ink');
    const place = (animate) => {
      const b = el.querySelector('[aria-pressed=true]');
      const to = { x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth };
      if (!animate || reduced || !window.gsap) return gsap.set(ink, to);
      const from = { x: gsap.getProperty(ink, 'x'), w: gsap.getProperty(ink, 'width') };
      const right = to.x > from.x;
      gsap.timeline().to(ink, { y: to.y, duration: 0 })
        .to(ink, right ? { width: to.x + to.width - from.x, duration: 0.3, ease: 'expo.out' } : { x: to.x, width: from.x + from.w - to.x, duration: 0.3, ease: 'expo.out' })
        .to(ink, { x: to.x, width: to.width, duration: 0.55, ease: 'expo.out' }, 0.08);
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      place(true); onPick(b.dataset.g);
    });
    requestAnimationFrame(() => place(false));
    addEventListener('resize', () => place(false));
  }
  // The site's arrival: 6 px rise, 2 px blur → sharp, 0.6 s expo-out, the group starting within 0.3 s.
  function reveal(nodes) {
    nodes = [...nodes].slice(0, 14);
    if (!window.gsap || !nodes.length) return;
    if (reduced) return gsap.fromTo(nodes, { opacity: 0 }, { opacity: 1, duration: 0.15 });
    gsap.fromTo(nodes, { opacity: 0, y: 6, filter: 'blur(2px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', stagger: Math.min(0.03, 0.3 / nodes.length), clearProps: 'filter,transform' });
  }
  window.M = { L, GROUPS, tracks, byId, audio, cover, title, titleText, usage, uses, filter, counts, icon, esc, disc, tabs, reveal, reduced, version: window.MUSIC.version };
})();
