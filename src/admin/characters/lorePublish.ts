import { useSyncExternalStore } from 'react';
import { createPublishScheduler, type PublishStatus } from './lib/publishScheduler.mts';
import { publishLore } from './loreApi.js';

let status: PublishStatus = { state: 'idle', message: '' };
const listeners = new Set<() => void>();
export const lorePublisher = createPublishScheduler({
  delayMs: 30_000,
  publish: publishLore,
  // keepalive lets the request finish after the tab closes; errors can't be shown any more, the next save retries.
  publishOnLeave: () => publishLore({ keepalive: true }).catch(() => {}),
  onStatus: (s) => { status = s; listeners.forEach((l) => l()); },
});
// Closing/reloading the admin within the 30 s wait used to drop the publish (the timer lived in the page).
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => lorePublisher.leave());
export const usePublishStatus = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status);
