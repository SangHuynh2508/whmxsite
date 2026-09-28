import { Fragment, type ReactNode } from 'react';
import type { BuildView } from './buildView.mts';
import { sheetLayout, type BlockId, type Span } from './sheetLayout.mts';
import { AffixesBlock } from './blocks/AffixesBlock';
import { DeepensBlock } from './blocks/DeepensBlock';
import { RotationBlock } from './blocks/RotationBlock';
import { TeamsBlock } from './blocks/TeamsBlock';
import { TipsBlock } from './blocks/TipsBlock';
import { WeaponsBlock } from './blocks/WeaponsBlock';

const BLOCKS: Record<BlockId, (v: BuildView, span: Span) => ReactNode> = {
  weapons: (v, span) => <WeaponsBlock weapons={v.weapons} span={span} />,
  affixes: (v, span) => <AffixesBlock affixes={v.affixes} span={span} />,
  rotations: (v, span) => <RotationBlock rotations={v.rotations} span={span} />,
  deepens: (v, span) => <DeepensBlock deepens={v.deepens} span={span} />,
  tips: (v, span) => <TipsBlock tips={v.tips} span={span} />,
  teams: (v, span) => <TeamsBlock teams={v.teams} teamOther={v.teamOther} span={span} />,
};

// Direction C (docs/public-redesign/build-tab/direction-approved.md): one framed sheet, gold band, staggered modules.
// The build name is demoted (the tabs already name it; spec C4). `action` = the band's slot for a later public
// "Sửa build" / "Tạo build" (spec R4).
export function BuildSheet({ view, action }: { view: BuildView; action?: ReactNode }) {
  return (
    <article className="bs-sheet">
      <header className="bs-band">
        <div className="bs-title"><h2>{view.name || 'Build'}</h2>{view.rating && <span className="bs-rating">{view.rating}</span>}</div>
        {view.summary && <p>{view.summary}</p>}
        {action}
      </header>
      <div className="bs-grid">{sheetLayout(view).map(({ id, span }) => <Fragment key={id}>{BLOCKS[id](view, span)}</Fragment>)}</div>
    </article>
  );
}
