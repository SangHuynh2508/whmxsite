// Shared page behaviour of the three directions; each direction only renders the list and the viewer caption.
// Expected ids: #t #lede #kinds #sicon #q #story #body #foot, viewer #vw #vc #vd #vx #vp #vn #vs #vi #vcap.
(function () {
  const { L, icon, esc } = G;
  const $ = (id) => document.getElementById(id);
  const anim = window.gsap && !G.reduced;

  // The site's selection ink: leading edge first, trailing edge a beat later (motion.ts useSlider).
  function seg(box, value, attr = 'v') {
    let ink = box.querySelector('.ink');
    if (!ink) { ink = document.createElement('span'); ink.className = 'ink'; box.prepend(ink); }
    let on = null;
    box.querySelectorAll('button').forEach((b) => {
      const sel = b.dataset[attr] === value;
      b.setAttribute(b.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed', String(sel));
      if (sel) on = b;
    });
    if (!on) { ink.style.opacity = 0; return; }
    const to = { left: on.offsetLeft, width: on.offsetWidth, opacity: 1 };
    if (anim && ink.style.width) gsap.to(ink, { ...to, duration: 0.45, ease: 'expo.out' });
    else Object.assign(ink.style, { left: to.left + 'px', width: to.width + 'px', opacity: 1 });
  }
  // Blocks arrive in reading order: 6 px rise + fade (motion.ts useReveal); only the first screenful animates.
  function arrive(nodes) {
    if (!anim) return;
    gsap.fromTo([...nodes].slice(0, 14), { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.03, clearProps: 'all' });
  }
  function meta(it) {
    const k = G.KIND[it.kind];
    if (it.kind === 'story') return `${k} · ${/^v\d$/.test(it.group) ? G.subHtml(it) : G.GROUP[it.group]}`; // the title already names the story
    if (it.kind === 'loading' && it.note_cn) return `${k} · ${G.note(it)}`;
    return k;
  }

  function mount(cfg) {
    const st = G.readQuery(cfg.defaults);
    let list = [];
    $('t').textContent = L.title;
    $('lede').textContent = L.lede;
    $('sicon').innerHTML = icon('search', 16);
    $('q').placeholder = L.search; $('q').setAttribute('aria-label', L.search); $('q').value = st.q;
    $('foot').innerHTML = `<span>${L.elsewhere}</span><a href="#">${L.skins}</a><a href="#">${L.banners}</a>`;

    const kinds = $('kinds');
    kinds.classList.add('seg');
    kinds.innerHTML = G.KINDS.map(([k, n]) => `<button role="tab" data-v="${k}">${n}<small>${G.count((it) => it.kind === k)}</small></button>`).join('');
    kinds.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) set({ kind: b.dataset.v, ...(b.dataset.v === 'story' ? storyDefault() : { g: '', v: '' }) }); });

    function storyDefault() { return { g: 'v3', v: G.subs('v3')[0] }; }
    function storyNav() {
      const box = $('story');
      if (!box || cfg.storyNav === false) return;
      if (st.kind !== 'story') { box.innerHTML = ''; return; }
      const subs = G.subs(st.g);
      box.innerHTML = `<div class="story-nav"><div class="seg" id="groups">${G.GROUPS.map(([g, n]) => `<button data-v="${g}">${n}<small>${G.count((it) => it.group === g)}</small></button>`).join('')}</div>
        <div class="vers" role="group" aria-label="Bản / truyện">${[['', L.all, G.count((it) => it.group === st.g)], ...subs.map((s) => [s, G.subLabel(st.g, s), G.count((it) => it.group === st.g && it.sub_cn === s)])]
          .map(([s, n, c]) => `<button data-s="${esc(s)}" aria-pressed="${s === st.v}">${n}<small>${c}</small></button>`).join('')}</div></div>`;
      seg($('groups'), st.g);
      // a version series opens on its newest version; events / chapters / stories open on "Tất cả"
      box.querySelector('#groups').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) set({ g: b.dataset.v, v: /^v\d$/.test(b.dataset.v) ? G.subs(b.dataset.v)[0] : '' }); });
      box.querySelector('.vers').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) set({ v: b.dataset.s }); });
      keepVisible(box.querySelector('.vers'));
    }
    function keepVisible(row) { const b = row.querySelector('[aria-pressed=true]'); if (b) row.scrollLeft = b.offsetLeft - row.clientWidth / 2 + b.offsetWidth / 2; }

    let qTimer = 0;
    $('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => set({ q: $('q').value.trim() }), 150); });

    function set(patch) { Object.assign(st, patch, { id: '' }); G.writeQuery(st); draw(); }
    function draw() {
      seg(kinds, st.kind);
      storyNav();
      list = G.filter(cfg.chapters ? { ...st, v: '' } : st); // chapters: the whole group, v only scrolls to its chapter
      cfg.render(list, st, set);
    }

    // ---- viewer ----
    const vw = $('vw');
    let at = -1, back = null;
    $('vx').innerHTML = icon('x'); $('vx').setAttribute('aria-label', L.close);
    $('vp').innerHTML = icon('left', 22); $('vp').setAttribute('aria-label', L.prev);
    $('vn').innerHTML = icon('right', 22); $('vn').setAttribute('aria-label', L.next);
    function show(i) {
      at = (i + list.length) % list.length;
      const it = list[at];
      const img = new Image();
      img.alt = G.titleText(it);
      img.onerror = () => { $('vi').innerHTML = '<p class="broken">Không tải được ảnh này. Vẫn có thể tải bản gốc.</p>'; };
      img.src = G.view(it);
      $('vi').replaceChildren(img);
      $('vd').href = G.orig(it); $('vd').setAttribute('download', `${it.kind}_${it.id}.png`);
      $('vd').innerHTML = `${icon('down', 16)}<span>${L.download}</span>`;
      cfg.viewer.show(it, at, list.length);
      st.id = it.id; G.writeQuery(st);
      [list[at + 1], list[at - 1]].forEach((n) => { if (n) new Image().src = G.view(n); });
    }
    function open(i, from) {
      back = from || document.activeElement;
      vw.hidden = false; document.body.style.overflow = 'hidden';
      show(i);
      if (anim) gsap.fromTo(vw, { opacity: 0 }, { opacity: 1, duration: 0.25 }), gsap.fromTo('#vi', { scale: 0.97, y: 6 }, { scale: 1, y: 0, duration: 0.4, ease: 'expo.out' });
      $('vx').focus();
    }
    function close() { vw.hidden = true; document.body.style.overflow = ''; st.id = ''; G.writeQuery(st); back?.focus?.(); }
    $('vx').addEventListener('click', close);
    $('vp').addEventListener('click', () => show(at - 1));
    $('vn').addEventListener('click', () => show(at + 1));
    G.swipe($('vs'), () => show(at - 1), () => show(at + 1));
    document.addEventListener('keydown', (e) => {
      if (vw.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(at - 1);
      else if (e.key === 'ArrowRight') show(at + 1);
      else if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...vw.querySelectorAll('a[href],button:not([hidden])')].filter((x) => x.offsetParent);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    });
    $('body').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) open(+b.dataset.i, b); });

    draw();
    if (st.id) { const i = list.findIndex((it) => it.id === st.id); if (i >= 0) open(i); }
    return { refresh: draw, state: st, set, open };
  }

  function empty(body) {
    body.innerHTML = `<div class="empty"><p>${L.empty}</p><button class="btn" id="clr">${L.clear}</button></div>`;
    $('clr').addEventListener('click', () => { $('q').value = ''; $('q').dispatchEvent(new Event('input')); });
  }

  window.GUI = { mount, seg, arrive, meta, empty };
})();
