import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topVisible } from './scrollSpy.mts';

const LINE = 112; // top edge of the observed band (phones: record header + unit bar)

test('a unit already in view stays the active one when a lower unit enters (smooth scroll)', () => {
  const top: Record<string, number> = { label: 112, story: 293 };
  const visible = new Set<string>();
  // While scrolling, "label" enters first; later only "story" changes — its batch alone must not win.
  assert.equal(topVisible(visible, [{ target: 'label', isIntersecting: true }], (k) => top[k], LINE), 'label');
  assert.equal(topVisible(visible, [{ target: 'story', isIntersecting: true }], (k) => top[k], LINE), 'label');
});

test('the unit crossing the band edge wins over a taller one above it that still touches the band', () => {
  const top: Record<string, number> = { label: -68, story: 112 };
  const visible = new Set(['label', 'story']);
  assert.equal(topVisible(visible, [], (k) => top[k], LINE), 'story');
});

test('with every visible unit below the edge, the highest one is active', () => {
  const top: Record<string, number> = { a: 300, b: 520 };
  assert.equal(topVisible(new Set(['b', 'a']), [], (k) => top[k], LINE), 'a');
});

test('a unit that leaves the band hands over to the next one', () => {
  const top: Record<string, number> = { label: 50, story: 293 };
  const visible = new Set(['label', 'story']);
  assert.equal(topVisible(visible, [{ target: 'label', isIntersecting: false }], (k) => top[k], LINE), 'story');
  assert.equal(topVisible(visible, [{ target: 'story', isIntersecting: false }], (k) => top[k], LINE), undefined);
});
