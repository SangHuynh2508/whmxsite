import assert from 'node:assert/strict';
import test from 'node:test';

import { audioUrl, loadVoiceDoc, loadVoiceIndex, loadVoiceVi } from './voiceData.mts';
import { GROUP_OF, LABEL_VI, barLevels, groupsOf, parseVolume, packLabel, skinsOf, type VoiceDoc, type VoiceLang, type VoiceLine } from './voiceView.mts';

const ln = (o: Partial<VoiceLine>): VoiceLine => ({ skin: 'A0100001', type: 'regardsLine', order: 2, label: '问候', text: '今日吹的是北风。', key: 'voice/a0100/1001/a0100001_regardsLine.mp3', ...o });
const lang: VoiceLang = { lang: '1001', name: '中文-普通话', cv: '井琉', lines: [
  ln({ type: 'dropLine', order: 1, label: '招集' }),
  ln({}),
  ln({ type: 'touchLine_4', order: 7, text: '', unlock: '感应达到投契解锁' }),
  ln({ type: 'levelUpLine', order: 14, key: null }),
  ln({ type: 'newLine', order: 99, label: '新' }),
  ln({ skin: 'A0100002', type: 'regardsLine' }),
] };

test('44 line types, each with a group and an approved VI label', () => {
  assert.equal(Object.keys(GROUP_OF).length, 44);
  assert.deepEqual(Object.keys(GROUP_OF).sort(), Object.keys(LABEL_VI).sort());
  assert.equal(LABEL_VI.dropLine, 'Chiêu mộ');
  assert.equal(LABEL_VI.strengthenLine_1, 'Tăng Trí Tri');
  assert.equal(LABEL_VI.teaVictoryLine, 'Thưởng trà 1');
});

test('groups in order, numbered across groups, unknown type last', () => {
  const g = groupsOf(lang, 'A0100001');
  assert.deepEqual(g.map((x) => x.id), ['daily', 'growth', 'other']);
  assert.deepEqual(g.flatMap((x) => x.takes.map((t) => [t.n, t.line.type])), [[1, 'dropLine'], [2, 'regardsLine'], [3, 'touchLine_4'], [4, 'levelUpLine'], [5, 'newLine']]);
  assert.equal(g[2].takes[0].vi, '新'); // no VI label: the game's CN label
});

test('no text in game data: no unit, still playable; no mp3: not playable', () => {
  const [daily, growth] = groupsOf(lang, 'A0100001');
  const t = daily.takes[2];
  assert.equal(t.text, null);
  assert.equal(t.playable, true);
  assert.deepEqual(t.unlock, { text: '感应达到投契解锁', untranslated: true });
  assert.equal(growth.takes[0].playable, false);
});

test('skins in data order; one skin filters the lines', () => {
  assert.deepEqual(skinsOf(lang), ['A0100001', 'A0100002']);
  assert.equal(groupsOf(lang, 'A0100002').flatMap((g) => g.takes).length, 1);
});

test('pack label: parenthesis, else the CV', () => {
  assert.deepEqual(packLabel(lang), { name: '中文-普通话', sub: 'CV 井琉' });
  assert.deepEqual(packLabel({ ...lang, name: '古埃及语（女收藏家）' }), { name: '古埃及语', sub: '女收藏家' });
});

test('loaders: bad response or bad id gives null; audio url joins the base', async () => {
  const fail = (async () => new Response('x', { status: 404 })) as typeof fetch;
  const thrown = (async () => { throw new Error('offline'); }) as typeof fetch;
  const ok = (async () => new Response(JSON.stringify({ version: 'r3177', ids: ['A0100'] }))) as typeof fetch;
  assert.equal(await loadVoiceIndex(fail), null);
  assert.equal(await loadVoiceIndex(thrown), null);
  assert.deepEqual(await loadVoiceIndex(ok), { version: 'r3177', ids: ['A0100'] });
  assert.equal(await loadVoiceDoc('../x', ok), null);
  const doc = { asset_base_url: 'https://r2.example/', langs: [] } as unknown as VoiceDoc;
  assert.equal(audioUrl(doc, 'voice/a/1.mp3'), 'https://r2.example/voice/a/1.mp3');
});

