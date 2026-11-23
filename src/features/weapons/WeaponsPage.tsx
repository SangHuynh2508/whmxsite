// Vũ Khí page (owner 2026-11-23): /weapons = every weapon in one filterable grid; /weapons/<id> = one weapon
// (art, stats per breakthrough, skills, file, the characters whose builds suggest it). Names and skills come from
// the game document (VI once published); stats, file and art from public/weapons.json (tools/build_weapons.py).
import { StrictMode, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { ArrowLeft, Search } from 'lucide-react';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import { JOB_NAMES, jobName } from '../../ui/utils/gameLabels.mts';
import { Text } from '../characters/build/Text.tsx';
import { getGameData, loadedGameDocument } from '../../data/loader.js';
import type { GameDocument } from '../profile/api/loreOverlay.mts';
import { filterWeapons, statRows, weaponList, type Weapon, type WeaponsDoc } from './weaponsView.mts';
import './weapons.css';

const RARES = [5, 4, 3, 2];
const toggled = (set: Set<number>, v: number) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };
const FILE_ROWS = [['type', 'wpFileType'], ['class', 'wpFileClass'], ['trait', 'wpFileTrait'], ['maker', 'wpFileMaker'], ['weight', 'wpFileWeight'], ['batch', 'wpFileBatch']] as const;

function Tile({ w, size = 'md' }: { w: Weapon; size?: 'md' | 'lg' }) {
  return <span className={`wp-tile wp-tile-${size}`} style={{ backgroundImage: `url(${w.frame})` }}>{w.icon && <img src={w.icon} alt="" loading="lazy" />}</span>;
}
const JobLine = ({ job }: { job: number }) => (JOB_NAMES[job] ? <span className="wp-job"><img src={`/assets/jobs/job_${job}.png`} alt="" />{jobName(job)}</span> : null);

function WeaponDetail({ w }: { w: Weapon }) {
  const x = w.extra;
  const rows = statRows(x);
  const file = x?.file ?? {};
  return (
    <article className="wp-detail" data-rare={w.rare}>
      <a href="/weapons" className="wp-back"><ArrowLeft size={16} aria-hidden="true" />{s('ifWeapons')}</a>
      <div className="wp-hero-detail">
        <figure className="wp-art">{w.art ? <img src={w.art} alt="" /> : <Tile w={w} size="lg" />}</figure>
        <div className="wp-intro">
          <p className="wp-stars" aria-label={`${w.rare}★`}>{'★'.repeat(w.rare)}</p>
          <h1><Text unit={w.name} /></h1>
          {!w.name.untranslated && w.cn && <p className="wp-cn" lang="zh">{w.cn}</p>}
          <JobLine job={w.job} />
          {w.skills.map((k, i) => (
            <section key={i} className="wp-skill">
              <h2><span>{s('wpSkill')}</span><Text unit={k.name} /></h2>
              <p><Text unit={k.text} /></p>
            </section>
          ))}
        </div>
      </div>

      <div className="wp-cols">
        {rows.length > 0 && (
          <section className="wp-block">
            <h2>{s('wpStats')}</h2>
            <table className="wp-stats">
              <thead><tr><th scope="col">{s('wpGrade')}</th><th scope="col">Lv.</th><th scope="col">HP</th><th scope="col">ATK</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} data-max={r.level > 1 || undefined}><td>{r.grade}</td><td>{r.level}</td><td>{r.hp.toLocaleString()}</td><td>{r.atk.toLocaleString()}</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}
        {Object.keys(file).length > 0 && (
          <section className="wp-block">
            <h2>{s('wpFile')}</h2>
            <dl className="wp-file">{FILE_ROWS.filter(([k]) => file[k]).map(([k, label]) => (
              <div key={k}><dt>{s(label)}</dt><dd lang={k === 'weight' || k === 'batch' ? undefined : 'zh'}>{file[k]}</dd></div>
            ))}</dl>
            {file.text && <p className="wp-file-text" lang="zh">{file.text}</p>}
          </section>
        )}
      </div>

      <section className="wp-block">
        <h2>{s('wpUsers')}</h2>
        {w.users.length ? <div className="wp-user-list">{w.users.map((u) => (
          <a key={u.id} href={u.href}>{u.icon && <img src={u.icon} alt="" loading="lazy" />}<span>{u.name}</span></a>
        ))}</div> : <p className="wp-none">{s('wpNoUsers')}</p>}
      </section>
    </article>
  );
}

