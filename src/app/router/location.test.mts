import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyHashToPath, navigate, routeString, shouldIntercept } from './location.mts';

const loc = (pathname: string, search = '', hash = '') => ({ pathname, search, hash }) as Location;

test('routeString: path pages look like the old hash, admin keeps its hash', () => {
  assert.equal(routeString(loc('/')), '#/');
  assert.equal(routeString(loc('/characters/sach-kells/build')), '#/characters/sach-kells/build');
  assert.equal(routeString(loc('/calculator', '?char=W0182')), '#/calculator?char=W0182');
  assert.equal(routeString(loc('/characters/')), '#/characters');
  assert.equal(routeString(loc('/', '', '#/admin/characters/A0001')), '#/admin/characters/A0001');
  assert.equal(routeString(loc('/', '', '#/login')), '#/login');
});

test('legacyHashToPath: every old public form', () => {
  assert.equal(legacyHashToPath('#/characters/x/lore'), '/characters/x/lore');
  assert.equal(legacyHashToPath('#/tier-list/a/teams'), '/tier-list/a/teams');
  assert.equal(legacyHashToPath('#/banners?char=A0184&type=limited'), '/banners?char=A0184&type=limited');
  assert.equal(legacyHashToPath('#/music/bgm_map?g=story'), '/music/bgm_map?g=story');
  assert.equal(legacyHashToPath('#/'), '/');
  assert.equal(legacyHashToPath('#calc?char=W0182'), '/calculator?char=W0182');
  assert.equal(legacyHashToPath('#calc'), '/calculator');
  assert.equal(legacyHashToPath('#W0182'), '/calculator?char=W0182');
  assert.equal(legacyHashToPath('#/data'), '/weapons');
  assert.equal(legacyHashToPath('#/gallery-demo'), '/gallery');
  assert.equal(legacyHashToPath('#/admin'), null);
  assert.equal(legacyHashToPath('#/admin/dictionary/weapons'), null);
  assert.equal(legacyHashToPath('#/login'), null);
  assert.equal(legacyHashToPath(''), null);
  assert.equal(legacyHashToPath('#'), null);
});

const ev = (o = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...o });
const a = (href: string, o: { target?: string; download?: boolean; origin?: string } = {}) => ({
  target: o.target ?? '', origin: o.origin ?? 'https://w.app',
  hasAttribute: (n: string) => n === 'download' && !!o.download, getAttribute: (n: string) => (n === 'href' ? href : null),
});

test('shouldIntercept: only plain same-origin path clicks', () => {
  assert.equal(shouldIntercept(ev(), a('/characters/x'), 'https://w.app'), true);
  assert.equal(shouldIntercept(ev({ ctrlKey: true }), a('/characters/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev({ metaKey: true }), a('/characters/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev({ button: 1 }), a('/characters/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev({ defaultPrevented: true }), a('/x'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/x', { target: '_blank' }), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/x', { download: true }), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('https://other.site/x', { origin: 'https://other.site' }), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/api/auth/signin'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/data.json'), 'https://w.app'), false);
  assert.equal(shouldIntercept(ev(), a('/#/admin'), 'https://w.app'), true);
});

test('navigate: a hash change (into or out of the admin) also fires hashchange; a plain path change does not', () => {
  const fired: string[] = [];
  const loc = { pathname: '/', search: '', hash: '#/login' };
  const g = globalThis as any;
  const saved = { location: g.location, history: g.history, dispatchEvent: g.dispatchEvent, HashChangeEvent: g.HashChangeEvent };
  g.location = loc;
  g.history = { pushState: (_: unknown, __: string, url: string) => { const u = new URL(url, 'https://w.app'); Object.assign(loc, { pathname: u.pathname, search: u.search, hash: u.hash }); }, replaceState() {} };
  g.HashChangeEvent = class extends Event {};
  g.dispatchEvent = (e: Event) => { fired.push(e.type); return true; };
  try {
    navigate('/');
    assert.deepEqual(fired, ['hashchange', 'whmx:route']);
    fired.length = 0;
    navigate('/characters');
    assert.deepEqual(fired, ['whmx:route']);
    fired.length = 0;
    navigate('/#/admin');
    assert.deepEqual(fired, ['hashchange', 'whmx:route']);
  } finally { Object.assign(g, saved); }
});
