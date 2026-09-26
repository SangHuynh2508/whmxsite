import { StrictMode, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/loreTab.css';
import { getSession, isAuthorizedEditor } from '../../../app/auth/session.js';
import { loreOverlayMerged } from '../../../data/loader.js';
import { recordHref } from '../../../admin/characters/lib/route.mts';
import { buildLoreView, type LoreUnit } from './loreView.mts';

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
              {view.relicName && <Text unit={view.relicName} as="p" className="lore-ticket-name" />}
              {view.facts.length > 0 && (
                <div className="lore-facts">
                  {view.facts.map((f, i) => (
                    // the last fact stretches over the empty cells of its row, so the perforation runs the full width
                    <TermPopover key={f.label} name={f.value} detail={f.detail} className="lore-fact"
                      style={i === view.facts.length - 1 && view.facts.length % 3 ? { gridColumn: `span ${4 - (view.facts.length % 3)}` } : undefined}>
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
                        <dd><TermPopover name={view.people.department} detail={view.people.departmentDetail} className="lore-stub-value">{view.people.department}</TermPopover></dd>
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
