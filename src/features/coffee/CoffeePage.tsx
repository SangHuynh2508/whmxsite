// Quán cà phê page: answer lookup for the event 一日店长 (青琉璃咖啡馆). Only customer (character) names are Vietnamese
// (owner 2026-11-14); recipes, ingredients, hints, tags and slot labels stay Chinese, as the game shows them.
import { StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Search } from 'lucide-react';
import { useLang } from '../../i18n/useLang.ts';
import { s } from '../../i18n/strings.mts';
import type { Lang } from '../../i18n/lang.mts';
import { getGameData } from '../../data/loader.js';
import { getCharacterAvatarUrl } from '../../ui/utils/avatar.mts';
import { cachedCoffee, filterRecipes, loadCoffeeCached, type CoffeeCustomer, type CoffeeDoc, type CoffeeIngredient } from './coffeeData.mts';
import './styles/coffee.css';

const SLOTS = ['基底', '填充', '雪盖'];

const icon = (m: CoffeeIngredient) => <img className="coffee-icon" src={`/coffee/${m.icon}.webp`} alt="" loading="lazy" />;

/** Avatar + name (VI page: Vietnamese; CN page or no translation: Chinese), linked to the character page. */
const customerName = (c: CoffeeCustomer, lang: Lang) => (lang === 'vi' && c.name_vi) || c.name_cn || '？';
const Avatar = ({ c }: { c: CoffeeCustomer }) => {
  const src = c.avatar || getCharacterAvatarUrl((getGameData()?.characters ?? {})[c.id]);
  return src ? <img className="coffee-avatar" src={src} alt="" loading="lazy" /> : <span className="coffee-avatar" aria-hidden />;
};

function Customer({ c, lang }: { c: CoffeeCustomer; lang: Lang }) {
  const body = <><Avatar c={c} />{customerName(c, lang)}</>;
  return c.slug ? <a className="coffee-customer" href={`/characters/${c.slug}`}>{body}</a> : <span className="coffee-customer">{body}</span>;
}

function CoffeePage({ doc }: { doc: CoffeeDoc | null }) {
  const lang = useLang();
  const [q, setQ] = useState('');
  const [who, setWho] = useState(''); // customer name_cn picked in the strip; '' = everyone
  if (!doc) return <div className="coffee-page"><p className="coffee-empty">{s('cfLoadError', lang)}</p></div>;
  const mat = new Map(doc.ingredients.map((m) => [m.id, m]));
  const customers = [...new Map(doc.recipes.map((r) => [r.customer.name_cn, r.customer])).values()]; // game order
  const list = filterRecipes(doc, q).filter((r) => !who || r.customer.name_cn === who);
  return (
    <div className="coffee-page">
      <h1 className="coffee-title">{s('cfTitle', lang)}</h1>
      <p className="coffee-lede">{s('cfLede', lang)}</p>
      <label className="coffee-search">
        <Search size={16} aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s('cfSearch', lang)} aria-label={s('cfSearch', lang)} autoComplete="off" />
      </label>
      <div className="coffee-who" role="group" aria-label={s('cfCustomers', lang)}>
        {customers.map((c) => (
          <button key={c.name_cn} type="button" aria-pressed={who === c.name_cn} onClick={() => setWho(who === c.name_cn ? '' : c.name_cn)}>
            <Avatar c={c} />{customerName(c, lang)}
          </button>
        ))}
      </div>
      <p className="coffee-count">{s('cfCount', lang).replace('{n}', String(list.length)).replace('{t}', String(doc.recipes.length))}</p>

      {list.length ? (
        <ul className="coffee-list">
          {list.map((r) => (
            <li key={r.id} className="coffee-card">
              <p className="coffee-hint" lang="zh">{r.hint_cn}</p>
              <p className="coffee-meta">
                <Customer c={r.customer} lang={lang} />
                <span className="coffee-recipe" lang="zh">{r.name_cn}</span>
                <span>Lv{r.lv}</span>
                <span className="coffee-tags" lang="zh">{r.tags.join(' · ')}</span>
              </p>
              <ol className="coffee-slots">
                {r.mats.map((id, i) => {
                  const m = mat.get(id)!;
                  return (
                    <li key={i}>
                      <span className="coffee-slot" lang="zh">{SLOTS[i]}</span>
                      {icon(m)}
                      <b lang="zh">{m.name_cn}</b>
                      <span className="coffee-tag" lang="zh">{m.tag}</span>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ul>
      ) : <p className="coffee-empty">{s('cfEmpty', lang)}</p>}

      <details className="coffee-mats">
        <summary>{s('cfIngredients', lang).replace('{n}', String(doc.ingredients.length))}</summary>
        <table>
          <tbody>
            {doc.ingredients.map((m) => (
              <tr key={m.id}>
                <td lang="zh">{SLOTS[m.slot - 1]}</td>
                <td>{icon(m)}</td>
                <td lang="zh"><b>{m.name_cn}</b></td>
                <td lang="zh">{m.tag}</td>
                <td>Lv{m.lv}</td>
                <td lang="zh" className="coffee-desc">{m.desc_cn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

let root: Root | null = null;
let generation = 0;
export function unmountCoffeePage() { generation += 1; root?.unmount(); root = null; }
export function mountCoffeePage(container: HTMLElement): Promise<void> {
  unmountCoffeePage();
  const render = (doc: CoffeeDoc | null) => {
    container.innerHTML = '';
    root = createRoot(container);
    flushSync(() => root!.render(<StrictMode><CoffeePage doc={doc} /></StrictMode>));
  };
  const hit = cachedCoffee();
  if (hit) { render(hit); return Promise.resolve(); }
  const mine = generation;
  return loadCoffeeCached().then((doc) => { if (mine === generation) render(doc); });
}
