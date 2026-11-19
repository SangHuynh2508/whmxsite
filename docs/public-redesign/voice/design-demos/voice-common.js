// Shared by the three voice-tab directions: data access + a simulated player (no mp3 in the demos yet).
// One line plays at a time; clicking the playing line stops it; nothing auto-advances (owner Q9).
window.VP = (() => {
  const V = window.VOICE;
  let timer = 0, raf = 0, cur = null;
  const dur = (l) => Math.max(1800, l.text.length * 170); // ponytail: fake length until real mp3 durations exist
  function stop() {
    cancelAnimationFrame(raf); clearTimeout(timer);
    if (cur) { cur.el.removeAttribute('data-playing'); cur.el.style.removeProperty('--p'); cur.onStop?.(); }
    cur = null;
  }
  function play(el, line, { onTick, onStop } = {}) {
    if (cur?.el === el) return stop();
    stop();
    const ms = dur(line), t0 = performance.now();
    cur = { el, onStop };
    el.setAttribute('data-playing', '');
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      el.style.setProperty('--p', p);
      onTick?.(p, ms);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timer = setTimeout(stop, ms);
  }
  const groupsOf = (lang) => V.groups.map((g) => ({ name: g, lines: lang.lines.filter((l) => l.group === g) }));
  const note = (l) => l.unlock || (l.zone ? `Khung giờ ${l.zone}` : '');
  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}`;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return { V, play, stop, dur, groupsOf, note, mmss, esc };
})();
