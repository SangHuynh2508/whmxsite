import type { ReactNode } from 'react';
import { Block } from '../Block';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

// Label, the rotation's note above its sequence, fixed-width steps (icon, ATK/SKILL/ULT tag, step note), then a key
// for the tags actually shown — a `title` tooltip never reaches touch or keyboard users (critique P1).
export function RotationBlock({ rotations, span, action }: { rotations: BuildView['rotations']; span: Span; action?: ReactNode }) {
  const key = [...new Map(rotations.flatMap((r) => r.steps).filter((s) => s.type && s.tag !== s.type).map((s) => [s.tag, s.type])).entries()];
  return (
    <Block id="rotations" title="Xoay vòng" span={span} action={action}>
      <div className="bs-rots">
        {rotations.map((r, i) => (
          <div key={i} className="bs-rot">
            {r.label && <h4>{r.label}</h4>}
            <div>
              {r.note && <p className="bs-rot-note">{r.note}</p>}
              <ol className="bs-seq">
                {r.steps.map((s, k) => (
                  <li key={k} title={s.type ? `${s.name} · ${s.type}` : s.name}>
                    {s.icon ? <img src={s.icon} alt={s.name} loading="lazy" /> : <span className="bs-noicon">{s.name}</span>}
                    <b>{s.tag}</b>
                    {s.note && <small>{s.note}</small>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>
      {key.length > 0 && <p className="bs-key">{key.map(([tag, type]) => `${tag} = ${type}`).join(' · ')}</p>}
    </Block>
  );
}
