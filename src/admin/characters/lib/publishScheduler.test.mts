import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublishScheduler, type PublishStatus } from './publishScheduler.mts';

function fakeTimers() {
  const pending = new Map<number, () => void>(); let id = 0;
  return { set: (fn: () => void) => { pending.set(++id, fn); return id; }, clear: (t: unknown) => void pending.delete(t as number), flush: async () => { const fns = [...pending.values()]; pending.clear(); for (const fn of fns) fn(); await new Promise((r) => setImmediate(r)); } };
}

test('debounces saves into one publish and reports status', async () => {
  const timers = fakeTimers(); const seen: PublishStatus['state'][] = []; let calls = 0;
  const s = createPublishScheduler({ delayMs: 30_000, publish: async () => { calls += 1; }, onStatus: (st) => seen.push(st.state), timers });
  s.schedule(); s.schedule();
  await timers.flush();
  assert.equal(calls, 1);
  assert.deepEqual(seen, ['waiting', 'waiting', 'publishing', 'done']);
});

test('a busy publish (409) is retried after the delay; other failures report an error', async () => {
  const timers = fakeTimers(); const seen: string[] = []; let calls = 0;
  const s = createPublishScheduler({ delayMs: 30_000, publish: async () => { calls += 1; if (calls === 1) throw Object.assign(new Error('busy'), { status: 409 }); if (calls === 2) throw new Error('R2'); }, onStatus: (st) => seen.push(st.state), timers });
  s.now(); await timers.flush(); await timers.flush();
  assert.equal(calls, 2);
  assert.deepEqual(seen, ['publishing', 'waiting', 'publishing', 'error']);
});

test('leaving the page with a publish still waiting sends it right away (keepalive), exactly once', async () => {
  const timers = fakeTimers(); let calls = 0; let leaveCalls = 0;
  const s = createPublishScheduler({ delayMs: 30_000, publish: async () => { calls += 1; }, publishOnLeave: () => { leaveCalls += 1; }, onStatus: () => {}, timers });
  s.leave();
  assert.equal(leaveCalls, 0, 'nothing waiting → nothing sent');
  s.schedule();
  s.leave();
  assert.equal(leaveCalls, 1);
  await timers.flush();
  assert.equal(calls, 0, 'the timer was cleared, so the normal publish does not run twice');
});
