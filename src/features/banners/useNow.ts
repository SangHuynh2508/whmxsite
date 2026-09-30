// One clock per page (spec §3.4): every 30 s — the countdown text has no seconds ("45 phút", "< 1 phút"); paused
// while the tab is hidden and refreshed as soon as it is shown again.
import { useEffect, useState } from 'react';

const TICK_MS = 30_000;

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      if (!document.hidden) timer = window.setTimeout(tick, TICK_MS);
    };
    const onVisible = () => { window.clearTimeout(timer); if (!document.hidden) tick(); };
    timer = window.setTimeout(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return now;
}
