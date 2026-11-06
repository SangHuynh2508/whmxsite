import type { ReactNode } from 'react';
import { Block } from '../Block';
import { s } from '../../../../i18n/strings.mts';
import { useLang } from '../../../../i18n/useLang.ts';
import type { Span } from '../sheetLayout.mts';

export function TipsBlock({ tips, span, action }: { tips: string[]; span: Span; action?: ReactNode }) {
  useLang();
  return <Block id="tips" title={s('bdTips')} span={span} action={action}><ol className="bs-tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ol></Block>;
}