test('VI: main key; an alt pack uses its own key, else the main VI when its CN is the same; else CN', () => {
  const alt: VoiceLang = { lang: '1007', name: '古埃及语（女收藏家）', cv: '', lines: [
    ln({ type: 'dropLine', order: 1, label: '招集', text: '另一句。' }),
    ln({ text: ' 今日吹的是北风。 ' }),
  ] };
  const tr = { vi: { 'A0100001.regardsLine': 'Gió bấc.', 'A0100001.dropLine': 'Ta là…' }, unlock: { '感应达到投契解锁': 'Mở khi Đầu Khế' }, main: lang };
  const [daily] = groupsOf(lang, 'A0100001', tr);
  assert.deepEqual(daily.takes[1].text, { text: 'Gió bấc.', untranslated: false });
  assert.equal(daily.takes[1].cn, '今日吹的是北风。');
  assert.deepEqual(daily.takes[2].unlock, { text: 'Mở khi Đầu Khế', untranslated: false });
  const [a] = groupsOf(alt, 'A0100001', tr);
  assert.deepEqual(a.takes[0].text, { text: '另一句。', untranslated: true }); // different CN, no .1007 key
  assert.deepEqual(a.takes[1].text, { text: 'Gió bấc.', untranslated: false }); // same CN (trimmed) → main VI
  const own = groupsOf(alt, 'A0100001', { ...tr, vi: { ...tr.vi, 'A0100001.dropLine.1007': 'Câu riêng' } })[0];
  assert.deepEqual(own.takes[0].text, { text: 'Câu riêng', untranslated: false });
  assert.deepEqual(groupsOf(lang, 'A0100001')[0].takes[1].text, { text: '今日吹的是北风。', untranslated: true }); // no file
});

test('loadVoiceVi: pointer next to the lore pointer → file; any failure → null', async () => {
  const doc = { version: 1, unlock: {}, characters: { A0100: { 'A0100001.regardsLine': 'Gió bấc.' } } };
  const seen: string[] = [];
  const ok = (async (url: string) => { seen.push(url); return new Response(JSON.stringify(url.endsWith('voice.pointer.json') ? { file: 'voice.0123456789ab.json' } : doc)); }) as unknown as typeof fetch;
  assert.deepEqual(await loadVoiceVi('https://cdn.example/lore/lore.pointer.json', ok), doc);
  assert.deepEqual(seen, ['https://cdn.example/lore/voice.pointer.json', 'https://cdn.example/lore/voice.0123456789ab.json']);
  const missing = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  assert.equal(await loadVoiceVi('https://cdn.example/lore/lore.pointer.json', missing), null);
  assert.equal(await loadVoiceVi(undefined, ok), null);
});

test('barLevels: one 0–1 level per bar, low bands on the left, each bar reads its own bins', () => {
  const bins = new Uint8Array(512);
  assert.deepEqual(barLevels(bins, 48), Array(48).fill(0)); // silence
  bins[2] = 255; // ~94 Hz: the first bar only
  const low = barLevels(bins, 48);
  assert.equal(low.length, 48);
  assert.equal(low[0], 1);
  assert.ok(low.slice(1).every((v) => v === 0));
  bins.fill(0); bins[99] = 128; // ~4.6 kHz: the last bar only
  const high = barLevels(bins, 48);
  assert.equal(high[47], 128 / 255);
  assert.ok(high.slice(0, 47).every((v) => v === 0));
});

test('parseVolume: a saved 0–1 level; nothing or junk → 0.6 (the files are loud), out of range → clamped', () => {
  assert.equal(parseVolume(null), 0.6);
  assert.equal(parseVolume('abc'), 0.6);
  assert.equal(parseVolume('0.3'), 0.3);
  assert.equal(parseVolume('0'), 0);
  assert.equal(parseVolume('7'), 1);
  assert.equal(parseVolume('-1'), 0);
});
