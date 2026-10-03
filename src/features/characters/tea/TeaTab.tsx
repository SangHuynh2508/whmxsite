import { StrictMode, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/teaTab.css';
import { Text, useOverlayRerender } from '../lore/LoreTab.tsx';
import { useReveal } from '../motion';
import { buildTeaView, type Exchange } from './teaView.mts';

// Look D2 (docs/public-redesign/tea-room/direction-approved.md): moon window + favourite teas on top, then the talk.
const REACTION = { like: { src: 'assets/tea/react_like.png', alt: 'Khí giả thích chủ đề này' }, puzzled: { src: 'assets/tea/react_puzzled.png', alt: 'Khí giả bối rối' } } as const;
const STAGE_IMG = ['assets/tea/stage_1.png', 'assets/tea/stage_2.png', 'assets/tea/stage_3.png'];

function Reply({ x, name }: { x: Exchange; name: string }) {
  const rx = x.reaction ? REACTION[x.reaction] : null;
  return (
    <div className={x.narration ? 'tea-box tea-box--narr' : 'tea-box'}>
      {!x.narration && <span className="tea-plaque">{name}</span>}
      {rx && <span className="tea-react"><img src={rx.src} alt={rx.alt} /></span>}
      <Text unit={x.reply} as="p" />
    </div>
  );
}

function Talk({ x, name }: { x: Exchange; name: string }) {
  return (
    <div className="tea-ex">
      <p className="tea-opt">
        <span><Text unit={x.ask} className="tea-opt-vi" />{!x.ask.untranslated && <span className="tea-opt-cn" lang="zh">{x.askCn}</span>}</span>
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
  const name = char.name_vi || char.name_cn || '';
  if (!view) return <section className="tea-tab" aria-label="Phòng Trà"><p className="tea-empty">Chưa có dữ liệu phòng trà.</p></section>;
  const tea = view.teas[Math.min(picked, view.teas.length - 1)];
  const stage = (i: number) => <img src={STAGE_IMG[i]} alt="" />;

  return (
    <section ref={tabRef} className="tea-tab" aria-label="Phòng Trà">
      {view.hasUntranslated && <p className="lore-notice"><b>Phòng trà chưa dịch xong.</b> Đoạn có chấm nhỏ đang hiện bản gốc tiếng Trung.</p>}
      {(view.drawing || tea) && (
        <div className={view.drawing ? 'tea-band' : 'tea-band tea-band--no-art'}>
          {view.drawing && <div className="tea-moon"><img src={view.drawing} alt="" loading="lazy" /></div>}
          {tea && (
            <>
              <div className="tea-list">
                <h2>Trà yêu thích</h2>
                <p className="tea-hint">Mời đúng loại trà, khí giả sẽ bình về nó.</p>
                <div role="tablist" aria-label="Trà yêu thích" className="tea-shelf">
                  {view.teas.map((t, i) => (
                    <button key={t.cn} type="button" role="tab" aria-selected={t === tea} className="tea-jar" onClick={() => setPicked(i)}>
                      <img src={t.icon} alt="" loading="lazy" />
                      <span><Text unit={t.name} className="tea-jar-name" />{!t.name.untranslated && <span className="tea-jar-cn" lang="zh">{t.cn}</span>}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div role="tabpanel" className="tea-detail" ref={detailRef}>
                <img src={tea.icon} alt="" />
                <h3><Text unit={tea.name} />{!tea.name.untranslated && <span className="tea-detail-cn" lang="zh">{tea.cn}</span>}</h3>
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
            <p>Câu 1 và câu 2. Mỗi câu, game hiện 3 trong {view.topics.length} chủ đề.</p>
          </div>
          <div className="tea-grid">{view.topics.map((x, i) => <Talk key={i} x={x} name={name} />)}</div>
        </section>
      )}

      {view.branches.length > 0 && (
        <section className="tea-sec">
          <div className="tea-rail">
            <div className="tea-cal">{stage(2)}</div>
            <h3><Text unit={view.stages[2]} /></h3>
            <p>Câu 3 và câu 4. Game hiện {view.branches.length} chủ đề, chủ đề đã chọn mở ra 2 câu tiếp.</p>
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
          <div className="tea-rail"><h3>Kết thúc tiệc trà</h3></div>
          <div className="tea-end">
            {view.win && <div><h4>Khi thành công</h4><Text unit={view.win} as="p" /></div>}
            {view.lose && <div><h4>Khi thất bại</h4><Text unit={view.lose} as="p" /></div>}
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
