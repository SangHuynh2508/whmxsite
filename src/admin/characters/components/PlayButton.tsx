import { useEffect, useState } from 'react';

// One player for the page (spec voice-translation §6 V3): starting a line stops the one before. The mp3 lives on R2;
// a missing file only says so — the line can still be translated.
type State = 'idle' | 'playing' | 'failed';
let player: HTMLAudioElement | null = null;
let owner: ((s: State) => void) | null = null;

export function PlayButton({ src }: { src: string }) {
  const [state, setState] = useState<State>('idle');
  useEffect(() => () => { if (owner === setState) { player?.pause(); owner = null; } }, []);
  const toggle = () => {
    const a = (player ??= new Audio());
    if (owner === setState && state === 'playing') { a.pause(); setState('idle'); return; }
    owner?.('idle');
    owner = setState;
    a.onended = () => setState('idle');
    a.onerror = () => setState('failed');
    a.src = src;
    a.play().then(() => setState('playing'), (e: unknown) => { if ((e as Error)?.name !== 'AbortError') setState('failed'); });
  };
  return (
    <button type="button" onClick={toggle} className="hover:text-(--text-main)" aria-pressed={state === 'playing'}>
      {state === 'playing' ? '■ Dừng' : state === 'failed' ? 'Không phát được' : '▶ Nghe'}
    </button>
  );
}
