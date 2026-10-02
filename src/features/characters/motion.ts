import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';

import './styles/motion.css';

// Motion for the character-page islands (Build, Hồ Sơ Lưu Trữ), owner 2026-09-28: "trượt ấn tượng chút, đừng làm quá",
// and text that arrives instead of popping in. Everything is visible by default; a failed script leaves a static page.
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The selection "ink" of a segmented control / tab row (`.seg-ink`, first child of the list): on a change the leading
 * edge runs to the new button and the trailing edge follows a beat later, so the ink stretches across and settles.
 * Instant on first paint, on resize and under reduced motion.
 */
export function useSlider(list: RefObject<HTMLElement | null>, index: number) {
  const first = useRef(true);
  useLayoutEffect(() => {
    const box = list.current;
    const ink = box?.querySelector<HTMLElement>(':scope > .seg-ink');
    if (!box || !ink) return;
    const target = () => {
      const button = box.querySelectorAll<HTMLElement>(':scope > [role="tab"]')[index];
      return button ? { l: button.offsetLeft, r: button.offsetLeft + button.offsetWidth, t: button.offsetTop, h: button.offsetHeight } : null;
    };
    const place = (p: { l: number; r: number }) => { ink.style.left = `${p.l}px`; ink.style.width = `${p.r - p.l}px`; };
    const to = target();
    if (!to) return;
    ink.style.top = `${to.t}px`;
    ink.style.height = `${to.h}px`;
    const from = { l: parseFloat(ink.style.left), r: parseFloat(ink.style.left) + parseFloat(ink.style.width) };
    let tween: gsap.core.Timeline | null = null;
    if (first.current || reduced() || Number.isNaN(from.l)) place(to);
    else {
      const edges = { ...from };
      const forward = to.l > from.l;
      tween = gsap.timeline({ onUpdate: () => place(edges) })
        .to(edges, forward ? { r: to.r, duration: 0.3, ease: 'expo.out' } : { l: to.l, duration: 0.3, ease: 'expo.out' }, 0)
        .to(edges, forward ? { l: to.l, duration: 0.55, ease: 'expo.out' } : { r: to.r, duration: 0.55, ease: 'expo.out' }, 0.06);
    }
    first.current = false;
    // a real resize snaps the ink into place; skip the call every observer makes on observe(), which killed the slide
    let observed = false;
    const observer = new ResizeObserver(() => {
      if (!observed) { observed = true; return; }
      tween?.kill();
      const p = target();
      if (p) { place(p); ink.style.top = `${p.t}px`; ink.style.height = `${p.h}px`; }
    });
    observer.observe(box);
    return () => { tween?.kill(); observer.disconnect(); };
  }, [list, index]);
}

/**
 * Children matching `selector` inside `scope` arrive in order: they rise 6 px (or slide 16 px in from the side of the
 * control that was pressed, `dir` ±1), sharpen from a 2 px blur and fade in. Re-runs whenever `key` changes;
 * `skipFirst` leaves the first paint to the enclosing reveal. Reduced motion keeps a short fade only.
 */
export function useReveal(scope: RefObject<HTMLElement | null>, selector: string, key: unknown, dir = 0, skipFirst = false) {
  const shown = useRef(key); // compare keys, not a "first run" flag: StrictMode runs every effect twice
  useLayoutEffect(() => {
    const root = scope.current;
    const skip = skipFirst && shown.current === key;
    shown.current = key;
    if (!root || skip) return;
    const items = root.querySelectorAll<HTMLElement>(selector);
    if (!items.length) return;
    let tween: gsap.core.Tween | null = null;
    const ctx = gsap.context(() => {
      // fromTo with an explicit end state: a re-run (StrictMode runs effects twice in dev) can never take a
      // half-faded element as its target
      if (reduced()) {
        tween = gsap.fromTo(items, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power1.out', clearProps: 'opacity' });
        return;
      }
      // light blur (owner 2026-09-28: "bớt mờ lại"): readable from the first frames
      tween = gsap.fromTo(items, { opacity: 0, x: dir * 16, y: dir ? 0 : 6, filter: 'blur(2px)' }, {
        opacity: 1,
        x: 0,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.6,
        ease: 'expo.out',
        stagger: Math.min(0.05, 0.3 / items.length), // the whole group starts within 0.3 s
        clearProps: 'opacity,transform,filter',
      });
    }, root);
    // text must never stay hidden: a page that gets no animation frames (hidden or occluded window) jumps to the end
    // (the returned tween only: ctx.getTweens() also lists stagger internals, and forcing those re-rendered the start)
    const safety = setTimeout(() => { if (tween && tween.progress() < 1) tween.progress(1); }, 1500);
    return () => { clearTimeout(safety); ctx.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * A box that grows or shrinks when something toggles ("Đọc tiếp", "Xem thêm"): call the returned `capture()` right
 * before the state change; after the re-render the box eases from the captured height to its new one.
 */
export function useHeightTween(box: RefObject<HTMLElement | null>, key: unknown) {
  const from = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const start = from.current;
    from.current = null;
    if (!el || start === null || reduced()) return;
    const end = el.offsetHeight;
    if (Math.abs(end - start) < 2) return;
    const tween = gsap.fromTo(el, { height: start, overflow: 'hidden' }, { height: end, duration: 0.45, ease: 'expo.out', clearProps: 'height,overflow' });
    return () => { tween.revert(); };
  }, [box, key]);
  return () => { if (box.current) from.current = box.current.offsetHeight; };
}

// Popovers of the islands (Build weapon / Thâm tạo, Lore terms) settle in when they open: a small scale-and-rise on
// wide screens, the bottom sheet slides up on phones. `beforetoggle` runs before the first paint (no flash); closing
// stays instant. One capturing listener: toggle events don't bubble.
const POPOVERS = '.bs-pop, .lore-popover';
document.addEventListener('beforetoggle', (event) => {
  const el = event.target;
  if (!(el instanceof HTMLElement) || !el.matches(POPOVERS) || (event as ToggleEvent).newState !== 'open' || reduced()) return;
  const sheet = matchMedia('(max-width: 640px)').matches;
  gsap.fromTo(el, sheet ? { yPercent: 100 } : { opacity: 0, scale: 0.97, y: 6 }, {
    ...(sheet ? { yPercent: 0, duration: 0.42 } : { opacity: 1, scale: 1, y: 0, duration: 0.3 }),
    ease: 'expo.out',
    clearProps: 'transform,opacity',
  });
}, true);
