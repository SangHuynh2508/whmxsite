import { useSyncExternalStore } from 'react';
import { createPublishScheduler, type PublishStatus } from './lib/publishScheduler.mts';
import { publishLore } from './loreApi.js';

let status: PublishStatus = { state: 'idle', message: '' };
const listeners = new Set<() => void>();
export const lorePublisher = createPublishScheduler({ delayMs: 30_000, publish: publishLore, onStatus: (s) => { status = s; listeners.forEach((l) => l()); } });
export const usePublishStatus = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status);
