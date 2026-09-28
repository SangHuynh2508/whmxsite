import type { ReactNode } from 'react';
import { Block } from '../Block';
import type { Span } from '../sheetLayout.mts';

export function TipsBlock({ tips, span, action }: { tips: string[]; span: Span; action?: ReactNode }) {
  return <Block id="tips" title="Mẹo" span={span} action={action}><ol className="bs-tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ol></Block>;
}