function WeaponList({ all }: { all: Weapon[] }) {
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState<Set<number>>(new Set());
  const [rares, setRares] = useState<Set<number>>(new Set());
  const shown = filterWeapons(all, { q, jobs, rares });
  return (
    <>
      <header className="wp-hero">
        <h1>{s('ifWeapons')}</h1>
        <span>{s('wpCount').replace('{n}', String(all.length))}</span>
      </header>
      <div className="wp-bar">
        <label className="wp-search"><Search size={16} aria-hidden="true" />
          <input type="search" value={q} placeholder={s('wpSearch')} aria-label={s('wpSearch')} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="wp-chips" role="group" aria-label={s('catJob')}>
          {Object.keys(JOB_NAMES).map(Number).map((j) => (
            <button key={j} type="button" aria-pressed={jobs.has(j)} onClick={() => setJobs(toggled(jobs, j))}>
              <img src={`/assets/jobs/job_${j}.png`} alt="" />{jobName(j)}
            </button>
          ))}
        </div>
        <div className="wp-chips" role="group" aria-label={s('catRarity')}>
          {RARES.map((r) => (
            <button key={r} type="button" data-rare={r} aria-pressed={rares.has(r)} onClick={() => setRares(toggled(rares, r))}>{r}★</button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <ul className="wp-grid">
          {shown.map((w) => (
            <li key={w.id}>
              <a href={`/weapons/${w.id}`} className="wp-card" data-rare={w.rare}>
                <Tile w={w} />
                <span className="wp-name"><Text unit={w.name} /></span>
                <span className="wp-sub"><JobLine job={w.job} /></span>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="wp-empty">{s('wpEmpty')}</p>}
    </>
  );
}

function WeaponsPage({ game, extras, id }: { game: GameDocument | null; extras: WeaponsDoc | null; id: string }) {
  const lang = useLang();
  const all = useMemo(() => (game ? weaponList(game, getGameData()?.characters ?? {}, extras) : []), [game, extras, lang]);
  if (!game) return <div className="wp-page"><p className="wp-empty">{s('wpLoadError')}</p></div>;
  const one = id ? all.find((w) => w.id === id) : null;
  return <div className="wp-page">{id ? (one ? <WeaponDetail w={one} /> : <p className="wp-empty">{s('wpEmpty')}</p>) : <WeaponList all={all} />}</div>;
}

let extrasLoad: Promise<WeaponsDoc | null> | null = null;
const loadExtras = () => (extrasLoad ??= fetch('/weapons.json').then((r) => (r.ok ? r.json() : null)).catch(() => { extrasLoad = null; return null; }));

let root: Root | null = null;
let generation = 0;
export function unmountWeaponsPage() { generation += 1; root?.unmount(); root = null; }
export function mountWeaponsPage(container: HTMLElement, id = ''): Promise<void> {
  unmountWeaponsPage();
  const mine = generation;
  container.innerHTML = '';
  const mounted = createRoot(container);
  root = mounted;
  // The game document comes from R2 and can take a few seconds on a cold load: say so instead of a blank page.
  flushSync(() => mounted.render(<div className="wp-page"><p className="wp-empty">{s('wpLoading')}</p></div>));
  return Promise.all([Promise.resolve(loadedGameDocument()).catch(() => null), loadExtras()]).then(([game, extras]) => {
    if (mine !== generation) return;
    flushSync(() => mounted.render(<StrictMode><WeaponsPage game={game} extras={extras} id={id} /></StrictMode>));
  });
}
