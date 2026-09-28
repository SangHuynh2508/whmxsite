import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';

import './styles/motion.css';

// Motion for the character-page islands (Build, Hồ Sơ Lưu Trữ), owner 2026-09-28: "trượt ấn tượng chút, đừng làm quá",
// and text that arrives instead of popping in. Everything is visible by default; a failed script leaves a static page.
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
 * Children matching `selector` inside `scope` arrive in order: they rise a few px (or slide in from the side of the
 * control that was pressed, `dir` ±1), sharpen from a light blur and fade in. Re-runs whenever `key` changes;
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
      tween = gsap.fromTo(items, { opacity: 0, x: dir * 24, y: dir ? 0 : 10, filter: 'blur(6px)' }, {
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
