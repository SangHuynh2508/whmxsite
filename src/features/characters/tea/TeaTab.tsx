import { StrictMode, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/teaTab.css';
import { Text, useOverlayRerender } from '../lore/LoreTab.tsx';
import { useReveal } from '../motion';
import { buildTeaView, type Exchange } from './teaView.mts';
import { txt } from '../../../i18n/lang.mts';
import { s } from '../../../i18n/strings.mts';

// Look D2 (docs/public-redesign/tea-room/direction-approved.md): moon window + favourite teas on top, then the talk.
const REACTION = { like: { src: 'assets/tea/react_like.png', alt: 'teaLike' }, puzzled: { src: 'assets/tea/react_puzzled.png', alt: 'teaPuzzled' } } as const;
const STAGE_IMG = ['assets/tea/stage_1.png', 'assets/tea/stage_2.png', 'assets/tea/stage_3.png'];

function Reply({ x, name }: { x: Exchange; name: string }) {
  const rx = x.reaction ? REACTION[x.reaction] : null;
  return (
    <div className={x.narration ? 'tea-box tea-box--narr' : 'tea-box'}>
      {!x.narration && <span className="tea-plaque">{name}</span>}
      {rx && <span className="tea-react"><img src={rx.src} alt={s(rx.alt)} /></span>}
      <Text unit={x.reply} as="p" />
    </div>
  );
}

function Talk({ x, name }: { x: Exchange; name: string }) {
  return (
    <div className="tea-ex">
      <p className="tea-opt">
        <span><Text unit={x.ask} className="tea-opt-vi" /></span>
      </p>
      {x.reply && <Reply x={x} name={name} />}
    </div>
  );
}

function TeaTab({ char }: { char: { id?: string; name_vi?: string; name_cn?: string } & Record<string, unknown> }) {
  useOverlayRerender();
  const view = buildTeaView(char);
  const [picked, setPicked] = useState(0);
  const tabRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useReveal(tabRef, '.tea-band, .tea-sec', char.id);
  useReveal(detailRef, ':scope > *', picked, 0, true);
  const name = txt(char, 'name');
  if (!view) return <section className="tea-tab" aria-label={s('tabTea')}><p className="tea-empty">{s('teaEmpty')}</p></section>;
  const tea = view.teas[Math.min(picked, view.teas.length - 1)];
  const stage = (i: number) => <img src={STAGE_IMG[i]} alt="" />;

  return (
    <section ref={tabRef} className="tea-tab" aria-label={s('tabTea')}>
      {view.hasUntranslated && <p className="lore-notice"><b>Phòng trà chưa dịch xong.</b> Đoạn có chấm nhỏ đang hiện bản gốc tiếng Trung.</p>}
      {(view.drawing || tea) && (
        <div className={view.drawing ? 'tea-band' : 'tea-band tea-band--no-art'}>
          {view.drawing && <div className="tea-moon"><img src={view.drawing} alt="" loading="lazy" /></div>}
          {tea && (
            <>
              <div className="tea-list">
                <h2>{s('teaFav')}</h2>
                <p className="tea-hint">{s('teaHint')}</p>
                <div role="tablist" aria-label={s('teaFav')} className="tea-shelf">
                  {view.teas.map((t, i) => (
                    <button key={t.cn} type="button" role="tab" aria-selected={t === tea} className="tea-jar" onClick={() => setPicked(i)}>
                      <img src={t.icon} alt="" loading="lazy" />
                      <span><Text unit={t.name} className="tea-jar-name" /></span>
                    </button>
                  ))}
                </div>
              </div>
              <div role="tabpanel" className="tea-detail" ref={detailRef}>
                <img src={tea.icon} alt="" />
                <h3><Text unit={tea.name} /></h3>
                {tea.desc && <Text unit={tea.desc} as="p" className="tea-desc" />}
                {tea.comment && <div className="tea-box tea-box--wide"><span className="tea-plaque">{name}</span><Text unit={tea.comment} as="p" /></div>}
              </div>
            </>
          )}
        </div>
      )}

      {view.topics.length > 0 && (
        <section className="tea-sec">
          <div className="tea-rail">
            <div className="tea-cal">{stage(0)}{stage(1)}</div>
            <h3><Text unit={view.stages[0]} /> · <Text unit={view.stages[1]} /></h3>
            <p>{s('teaRound12').replace('{n}', () => String(view.topics.length))}</p>
          </div>
          <div className="tea-grid">{view.topics.map((x, i) => <Talk key={i} x={x} name={name} />)}</div>
        </section>
      )}

      {view.branches.length > 0 && (
        <section className="tea-sec">
          <div className="tea-rail">
            <div className="tea-cal">{stage(2)}</div>
            <h3><Text unit={view.stages[2]} /></h3>
            <p>{s('teaRound34').replace('{n}', () => String(view.branches.length))}</p>
          </div>
          <div className="tea-grid">
            {view.branches.map((b, i) => (
              <div key={i} className="tea-branch">
                <Talk x={b} name={name} />
                <div className="tea-follow">{b.next.map((n, j) => <Talk key={j} x={n} name={name} />)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(view.win || view.lose || view.poem) && (
        <section className="tea-sec">
          <div className="tea-rail"><h3>{s('teaEnd')}</h3></div>
          <div className="tea-end">
            {view.win && <div><h4>{s('teaWin')}</h4><Text unit={view.win} as="p" /></div>}
            {view.lose && <div><h4>{s('teaLose')}</h4><Text unit={view.lose} as="p" /></div>}
            {view.poem && <Text unit={view.poem} as="p" className="tea-poem" />}
          </div>
        </section>
      )}
    </section>
  );
}

// Same lifecycle as the lore island (LoreTab.tsx): characterDetail unmounts it before every tab render.
let root: Root | null = null;
export function unmountTeaTab() {
  root?.unmount();
  root = null;
}
export function mountTeaTab(container: HTMLElement, char: unknown) {
  unmountTeaTab();
  container.innerHTML = '';
  root = createRoot(container);
  const mounted = root;
  flushSync(() => mounted.render(<StrictMode><TeaTab char={char as { id?: string } & Record<string, unknown>} /></StrictMode>));
}
