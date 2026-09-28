import { useId, type ReactNode } from 'react';
import { Block } from '../Block';
import { Text } from '../Text';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

type Weapon = BuildView['weapons'][number];

// Icon inside the game's rarity frame, 88 % of it and nudged down (owner: smaller than in the game). The variant chip
// (spec C2) is shared with 深造; "Xem kỹ năng ›" says the tile opens something (critique P2).
function WeaponTile({ weapon: w }: { weapon: Weapon }) {
  const id = useId();
  const nameId = `${id}-name`;
  return (
    <figure className="bs-weapon">
      <button type="button" className="bs-tile" style={{ backgroundImage: `url(${w.frame})` }} popoverTarget={id} aria-labelledby={nameId}>
        {w.icon && <img src={w.icon} alt="" />}
      </button>
      <figcaption>
        {(w.variant || w.labelRest) && <span className="bs-wlabel">{w.variant && <span className="bs-chip">{w.variant}</span>}{w.labelRest}</span>}
        <Text unit={w.name} id={nameId} />
        {w.skills.length > 0 && <button type="button" className="bs-cue" popoverTarget={id}>Xem kỹ năng ›</button>}
      </figcaption>
      <div popover="auto" id={id} className="bs-pop">
        <div className="bs-pop-head">
          <span className="bs-tile bs-tile-sm" style={{ backgroundImage: `url(${w.frame})` }}>{w.icon && <img src={w.icon} alt="" />}</span>
          <div><h4><Text unit={w.name} /></h4><small>★{w.rare}{w.variant && ` · ${w.variant}`}{w.labelRest && ` · ${w.labelRest}`}</small></div>
          <button type="button" className="bs-close" popoverTarget={id} popoverTargetAction="hide">Đóng</button>
        </div>
        {w.skills.map((s, i) => <div key={i} className="bs-skill"><h5><Text unit={s.name} /></h5><p><Text unit={s.text} /></p></div>)}
      </div>
    </figure>
  );
}

export function WeaponsBlock({ weapons, span, action }: { weapons: Weapon[]; span: Span; action?: ReactNode }) {
  return <Block id="weapons" title="Vũ khí" span={span} action={action}><div className="bs-weapons">{weapons.map((w) => <WeaponTile key={w.id} weapon={w} />)}</div></Block>;
}
