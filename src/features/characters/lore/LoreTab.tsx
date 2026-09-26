import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/loreTab.css';
import { getSession, isAuthorizedEditor } from '../../../app/auth/session.js';
import { recordHref } from '../../../admin/characters/lib/route.mts';
import { buildLoreView, type LoreUnit } from './loreView.mts';

function Text({ unit, as: Tag = 'p' }: { unit: LoreUnit | null; as?: 'p' | 'span' | 'h3' }) {
  if (!unit) return null;
  return (
    <Tag className="lore-text" lang={unit.untranslated ? 'zh' : 'vi'}>
      {unit.text}
      {unit.untranslated && <span className="lore-untranslated">Chưa dịch</span>}
    </Tag>
  );
}

function EditorLink({ id }: { id: string }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    void getSession().then((session: unknown) => { if (live) setAllowed(isAuthorizedEditor(session)); });
    return () => { live = false; };
  }, []);
  return allowed ? <a className="lore-edit-link" href={recordHref(id, 'lore')}>Sửa trong Admin</a> : null;
}

function LoreTab({ char }: { char: { id?: string } & Record<string, unknown> }) {
  const view = buildLoreView(char);
  return (
    <section className="lore-tab" aria-label="Hồ Sơ Lưu Trữ">
      <header className="lore-tab-header">
        <h2>Hồ Sơ Lưu Trữ</h2>
        {char.id && <EditorLink id={char.id} />}
      </header>
      {view.empty && <p className="lore-empty">Chưa có hồ sơ lưu trữ.</p>}
      {view.archive && (
        <figure className="lore-archive">
          <img src={view.archive.image} alt="Hiện vật" loading="lazy" onError={(e) => { e.currentTarget.closest('figure')?.remove(); }} />
        </figure>
      )}
      {view.facts.length > 0 && (
        <dl className="lore-facts">
          {view.facts.map((f) => (<div key={f.label}><dt>{f.label}</dt><dd><Text unit={f.value} as="span" /></dd></div>))}
        </dl>
      )}
      <Text unit={view.intro} />
      {view.reports.map((r, i) => (
        <article key={i} className={r.special ? 'lore-report lore-report-special' : 'lore-report'}>
          <Text unit={r.title} as="h3" />
          {r.unlock && <p className="lore-unlock">Mở khoá: <Text unit={r.unlock} as="span" />{r.unlockLevel !== null && ` (cấp ${r.unlockLevel})`}</p>}
          <Text unit={r.content} />
        </article>
      ))}
      <Text unit={view.relicIntro} />
      {view.timeline.length > 0 && (
        <ol className="lore-timeline">
          {view.timeline.map((t, i) => (<li key={i}><Text unit={t.label} as="span" /><Text unit={t.story} /></li>))}
        </ol>
      )}
    </section>
  );
}

// ponytail: the router clears #character-detail-view with innerHTML when leaving a character; the detached root is
// then freed by the next renderTabContent → unmountLoreTab (one stale tree at most). Hook the router if that ever matters.
let root: Root | null = null;

export function unmountLoreTab() {
  root?.unmount();
  root = null;
}

export function mountLoreTab(container: HTMLElement, char: unknown) {
  unmountLoreTab();
  container.innerHTML = '';
  root = createRoot(container);
  root.render(<StrictMode><LoreTab char={char as { id?: string } & Record<string, unknown>} /></StrictMode>);
}
