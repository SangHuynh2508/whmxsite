// The large image of the Thư viện ảnh viewer (spec 2026-11-17 "Tải ảnh to"; direction-approved.md round 4): fetched
// with progress and shown only when whole and decoded — sharp at once, never a blurry thumb that sharpens.
export type Progress = (p: number) => void; // 0..1, or -1 when the size is unknown

export async function fetchBlob(url: string, onProgress: Progress, fetchImpl: typeof fetch = fetch): Promise<Blob> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) { onProgress(-1); return res.blob(); }
  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  return new Blob(parts, { type: res.headers.get('content-type') || 'image/webp' });
}

const MAX = 24; // ponytail: object URLs of the last 24 large images stay (≈0.3–1 MB each); older ones are revoked
const cache = new Map<string, Promise<string>>(); // insertion order = least recently used first
const listeners = new Map<string, Set<Progress>>();

async function decoded(src: string) {
  if (typeof Image === 'undefined') return;
  const im = new Image();
  im.src = src;
  await im.decode().catch(() => {});
}
/** Fetch blocked (R2 without a CORS rule, a proxy): the <img> still loads it, only without a percentage. */
const viaImg = (url: string) => new Promise<string>((ok, no) => {
  const im = new Image();
  im.onload = () => ok(url);
  im.onerror = () => no(new Error('image failed'));
  im.src = url;
});

export function loadImage(url: string, onProgress: Progress = () => {}, fetchImpl: typeof fetch = fetch): Promise<string> {
  const set = listeners.get(url) ?? new Set<Progress>();
  listeners.set(url, set);
  set.add(onProgress);
  let p = cache.get(url);
  if (p) cache.delete(url); // re-inserted below as the most recent
  else {
    const tell: Progress = (x) => listeners.get(url)?.forEach((f) => f(x));
    p = fetchBlob(url, tell, fetchImpl).then(
      async (blob) => { const src = URL.createObjectURL(blob); await decoded(src); return src; },
      (e) => { if (!(e instanceof TypeError)) throw e; tell(-1); return viaImg(url); },
    );
    p.catch(() => cache.delete(url));
  }
  cache.set(url, p);
  while (cache.size > MAX) {
    const [old, q] = cache.entries().next().value!;
    cache.delete(old);
    q.then((src) => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); }, () => {});
  }
  return p.finally(() => set.delete(onProgress));
}

