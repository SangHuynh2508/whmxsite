import { useId, type ReactNode } from 'react';
import { Block } from '../Block';
import { Text } from '../Text';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

type Deepen = BuildView['deepens'][number];

// Emblem + style name under it, the serial (7202) + variant chip beside; the whole unit opens the detail popover.
// The accessible name spells the serial ("7-2-0-2") so it is not read as one number (critique, Sam).
function DeepenUnit({ d }: { d: Deepen }) {
  const id = useId();
  const points = d.columns.map((c) => c.points).join('-');
  return (
    <>
      <button type="button" className="bs-deep" popoverTarget={id} aria-label={`Thâm tạo ${d.style.text}: ${points}${d.label ? `, ${d.label}` : ''}`}>
        <figure>{d.icon && <img src={d.icon} alt="" />}<figcaption><Text unit={d.style} /></figcaption></figure>
        <span className="bs-serial">{d.serial}{d.variant && <span className="bs-chip">{d.variant}</span>}<small>Xem thiên phú ›</small></span>
      </button>
      <div popover="auto" id={id} className="bs-pop">
        <div className="bs-pop-head">
          {d.icon && <img src={d.icon} alt="" />}
          <div><h4><Text unit={d.style} /> · {d.serial}</h4><small>{d.label && `${d.label} · `}{d.total}/11 điểm</small></div>
          <button type="button" className="bs-close" popoverTarget={id} popoverTargetAction="hide">Đóng</button>
        </div>
        {d.columns.map((c, i) => (
          <div key={i} className="bs-col">
            <h5>
              <Text unit={c.name} />
              <span className="bs-pips" role="img" aria-label={`${c.points}/7`}>{Array.from({ length: 7 }, (_, p) => <i key={p} className={p < c.points ? 'is-on' : undefined} />)}</span>
              <b>{c.points}</b>
            </h5>
            <ol>{c.talents.map((t) => <li key={t.point} className={t.reached ? 'is-reached' : undefined}><Text unit={t.text} /></li>)}</ol>
          </div>
        ))}
      </div>
    </>
  );
}

export function DeepensBlock({ deepens, span, action }: { deepens: Deepen[]; span: Span; action?: ReactNode }) {
  return <Block id="deepens" title="Thâm tạo" span={span} action={action}><div className="bs-deeps">{deepens.map((d, i) => <DeepenUnit key={i} d={d} />)}</div></Block>;
}
