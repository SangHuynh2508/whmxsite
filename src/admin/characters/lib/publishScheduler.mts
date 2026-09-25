export type PublishStatus = { state: 'idle' | 'waiting' | 'publishing' | 'done' | 'error'; message: string };
type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void };

// Saves call schedule(); the publish runs once, delayMs after the last save. A publish already
// running on the server (409 busy) is retried after the delay.
export function createPublishScheduler({ delayMs, publish, onStatus, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t as number) } }:
  { delayMs: number; publish: () => Promise<unknown>; onStatus: (s: PublishStatus) => void; timers?: Timers }) {
  let timer: unknown = null;
  const run = async () => {
    timer = null;
    onStatus({ state: 'publishing', message: 'Đang xuất bản…' });
    try {
      await publish();
      onStatus({ state: 'done', message: 'Đã lên site.' });
    } catch (error) {
      if ((error as { status?: number })?.status === 409) return schedule(delayMs);
      onStatus({ state: 'error', message: 'Chưa xuất bản. Bản dịch đã lưu; lưu lại hoặc bấm "Xuất bản ngay".' });
    }
  };
  function schedule(ms: number) {
    if (timer !== null) timers.clear(timer);
    timer = timers.set(() => void run(), ms);
    if (ms > 0) onStatus({ state: 'waiting', message: `Sẽ xuất bản sau ${Math.round(ms / 1000)} giây…` });
  }
  return { schedule: () => schedule(delayMs), now: () => schedule(0) };
}
