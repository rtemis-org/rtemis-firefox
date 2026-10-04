const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const script = readFileSync(join(__dirname, '../newtab/news.js'), 'utf8');
const feeds = ['top', 'new', 'best', 'ask', 'show'];
const paths = ['/', '/newest', '/best', '/ask', '/show'];
const endpoints = ['topstories', 'newstories', 'beststories', 'askstories', 'showstories'];
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function cached(title) {
  return { fetchedAt: Date.now(), items: [{ id: 99, title, url: 'https://example.org', domain: 'example.org', score: 5, comments: 2, hn: 'https://news.ycombinator.com/item?id=99' }] };
}
async function harness({ storage = { newsEnabled: true }, fetchJSON } = {}) {
  const state = structuredClone(storage);
  const requests = [];
  const elements = new Map();
  let focused;
  function node(tag) {
    const classes = new Set();
    return { tag, dataset: {}, attributes: {}, children: [], textContent: '', hidden: false,
      scrollTop: 0, scrollHeight: 100, clientHeight: 100, listeners: {},
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle(c, on) { on ? classes.add(c) : classes.delete(c); } },
      setAttribute(k, v) { this.attributes[k] = v; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      focus() { focused = this; },
    };
  }
  function element(id) { if (!elements.has(id)) elements.set(id, node(id)); return elements.get(id); }
  const buttons = feeds.map(feed => { const n = node('button'); n.dataset.feed = feed; n.attributes['aria-pressed'] = String(feed === 'top'); return n; });
  element('news-feeds').querySelectorAll = () => buttons;
  element('news-title').href = 'https://news.ycombinator.com/';
  element('news').hidden = true;
  element('news-show').hidden = true;
  const context = vm.createContext({
    console: { warn() {} }, URL, Date, AbortController,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => fn(),
    window: { addEventListener() {} },
    document: { hidden: false, createElement: node, getElementById: element,
      querySelector: () => element('hero'), addEventListener() {} },
    browser: { storage: { local: {
      async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, structuredClone(state[k])])); },
      async set(values) { Object.assign(state, structuredClone(values)); },
    } } },
    fetch: async url => {
      requests.push(url);
      const json = async () => {
        if (fetchJSON) return fetchJSON(url);
        const endpoint = url.match(/\/([a-z]+stories)\.json/);
        if (endpoint) return [endpoints.indexOf(endpoint[1]) + 1];
        const id = Number(url.match(/\/item\/(\d+)\.json/)[1]);
        return { id, type: 'story', title: `${feeds[id - 1]} item`, url: id === 4 ? undefined : 'https://example.org/item', score: 12, descendants: 3 };
      };
      return { ok: true, json };
    },
  });
  vm.runInContext(script, context);
  await settle();
  return { state, requests, element, buttons, context, focused: () => focused,
    async click(id) { await element(id).listeners.click(); await settle(); },
    async select(feed) { await buttons[feeds.indexOf(feed)].listeners.click(); await settle(); },
    async refresh() { await vm.runInContext('News.load({force:true})', context); },
    titles() { return element('news-list').children.map(li => li.children[0]?.textContent); },
  };
}

test('all five feeds use their own endpoint, selected state, heading link, and cache', async () => {
  const h = await harness();
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    await h.select(feed);
    assert.deepEqual(h.titles(), [`${feed} item`]);
    assert.equal(h.element('news-title').href, `https://news.ycombinator.com${paths[i]}`);
    assert.equal(h.buttons.filter(b => b.attributes['aria-pressed'] === 'true').length, 1);
    assert.equal(h.buttons[i].attributes['aria-pressed'], 'true');
    assert.ok(h.state[`newsFeedCache.${feed}`]);
    assert.ok(h.requests.some(url => url.endsWith(`/${endpoints[i]}.json`)));
  }
});

test('switching back reuses only that feed cache and manual refresh targets the selection', async () => {
  const h = await harness();
  await h.select('ask');
  const count = h.requests.length;
  await h.select('top');
  await h.select('ask');
  assert.equal(h.requests.length, count);
  await h.refresh();
  assert.equal(h.requests.length, count + 2);
  assert.ok(h.requests[count].endsWith('/askstories.json'));
});

