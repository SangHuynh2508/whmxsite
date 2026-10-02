// The one filter icon of the Nhân vật tab (direction D3): non-modal popover on wide screens (the list reflows in view),
// modal bottom sheet ≤ 640 px. Chips are plain React buttons, so a toggle re-renders them in place and focus stays.
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { JOB_NAMES, RARITY_LABELS } from '../../ui/utils/gameLabels.mts';
import type { Filter } from './tierView.mts';

type Props = {
  filter: Filter; rarities: number[]; left: number;
  count: (kind: 'jobs' | 'rarities', value: number) => number;
  toggle: (kind: 'jobs' | 'rarities', value: number) => void; clear: () => void;
};
const phone = () => matchMedia('(max-width: 640px)').matches;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TierFilter({ filter, rarities, left, count, toggle, clear }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const active = filter.jobs.size + filter.rarities.size;
  useEffect(() => {
    const outside = (e: MouseEvent) => { const d = dialog.current; if (d?.open && !phone() && !(e.target as Element).closest('.tl-fwrap')) d.close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && dialog.current?.open) dialog.current.close(); };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', outside); document.removeEventListener('keydown', esc); };
  }, []);
  const open = () => {
    const d = dialog.current!;
    if (d.open) { d.close(); return; }
    if (phone()) d.showModal(); else d.show();
    if (reduced()) return;
    if (phone()) gsap.fromTo(d, { yPercent: 100 }, { yPercent: 0, duration: 0.42, ease: 'expo.out', clearProps: 'transform' });
    else gsap.fromTo(d, { opacity: 0, y: 6, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'expo.out', clearProps: 'opacity,transform' });
  };
  const chip = (kind: 'jobs' | 'rarities', value: number, label: string, icon?: string) => {
    const on = filter[kind].has(value);
    const n = count(kind, value);
    return (
      <button key={value} type="button" className={kind === 'rarities' ? `tl-chip tl-rr r${value}` : 'tl-chip'} aria-pressed={on} disabled={!on && n === 0} onClick={() => toggle(kind, value)}>
        {icon && <img src={icon} alt="" />}{label} <small>{n}</small>
      </button>
    );
  };
  return (
    <div className="tl-fwrap">
      <button ref={button} type="button" className={active ? 'tl-fbtn on' : 'tl-fbtn'} aria-haspopup="dialog" aria-controls="tl-filter" aria-label="Bộ lọc" title="Bộ lọc" onClick={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></svg>
        {active > 0 && <i>{active}</i>}
      </button>
      <dialog ref={dialog} id="tl-filter" className="tl-filter" aria-labelledby="tl-filter-title" onClose={() => button.current?.focus()}
        onClick={(e) => { if (e.target === dialog.current && phone()) dialog.current.close(); }}>
        <h2 id="tl-filter-title">Bộ lọc</h2>
        <p className="tl-k">Nghề</p>
        <div className="tl-chips">{Object.entries(JOB_NAMES).map(([n, l]) => chip('jobs', Number(n), l, `/assets/jobs/job_${n}.png`))}</div>
        <p className="tl-k">Độ hiếm</p>
        <div className="tl-chips">{rarities.map((r) => chip('rarities', r, RARITY_LABELS[r]))}</div>
        <Legend />
        <div className="tl-foot">
          <span aria-live="polite">Còn {left} Khí Giả</span>
          <button type="button" onClick={clear}>Xoá lọc</button>
          <button type="button" className="tl-close" onClick={() => dialog.current?.close()}>Đóng</button>
        </div>
      </dialog>
    </div>
  );
}

export function Legend() {
  return (
    <p className="tl-legend">
      <span className="tl-badge">Z3</span> mốc Trí Tri tối thiểu · <span className="tl-badge hc">HC</span> cần Hoán Chương · không nhãn = không cần mốc · trong một tier, bên trái mạnh hơn · bấm để xem build
    </p>
  );
}
