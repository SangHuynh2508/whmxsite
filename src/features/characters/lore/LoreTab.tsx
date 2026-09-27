import { StrictMode, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/loreTab.css';
import { getSession, isAuthorizedEditor } from '../../../app/auth/session.js';
import { loreOverlayMerged } from '../../../data/loader.js';
import { recordHref } from '../../../admin/characters/lib/route.mts';
import { buildLoreView, factSize, factSpans, keepTogether, type FactSize, type LoreFact, type LoreUnit } from './loreView.mts';

function Text({ unit, as: Tag = 'span', className }: { unit: LoreUnit | null; as?: 'p' | 'span'; className?: string }) {
  if (!unit) return null;
  return (
    <Tag className={[className, unit.untranslated ? 'lore-cn' : ''].filter(Boolean).join(' ') || undefined} lang={unit.untranslated ? 'zh' : undefined}>
      {unit.text}
      {unit.untranslated && <span className="lore-sr"> (chưa dịch)</span>}
    </Tag>
  );
}

// A term that opens its description (organisation, museum, type, era) in a native popover, like the in-game popups.
function TermPopover({ name, detail, className, style, children }: { name: LoreUnit | string; detail: LoreUnit | null; className: string; style?: CSSProperties; children: ReactNode }) {
  const id = useId();
  if (!detail) return <span className={className} style={style}>{children}</span>;
  return (
    <>
      <button type="button" className={`${className} lore-term`} style={style} popoverTarget={id}>{children}</button>
      <div popover="auto" id={id} className="lore-popover">
        <h4>{typeof name === 'string' ? name : <Text unit={name} />}</h4>
        <Text unit={detail} as="p" className="lore-prose" />
      </div>
    </>
  );
}

let canvas: CanvasRenderingContext2D | null = null;
function textWidth(text: string, el: Element) {
  canvas ??= document.createElement('canvas').getContext('2d');
  if (!canvas) return 0;
  const style = getComputedStyle(el);
  canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const dot = el.classList.contains('lore-cn') ? 11 : 0; // .lore-cn::after: 5px dot + 6px gap
  return canvas.measureText(text).width + dot;
}

// Sizes each fact value against the facts row as it is laid out now (ticket width, fonts), again on resize and
// once the web fonts arrive. Runs before paint, so the first frame already has the final layout.
function useFactSizes(row: RefObject<HTMLDivElement | null>, facts: LoreFact[]): FactSize[] {
  const texts = facts.map((f) => f.value.text);
  const key = texts.join('\u0000');
  const [sizes, setSizes] = useState<FactSize[]>(() => texts.map(() => 'S'));
  useLayoutEffect(() => {
    const box = row.current;
    if (!box) return;
    let live = true;
    const measure = () => {
      const cells = [...box.querySelectorAll('.lore-fact')];
      const values = [...box.querySelectorAll('.lore-fact-value')];
      if (!live || !cells.length || values.length !== texts.length) return;
      const style = getComputedStyle(cells[0]);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const next = values.map((el, i) => factSize(textWidth(texts[i], el), box.clientWidth, padding));
      setSizes((prev) => (prev.join() === next.join() ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    void document.fonts?.ready.then(measure);
    return () => { live = false; observer.disconnect(); };
  }, [key]); // `key` stands for `texts`
  return sizes.length === texts.length ? sizes : texts.map(() => 'S');
}

// Shown text of a fact: a translated value only breaks between words (keepTogether).
const shown = (unit: LoreUnit): LoreUnit => (unit.untranslated ? unit : { ...unit, text: keepTogether(unit.text) });

// A cold deep link renders before the R2 overlay is merged into char.profile; re-render once it is.
function useOverlayRerender() {
  const [, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void loreOverlayMerged().then(() => { if (live) setTick((n) => n + 1); });
    return () => { live = false; };
  }, []);
}

// The recruit line, shown on Tổng Quan (owner 2026-09-26: moved out of the lore tab).
function LoreQuote({ char }: { char: unknown }) {
  useOverlayRerender();
  const quote = buildLoreView(char).quote;
  return quote ? <blockquote className="lore-quote"><Text unit={quote} as="p" /></blockquote> : null;
}

function EditorLink({ id }: { id: string }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    void getSession().then((session: unknown) => { if (live) setAllowed(isAuthorizedEditor(session)); });
    return () => { live = false; };
  }, []);
  return allowed ? <a className="lore-edit" href={recordHref(id, 'lore')}>Sửa trong Admin</a> : null;
}

function LoreTab({ char }: { char: { id?: string } & Record<string, unknown> }) {
  useOverlayRerender();
  const view = buildLoreView(char);
  const [leadOpen, setLeadOpen] = useState(false);
  const [relicPanel, setRelicPanel] = useState<'origin' | 'timeline'>('origin');
  const [report, setReport] = useState(0);

  const factsRow = useRef<HTMLDivElement>(null);
  const facts = view.facts.map((f) => ({ ...f, value: shown(f.value) }));
  const spans = factSpans(useFactSizes(factsRow, facts));
  const current = view.reports[report];
  const hasRelic = Boolean(view.relicIntro || view.timeline.length);
  const hasAside = Boolean(view.archive || view.relicName || view.facts.length || view.people);

  return (
    <div className="lore-wrap">
    <section className={hasAside ? 'lore-tab' : 'lore-tab lore-tab--single'} aria-label="Hồ Sơ Lưu Trữ">
      {hasAside && (
        <aside className="lore-aside">
          {view.archive && (
            <figure className="lore-plate">
              <img src={view.archive.image} alt="Hiện vật" loading="lazy" onError={(e) => { e.currentTarget.closest('figure')?.remove(); }} />
            </figure>
          )}
          {(view.relicName || view.facts.length > 0 || view.people) && (
            <div className="lore-ticket">
              <span className="lore-corner lore-corner--tl" aria-hidden="true" /><span className="lore-corner lore-corner--tr" aria-hidden="true" />
              <span className="lore-corner lore-corner--bl" aria-hidden="true" /><span className="lore-corner lore-corner--br" aria-hidden="true" />
              {view.relicName && <Text unit={view.relicName} as="p" className="lore-ticket-name" />}
              {facts.length > 0 && (
                <div className="lore-facts" ref={factsRow}>
                  {facts.map((f, i) => (
                    // 3, 2 or 1 per row by measured length (factSpans)
                    <TermPopover key={f.label} name={f.value} detail={f.detail} className="lore-fact" style={{ gridColumn: `span ${spans[i]}` }}>
                      <span className="lore-label">{f.label}</span>
                      <Text unit={f.value} className="lore-fact-value" />
                    </TermPopover>
                  ))}
                </div>
              )}
              {view.people && (
                <>
                  {(view.relicName || view.facts.length > 0) && (
                    <div className="lore-tear" aria-hidden="true"><span className="lore-notch lore-notch--l" /><span className="lore-notch lore-notch--r" /></div>
                  )}
                  <dl className="lore-stub">
                    {view.people.department && (
                      <div>
                        <dt className="lore-label">Trực thuộc</dt>
                        <dd><TermPopover name={view.people.department} detail={view.people.departmentDetail} className="lore-stub-value">{keepTogether(view.people.department)}</TermPopover></dd>
                      </div>
                    )}
                    {view.people.status && <div><dt className="lore-label">Bản thể</dt><dd>{view.people.status}</dd></div>}
                    {view.people.recordId && <div className="lore-serial-row"><dt className="lore-label">Mã hồ sơ</dt><dd className="lore-serial">{view.people.recordId}</dd></div>}
                  </dl>
                </>
              )}
            </div>
          )}
          {(view.facts.some((f) => f.detail) || view.people?.departmentDetail) && (
            <p className="lore-footnote">* Bấm vào từng mục trong phiếu để xem ghi chú.</p>
          )}
        </aside>
      )}

      <article className="lore-main">
        <header className="lore-head">
          <h2>Hồ Sơ Lưu Trữ</h2>
          {char.id && <EditorLink id={char.id} />}
        </header>
        {view.hasUntranslated && (
          <p className="lore-notice"><b>Hồ sơ này chưa dịch xong.</b> Đoạn có chấm nhỏ đang hiện bản gốc tiếng Trung.</p>
        )}
        {view.empty && <p className="lore-empty">Chưa có hồ sơ lưu trữ.</p>}

        {view.intro && (
          <div className={leadOpen ? 'lore-lead is-open' : 'lore-lead'}>
            <Text unit={view.intro} as="p" className="lore-prose" />
            <button type="button" className="lore-more" aria-expanded={leadOpen} onClick={() => setLeadOpen((v) => !v)}>{leadOpen ? 'Thu gọn' : 'Đọc tiếp'}</button>
          </div>
        )}

        {hasRelic && (
          <section className="lore-block">
            <h3 className="lore-title">Hiện vật</h3>
            {view.relicIntro && view.timeline.length > 0 && (
              <div className="lore-switch" role="tablist" aria-label="Hiện vật">
                <button type="button" role="tab" aria-selected={relicPanel === 'origin'} onClick={() => setRelicPanel('origin')}>Nguồn gốc</button>
                <button type="button" role="tab" aria-selected={relicPanel === 'timeline'} onClick={() => setRelicPanel('timeline')}>Dòng thời gian</button>
              </div>
            )}
            {(relicPanel === 'origin' || !view.timeline.length) && view.relicIntro
              ? <Text unit={view.relicIntro} as="p" className="lore-prose" />
              : (
                <ol className="lore-timeline">
                  {view.timeline.map((t, i) => (
                    <li key={i}><Text unit={t.label} className="lore-when" /><Text unit={t.story} as="p" className="lore-prose" /></li>
                  ))}
                </ol>
              )}
          </section>
        )}

        {view.reports.length > 0 && current && (
          <section className="lore-block">
            <h3 className="lore-title">Báo cáo đánh giá</h3>
            <div className="lore-tabs" role="tablist" aria-label="Báo cáo đánh giá">
              {view.reports.map((r, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === report} onClick={() => setReport(i)}>
                  {r.special
                    ? (r.title && !r.title.untranslated ? r.title.text : 'Báo cáo mật')
                    : `Báo cáo ${view.reports.slice(0, i + 1).filter((x) => !x.special).length}`}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="lore-report">
              {current.title && <Text unit={current.title} as="p" className="lore-report-title" />}
              {current.unlock && (
                <p className="lore-unlock">Mở khoá ở cảm ứng <b>{current.unlockLevel !== null && `cấp ${current.unlockLevel} · `}<Text unit={current.unlock} /></b></p>
              )}
              <Text unit={current.content} as="p" className="lore-prose" />
            </div>
          </section>
        )}
      </article>
    </section>
    </div>
  );
}

// ponytail: the router clears #character-detail-view with innerHTML when leaving a character; the detached root is
// then freed by the next renderTabContent → unmountLoreTab (one stale tree at most). Hook the router if that ever matters.
let root: Root | null = null;
let quoteRoot: Root | null = null;

// Called before every tab render / character change: frees both islands.
export function unmountLoreTab() {
  root?.unmount();
  root = null;
  quoteRoot?.unmount();
  quoteRoot = null;
}

export function mountLoreQuote(slot: Element | null, char: unknown) {
  quoteRoot?.unmount();
  quoteRoot = null;
  if (!slot) return;
  quoteRoot = createRoot(slot);
  quoteRoot.render(<StrictMode><LoreQuote char={char} /></StrictMode>);
}

export function mountLoreTab(container: HTMLElement, char: unknown) {
  unmountLoreTab();
  container.innerHTML = '';
  root = createRoot(container);
  root.render(<StrictMode><LoreTab char={char as { id?: string } & Record<string, unknown>} /></StrictMode>);
}