test('every new page starts with Top regardless of the previous page selection', async () => {
  const first = await harness();
  await first.select('show');
  const second = await harness({ storage: first.state });
  assert.deepEqual(second.titles(), ['top item']);
  assert.equal(second.buttons[0].attributes['aria-pressed'], 'true');
  assert.equal(second.requests.length, 0);
});

test('legacy news cache is reused for Top, never for another feed', async () => {
  const h = await harness({ storage: { newsEnabled: true, news: cached('Legacy top') } });
  assert.deepEqual(h.titles(), ['Legacy top']);
  assert.equal(h.requests.length, 0);
  await h.select('best');
  assert.deepEqual(h.titles(), ['best item']);
});

test('Ask text stories link to HN', async () => {
  const h = await harness();
  await h.select('ask');
  const [link, askMeta] = h.element('news-list').children[0].children;
  assert.equal(link.href, 'https://news.ycombinator.com/item?id=4');
  assert.equal(askMeta.children[0].href, 'https://news.ycombinator.com/item?id=4');
});

test('a late feed response cannot overwrite the newly selected feed', async () => {
  const pending = deferred();
  const h = await harness({ fetchJSON: url => {
    if (url.endsWith('/topstories.json')) return pending.promise;
    if (url.endsWith('/askstories.json')) return [4];
    return { id: 4, type: 'story', title: 'Ask result' };
  } });
  await h.select('ask');
  pending.resolve([1]);
  await settle();
  assert.deepEqual(h.titles(), ['Ask result']);
  assert.equal(h.element('news-title').href, 'https://news.ycombinator.com/ask');
  assert.equal(h.state['newsFeedCache.top'], undefined);
});

test('offline fallback stays within the selected feed and clears when switching', async () => {
  const old = cached('Cached ask');
  old.fetchedAt = 0;
  const h = await harness({ storage: { newsEnabled: true, 'newsFeedCache.top': cached('Top'), 'newsFeedCache.ask': old }, fetchJSON: () => { throw new Error('offline'); } });
  await h.select('ask');
  assert.deepEqual(h.titles(), ['Cached ask']);
  assert.equal(h.element('news-status').textContent, 'Offline · showing cached stories');
  await h.select('show');
  assert.deepEqual(h.titles(), []);
  assert.equal(h.element('news-status').textContent, "Couldn't reach Hacker News.");
  await h.select('top');
  assert.deepEqual(h.titles(), ['Top']);
  assert.equal(h.element('news-status').hidden, true);
});

test('an empty feed is cached and displays an empty state', async () => {
  const h = await harness({ fetchJSON: () => [] });
  assert.equal(h.element('news-status').textContent, 'No stories right now.');
  await h.select('new');
  await h.select('top');
  assert.equal(h.requests.length, 2);
});

test('expand and collapse persist visibility and transfer focus between controls', async () => {
  const h = await harness({ storage: {} });
  assert.equal(h.element('news').hidden, true);
  assert.equal(h.element('news-show').hidden, false);
  assert.equal(h.requests.length, 0);
  await h.click('news-show');
  assert.equal(h.state.newsEnabled, true);
  assert.equal(h.element('news-show').attributes['aria-expanded'], 'true');
  assert.equal(h.focused(), h.element('news-hide'));
  await h.select('show');
  await h.click('news-hide');
  assert.equal(h.state.newsEnabled, false);
  assert.equal(h.element('news').hidden, true);
  assert.equal(h.element('news-show').attributes['aria-expanded'], 'false');
  assert.equal(h.focused(), h.element('news-show'));
  await h.click('news-show');
  assert.deepEqual(h.titles(), ['show item']);
});

test('collapse discards pending results without reopening the panel', async () => {
  const pending = deferred();
  const h = await harness({ fetchJSON: () => pending.promise });
  await h.click('news-hide');
  pending.resolve([]);
  await settle();
  assert.equal(h.element('news').hidden, true);
  assert.equal(h.state['newsFeedCache.top'], undefined);
});
