import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseAttr, resolveSkillText } from './weapon-skill-text.mjs';

const skills = JSON.parse(readFileSync(new URL('../fixtures/masterdata/equipmentSkills.json', import.meta.url), 'utf8'));
const levels = (groupId) => skills.filter((s) => s.GroupId === groupId).sort((a, b) => a.Level - b.Level);

test('parseAttr: "Name,type,v1,v2" rows → name → values (like build_web_data.py parse_attr)', () => {
  assert.deepEqual(parseAttr([['Effect1Para,string,10'], ['Effect1,string,AddPropertyFixed,CommonAttackDmgIncrease,#1'], ['Trigger,string,']]), {
    Effect1Para: ['10'],
    Effect1: ['AddPropertyFixed', 'CommonAttackDmgIncrease', '#1'],
    Trigger: [''],
  });
  assert.deepEqual(parseAttr(null), {});
});

test('ED2031 (6 levels, one template): every level value joined, unit kept once per value, colour tags removed', () => {
  assert.equal(levels('ED2031').length, 6);
  assert.equal(resolveSkillText(levels('ED2031')), '装备者常击造成的伤害提高10%/11%/12%/13%/14%/15%。');
});

test('one level: the value is filled in', () => {
  assert.equal(resolveSkillText(levels('ED2031').slice(0, 1)), '装备者常击造成的伤害提高10%。');
});

test('same value on every level is written once', () => {
  const one = levels('ED2031')[0];
  assert.equal(resolveSkillText([one, { ...one, Level: 2 }]), '装备者常击造成的伤害提高10%。');
});

test('a parameter missing from Attr stays as the raw token (like the Python tool)', () => {
  const row = { DescriptionLanText: '提高[Effect9Para,1]%', Attr: [['Effect1Para,string,10']] };
  assert.equal(resolveSkillText([row]), '提高[Effect9Para,1]%');
});

test('{Buff_…} markers are dropped', () => {
  const row = { DescriptionLanText: '获得{Buff_Shield}护盾[Effect1Para,1]点', Attr: [['Effect1Para,string,300']] };
  assert.equal(resolveSkillText([row]), '获得护盾300点');
});

test('templates that differ between levels: one "Lv.n:" line per level', () => {
  const a = { DescriptionLanText: '提高[Effect1Para,1]%', Attr: [['Effect1Para,string,5']] };
  const b = { DescriptionLanText: '提高[Effect1Para,1]%，并回复[Effect2Para,1]点', Attr: [['Effect1Para,string,6'], ['Effect2Para,string,50']] };
  assert.equal(resolveSkillText([a, b]), 'Lv.1: 提高5%\nLv.2: 提高6%，并回复50点');
});

test('no description (e.g. ED4035 in the fixtures) → empty text', () => {
  assert.equal(levels('ED4035').length, 6);
  assert.equal(resolveSkillText(levels('ED4035')), '');
});

test('every weapon skill group in the fixtures resolves without a leftover token', () => {
  const groups = [...new Set(skills.map((s) => s.GroupId))];
  const leftovers = groups.filter((g) => /\[[A-Za-z0-9_]+,\d*\]/.test(resolveSkillText(levels(g))));
  assert.deepEqual(leftovers, []);
});
