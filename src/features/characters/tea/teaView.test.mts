import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTeaView } from './teaView.mts';

const ex = (ask: string, reply: string, extra: Record<string, unknown> = {}) => ({ ask, ask_vi: null, reply, reply_vi: null, reaction: null, ...extra });
const char = {
  skins: [{ is_base: false, image: 'https://r2/2.webp' }, { is_base: true, image: 'https://r2/1.webp' }],
  profile: { tea: {
    teas: [{ code: '81009', name: '杏皮茶', name_vi: 'Trà vỏ mơ', desc: '西北饮品', desc_vi: null, comment: '冰的', comment_vi: null }],
    stages: [{ cn: '缘起', vi: null }, { cn: '相知', vi: 'Tương tri' }, { cn: '', vi: null }],
    topics: [ex('夜市', 'player，来吧', { ask_vi: 'Chợ đêm', reaction: 'like' }), ex('演唱会', '（无人回应。）', { reply_vi: '(Không ai đáp.)', reaction: 'puzzled' })],
    branches: [{ ...ex('酒馆', '你猜？'), next: [ex('随心', '不错', { reaction: 'like' }), ex('真样', '虚妄', { reaction: 'bogus' })] }],
    win: '好茶', win_vi: null, lose: '', lose_vi: null, result: { cn: '瓦铫煮春雪\n淡香生古瓷', vi: null },
  } },
};

test('builds the tab: base drawing, tea icon, stages with CN fallback, reactions, narration from the CN', () => {
  const v = buildTeaView(char)!;
  assert.equal(v.drawing, 'https://r2/1.webp');
  assert.deepEqual(v.teas[0], { icon: 'assets/items/itemicon_81009.png', name: { text: 'Trà vỏ mơ', untranslated: false }, cn: '杏皮茶', desc: { text: '西北饮品', untranslated: true }, comment: { text: '冰的', untranslated: true } });
  assert.deepEqual(v.stages.map((s) => s.text), ['缘起', 'Tương tri', '契合']);
  assert.deepEqual(v.topics[0], { ask: { text: 'Chợ đêm', untranslated: false }, askCn: '夜市', reply: { text: 'player，来吧', untranslated: true }, narration: false, reaction: 'like' });
  assert.equal(v.topics[1].narration, true); // decided on the CN even though the VI uses ASCII brackets
  assert.deepEqual(v.branches[0].next.map((n) => n.reaction), ['like', null]); // unknown values are dropped
  assert.equal(v.branches[0].reaction, null);
  assert.equal(v.lose, null);
  assert.deepEqual(v.poem, { text: '瓦铫煮春雪\n淡香生古瓷', untranslated: true });
  assert.equal(v.hasUntranslated, true);
});

test('nothing translated, no hightea row, no tea data', () => {
  const bare = { profile: { tea: { teas: [], stages: [], topics: [ex('夜市', '来吧')], branches: [], win: '', win_vi: null, lose: '', lose_vi: null, result: null } } };
  const v = buildTeaView(bare)!;
  assert.deepEqual(v.teas, []);
  assert.equal(v.drawing, null);
  assert.deepEqual(v.stages.map((s) => [s.text, s.untranslated]), [['缘起', true], ['相知', true], ['契合', true]]);
  assert.equal(v.poem, null);
  assert.equal(buildTeaView({ profile: {} }), null);
  assert.equal(buildTeaView({}), null);
  assert.equal(buildTeaView({ profile: { tea: { teas: [], topics: [], branches: [] } } }), null);
});
