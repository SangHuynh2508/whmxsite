import { StrictMode, useId, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../styles/buildTab.css';
import { getGameData, loadedGameDocument } from '../../../data/loader.js';
import { buildViews, type BuildView, type Unit } from './buildView.mts';

// Function first (owner 2026-09-27): the visual design comes later (huashu + taste on the owner's machine).
function Text({ unit, className }: { unit: Unit; className?: string }) {
  return (
    <span className={[className, unit.untranslated ? 'build-cn' : ''].filter(Boolean).join(' ') || undefined} lang={unit.untranslated ? 'zh' : undefined}>
      {unit.text}
    </span>
  );
}

function Weapon({ weapon }: { weapon: BuildView['weapons'][number] }) {
  const id = useId();
  return (
    <>
      <button type="button" className={`build-weapon build-rare-${weapon.rare}`} popoverTarget={id}>
        {weapon.icon && <img src={weapon.icon} alt="" loading="lazy" />}
        <Text unit={weapon.name} className="build-weapon-name" />
        {weapon.label && <span className="build-weapon-label">{weapon.label}</span>}
      </button>
      <div popover="auto" id={id} className="build-popover">
        <h4><Text unit={weapon.name} /> <span className="build-muted">★{weapon.rare}</span></h4>
        {weapon.skills.map((s, i) => <p key={i}><b><Text unit={s.name} /></b><br /><Text unit={s.text} /></p>)}
      </div>
    </>
  );
}

function BuildTab({ views }: { views: BuildView[] }) {
  const [index, setIndex] = useState(0);
  const v = views[index];
  return (
    <div className="build-tab">
      {views.length > 1 && (
        <div className="build-tabs" role="tablist" aria-label="Các build">
          {views.map((b, i) => <button key={i} type="button" role="tab" aria-selected={i === index} onClick={() => setIndex(i)}>{b.name || `Build ${i + 1}`}</button>)}
        </div>
      )}
      <header className="build-head">
        <h2>{v.name || 'Build'}</h2>
        {v.rating && <span className="build-rating">{v.rating}</span>}
      </header>
      {v.summary && <p className="build-prose">{v.summary}</p>}

      {v.weapons.length > 0 && (
        <section className="build-block"><h3>Vũ khí</h3><div className="build-weapons">{v.weapons.map((w) => <Weapon key={w.id} weapon={w} />)}</div></section>
      )}
      {(v.affixes.groups.length > 0 || v.affixes.noReroll) && (
        <section className="build-block">
          <h3>Dòng thuộc tính</h3>
          {v.affixes.noReroll && <p className="build-muted">Không cần tẩy luyện vũ khí.</p>}
          {v.affixes.groups.map((g, i) => (
            <div key={i} className="build-group">{g.label && <span className="build-group-label">{g.label}</span>}<ol>{g.items.map((a, k) => <li key={k}><Text unit={a} /></li>)}</ol></div>
          ))}
        </section>
      )}
      {v.deepens.length > 0 && (
        <section className="build-block">
          <h3>Thâm tạo</h3>
          {v.deepens.map((d, n) => (
            <div key={n} className="build-group">
              <span className="build-group-label">{d.label && `${d.label} · `}<Text unit={d.style} /> <span className="build-muted">{d.total}/11</span></span>
              <div className="build-columns">
                {d.columns.map((c, i) => (
                  <details key={i} className="build-column">
                    <summary><Text unit={c.name} /> <b>{c.points}</b></summary>
                    <ol>{c.talents.map((t) => <li key={t.point} className={t.reached ? 'is-reached' : undefined}><Text unit={t.text} /></li>)}</ol>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {v.rotations.length > 0 && (
        <section className="build-block">
          <h3>Xoay vòng kỹ năng</h3>
          {v.rotations.map((r, i) => (
            <div key={i} className="build-rotation">
              {r.label && <span className="build-group-label">{r.label}</span>}
              <ol>{r.skills.map((s, k) => <li key={k}>{s.icon && <img src={s.icon} alt="" loading="lazy" />}{s.name}</li>)}</ol>
            </div>
          ))}
        </section>
      )}
      {v.tips.length > 0 && <section className="build-block"><h3>Mẹo</h3><ul className="build-tips">{v.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></section>}
      {(v.teams.length > 0 || v.teamOther) && (
        <section className="build-block">
          <h3>Đội hình</h3>
          {v.teams.map((t, i) => (
            <div key={i} className="build-team">
              {t.label && <span className="build-group-label">{t.label}</span>}
              <div className="build-members">{t.members.map((m) => <a key={m.id} href={m.href} title={m.name}>{m.icon && <img src={m.icon} alt="" loading="lazy" />}<span>{m.name}</span></a>)}</div>
              {t.note && <p className="build-muted">{t.note}</p>}
            </div>
          ))}
          {v.teamOther && <p className="build-prose">Khác: {v.teamOther}</p>}
        </section>
      )}
    </div>
  );
}

// ponytail: same island pattern as LoreTab. The empty state (buildView.js) stays until the game document arrives
// with builds for this character; `generation` drops a late arrival after the tab or character changed.
let root: Root | null = null;
let generation = 0;

export function unmountBuildTab() {
  generation += 1;
  root?.unmount();
  root = null;
}

export function mountBuildTab(container: HTMLElement, char: { id: string }) {
  unmountBuildTab();
  const mine = generation;
  void loadedGameDocument().then((game) => {
    const docs = game?.builds?.[char.id];
    if (mine !== generation || !game || !docs?.length) return;
    const views = buildViews(docs, game, getGameData().characters, char.id);
    container.innerHTML = '';
    root = createRoot(container);
    root.render(<StrictMode><BuildTab views={views} /></StrictMode>);
  });
}
