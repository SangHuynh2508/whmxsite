import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { parseCharactersRoute } from './lib/route.mts';
import { CharacterList } from './CharacterList';
import { CharacterRecord } from './CharacterRecord';

const LIST = '#/admin/characters';
const inCharacters = (hash: string) => hash === LIST || hash.startsWith(`${LIST}/`);
type DirtyFlag = { __whmxAdminDirty?: boolean };

// Khí Giả area: list or record, driven by the hash. Stays mounted (hidden) while another admin area is
// open, so an unsaved draft survives the trip.
export default function CharactersView() {
  const [route, setRoute] = useState(() => parseCharactersRoute(inCharacters(location.hash) ? location.hash : LIST));

  useEffect(() => {
    let last = location.hash;
    const onHash = () => {
      if (location.hash === last) return;
      // Links, the sidebar and browser Back all change the hash; ask before leaving unsaved edits.
      if (inCharacters(last) && (window as DirtyFlag).__whmxAdminDirty && !confirm('Có thay đổi chưa lưu. Rời trang?')) {
        location.hash = last;
        return;
      }
      last = location.hash;
      if (!inCharacters(last)) return;
      const next = parseCharactersRoute(last);
      // Record/module changes cross-fade (View Transitions); instant where unsupported or motion is reduced.
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) setRoute(next);
      else document.startViewTransition(() => flushSync(() => setRoute(next)));
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  return route.view === 'list' ? <CharacterList /> : <CharacterRecord key={route.id} id={route.id} module={route.module} />;
}
