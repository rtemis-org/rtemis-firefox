const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(new URL('../page-windows.js', `file://${__filename}`), 'utf8');
const action = 'return-to-regular-window';
const tab = { id: 42, windowId: 7 };
const menuVisibility = type => [
  { id: 'open-in-app-window', visible: type === 'normal' },
  { id: 'open-in-full-screen', visible: type === 'normal' || type === 'popup' },
  { id: action, visible: type === 'popup' },
];

function harness({ type = 'popup', state = 'normal', incognito = false, getWindow, createWindow } = {}) {
  const listeners = {};
  const calls = { menus: [], created: [], updated: [], refreshed: 0, errors: [] };
  const event = name => ({ addListener(fn) { listeners[name] = fn; } });
  vm.runInNewContext(source, {
    console: { error(...args) { calls.errors.push(args); } },
    browser: {
      runtime: {},
      windows: {
        get: getWindow || (async () => ({ type, state, incognito })),
        async create(options) {
          calls.created.push(structuredClone(options));
          if (createWindow) await createWindow(options);
        },
      },
      // Deliberately provide no tab navigation, reload, or content-script APIs.
      menus: {
        create(options, callback) { calls.menus.push(structuredClone(options)); callback(); },
        async update(id, options) { calls.updated.push({ id, ...structuredClone(options) }); },
        async refresh() { calls.refreshed++; },
        onShown: event('shown'), onHidden: event('hidden'), onClicked: event('clicked'),
      },
      commands: { onCommand: event('command') },
    },
  });
  return { calls, listeners };
}

test('menu and shortcut transfer the live tab from app and fullscreen windows without navigation', async () => {
  for (const state of ['normal', 'fullscreen']) {
    for (const incognito of [false, true]) {
      for (const trigger of ['menu', 'shortcut']) {
        const h = harness({ state, incognito });
        if (trigger === 'menu') await h.listeners.clicked({ menuItemId: action }, tab);
        else await h.listeners.command(action, tab);
        assert.deepEqual(h.calls.created, [{ tabId: tab.id, type: 'normal', state: 'normal', incognito }]);
        assert.equal(h.calls.errors.length, 0);
      }
    }
  }
});

test('opening menus transfer the current live tab, including private tabs and link contexts', async () => {
  for (const [menuItemId, state] of [['open-in-app-window', 'normal'], ['open-in-full-screen', 'fullscreen']]) {
    for (const incognito of [false, true]) {
      const h = harness({ type: 'normal', incognito });
      await h.listeners.clicked({ menuItemId, linkUrl: 'https://example.org/other-page' }, tab);
      assert.deepEqual(h.calls.created, [{ tabId: tab.id, type: 'popup', state, incognito }]);
      assert.equal(h.calls.errors.length, 0);
    }
  }
});

test('app windows can enter or re-enter fullscreen by transferring the live tab', async () => {
  for (const state of ['normal', 'fullscreen']) {
    for (const incognito of [false, true]) {
      const h = harness({ type: 'popup', state, incognito });
      await h.listeners.clicked({ menuItemId: 'open-in-full-screen' }, tab);
      assert.deepEqual(h.calls.created, [{ tabId: tab.id, type: 'popup', state: 'fullscreen', incognito }]);
      assert.equal(h.calls.errors.length, 0);
    }
  }
});

test('app opening ignores popup windows and competing opening modes share a guard', async () => {
  const popup = harness();
  await popup.listeners.clicked({ menuItemId: 'open-in-app-window' }, tab);
  assert.equal(popup.calls.created.length, 0);

  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const h = harness({ type: 'normal', createWindow: () => pending });
  const first = h.listeners.clicked({ menuItemId: 'open-in-app-window' }, tab);
  await h.listeners.clicked({ menuItemId: 'open-in-full-screen' }, tab);
  assert.equal(h.calls.created.length, 1);
  finish();
  await first;
});

test('regular windows, missing tabs, and unrelated actions are left alone', async () => {
  const normal = harness({ type: 'normal' });
  await normal.listeners.command(action, tab);
  assert.equal(normal.calls.created.length, 0);
  const h = harness();
  await h.listeners.command(action);
  await h.listeners.command(action, { id: -1 });
  await h.listeners.command('unrelated', tab);
  await h.listeners.clicked({ menuItemId: 'unrelated' }, tab);
  assert.equal(h.calls.created.length, 0);
  assert.equal(h.calls.errors.length, 0);
});

test('repeated menu and shortcut activation share one pending transfer', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const h = harness({ createWindow: () => pending });
  const first = h.listeners.command(action, tab);
  await h.listeners.clicked({ menuItemId: action }, tab);
  assert.equal(h.calls.created.length, 1);
  finish();
  await first;
});

test('a rejected transfer is logged and can be retried', async () => {
  let attempts = 0;
  const h = harness({ createWindow: async () => {
    if (++attempts === 1) throw new Error('Window unavailable');
  } });
  await h.listeners.command(action, tab);
  await h.listeners.command(action, tab);
  assert.equal(h.calls.created.length, 2);
  assert.equal(h.calls.errors.length, 1);
});

test('window menus show the applicable actions, including fullscreen and missing-tab contexts', async () => {
  for (const type of ['popup', 'normal', 'panel']) {
    for (const state of ['normal', 'fullscreen']) {
      const h = harness({ type, state });
      assert.equal(h.calls.menus.length, 3);
      assert.ok(h.calls.menus.every(menu => menu.visible === false));
      await h.listeners.shown({}, tab);
      assert.deepEqual(h.calls.updated, menuVisibility(type));
      assert.equal(h.calls.refreshed, 1);
      await h.listeners.shown({}, undefined);
      assert.deepEqual(h.calls.updated.slice(-3), menuVisibility(undefined));
    }
  }
});

test('a late window lookup cannot change a closed or newer context menu', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const h = harness({ getWindow: id => id === 7 ? pending : Promise.resolve({ type: 'normal' }) });
  const first = h.listeners.shown({}, tab);
  h.listeners.hidden();
  await h.listeners.shown({}, { id: 50, windowId: 8 });
  finish({ type: 'popup' });
  await first;
  assert.deepEqual(h.calls.updated, menuVisibility('normal'));
  assert.equal(h.calls.refreshed, 1);
});
