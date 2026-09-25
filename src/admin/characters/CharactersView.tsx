import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { parseCharactersRoute } from './lib/route.mts';
import { CharacterList } from './CharacterList';
import { CharacterRecord } from './CharacterRecord';
import { LoreTermsView } from './LoreTermsView';

const LIST = '#/admin/characters';
const inCharacters = (hash: string) => hash === LIST || hash.startsWith(`${LIST}/`);

// Khí Giả area: list or record, driven by the hash. Stays mounted (hidden) while another admin area is
// open, so an unsaved draft survives the trip.
export default function CharactersView() {
  const [route, setRoute] = useState(() => parseCharactersRoute(inCharacters(location.hash) ? location.hash : LIST));

  useEffect(() => {
    // Unsaved-edit prompts live in AdminApp's capture-phase guard (src/admin/layout/lib/leaveGuard.mts).
    const onHash = () => {
      if (!inCharacters(location.hash)) return;
      const next = parseCharactersRoute(location.hash);
      // Record/module changes cross-fade (View Transitions); instant where unsupported or motion is reduced.
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) setRoute(next);
      // A newer hash change skips the running transition; its `ready` rejection is expected, not an error.
      else document.startViewTransition(() => flushSync(() => setRoute(next))).ready.catch(() => {});
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (route.view === 'list') return <CharacterList />;
  if (route.view === 'terms') return <LoreTermsView code={route.code} />;
  return <CharacterRecord key={route.id} id={route.id} module={route.module} />;
}
