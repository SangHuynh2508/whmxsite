import type { ReactNode } from 'react';
import { Block } from '../Block';
import { Text } from '../Text';
import type { BuildView } from '../buildView.mts';
import type { Span } from '../sheetLayout.mts';

export function AffixesBlock({ affixes, span, action }: { affixes: BuildView['affixes']; span: Span; action?: ReactNode }) {
  return (
    <Block id="affixes" title="Dòng thuộc tính" span={span} action={action}>
      {affixes.groups.length > 0 && (
        <div className="bs-cells">
          {affixes.groups.map((g, i) => (
            <div key={i} className="bs-cell">{g.label && <h4>{g.label}</h4>}<ul>{g.items.map((a, k) => <li key={k}><Text unit={a} /></li>)}</ul></div>
          ))}
        </div>
      )}
      {affixes.noReroll && <p className="bs-note">Không cần tẩy luyện vũ khí.</p>}
    </Block>
  );
}
