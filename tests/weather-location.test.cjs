const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const MINUTE = 60000;
const START = 1800000000000;
const oldLocation = { name: 'Old city', lat: 37, lon: -122, key: '37.000,-122.000', source: 'device' };
const newPosition = { coords: { latitude: 40, longitude: -74 } };
const forecast = { fetchedAt: START, tempC: 20, feelsC: 19, hiC: 22, loC: 15,
  humidity: 50, windDir: 90, windKmh: 10, label: 'Clear sky', iconKey: 'sun', isDay: true };
const source = readFileSync(new URL('../newtab/newtab.js', `file://${__filename}`), 'utf8');
const weatherSource = readFileSync(new URL('../newtab/weather.js', `file://${__filename}`), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

async function harness({ location = oldLocation, weather, position, fetchForecast, reverseName } = {}) {
  let now = START;
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      dataset: {}, hidden: false, textContent: '', value: '', listeners: {},
      classList: { contains: () => false, add() {}, remove() {} },
      setAttribute() {}, replaceChildren() {}, append() {}, appendChild() {}, focus() {},
      querySelectorAll: () => [],
      addEventListener(type, fn) { this.listeners[type] = fn; },
    });
    return elements.get(id);
  }
  const state = { location: structuredClone(location),
    weather: weather === null ? undefined : { ...forecast, locKey: location?.key, ...weather } };
  const calls = { positions: [], forecasts: [], names: [] };
  const callbacks = {};
  const context = vm.createContext({
    console: { warn() {} }, Intl,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    setTimeout: () => 1, clearTimeout() {},
    setInterval(fn) { callbacks.interval = fn; },
    document: { hidden: false, getElementById: element, createElement: element,
      addEventListener(type, fn) { callbacks[type] = fn; } },
    navigator: { geolocation: { getCurrentPosition(resolve, reject, options) {
      calls.positions.push(options);
      Promise.resolve().then(() => position ? position() : newPosition).then(resolve, reject);
    } } },
    browser: { storage: { local: {
      async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, structuredClone(state[k])])); },
      async set(values) { Object.assign(state, structuredClone(values)); },
      async remove(key) { delete state[key]; },
    }, onChanged: { addListener() {} } } },
  });
  vm.runInContext(weatherSource, context);
  context.mockForecast = async (lat, lon) => {
    calls.forecasts.push([lat, lon]);
    return fetchForecast ? fetchForecast(lat, lon) : { ...forecast, fetchedAt: now };
  };
  context.mockReverseName = async (lat, lon) => {
    calls.names.push([lat, lon]);
    return reverseName ? reverseName(lat, lon) : 'New city';
  };
  vm.runInContext('Weather.fetchForecast = mockForecast; Weather.reverseName = mockReverseName;', context);
  vm.runInContext(source, context);
  await settle();
  return { state, calls, context, element, callbacks,
    advance(ms) { now += ms; },
    run(code) { return vm.runInContext(code, context); },
    async click(id) { await element(id).listeners.click({}); await settle(); },
    async refresh(options = {}) { await context.loadWeather(options); },
  };
}

test('opening a tab follows movement even when the old forecast is fresh', async () => {
  const h = await harness();
  assert.equal(h.state.location.name, 'New city');
  assert.equal(h.state.location.source, 'device');
  assert.deepEqual(h.calls.forecasts, [[40, -74]]);
  assert.equal(h.state.weather.locKey, '40.000,-74.000');
  assert.equal(h.element('w-place').textContent, 'New city');
  assert.equal(h.calls.positions[0].maximumAge, 0);
});

test('manual and legacy locations remain fixed without geolocation', async () => {
  for (const source of ['manual', undefined]) {
    const h = await harness({ location: { ...oldLocation, source } });
    await h.refresh({ force: true });
    assert.equal(h.calls.positions.length, 0);
    assert.deepEqual(h.calls.forecasts, [[37, -122]]);
    assert.equal(h.element('w-place').textContent, 'Old city');
  }
});

test('an unchanged position reuses the forecast and place name', async () => {
  const h = await harness({ position: () => ({ coords: { latitude: 37, longitude: -122 } }) });
  assert.equal(h.calls.positions.length, 1);
  assert.equal(h.calls.names.length, 0);
  assert.equal(h.calls.forecasts.length, 0);
  await h.refresh();
  assert.equal(h.calls.positions.length, 1);
});

test('visible polling follows movement after five minutes; hidden tabs wait until returning', async () => {
  let moved = false;
  const h = await harness({ position: () => moved ? newPosition : { coords: { latitude: 37, longitude: -122 } } });
  moved = true;
  h.advance(4 * MINUTE);
  h.callbacks.interval();
  await settle();
  assert.equal(h.calls.positions.length, 1);
  h.advance(MINUTE);
  h.context.document.hidden = true;
  h.callbacks.interval();
  await settle();
  assert.equal(h.calls.positions.length, 1);
  h.context.document.hidden = false;
  h.callbacks.visibilitychange();
  await settle();
  assert.equal(h.calls.positions.length, 2);
  assert.equal(h.element('w-place').textContent, 'New city');
  h.advance(5 * MINUTE);
  h.callbacks.interval();
  await settle();
  assert.equal(h.calls.positions.length, 3);
});

test('manual refresh rechecks location before the polling interval expires', async () => {
  const h = await harness();
  await h.click('w-refresh');
  assert.equal(h.calls.positions.length, 2);
  assert.equal(h.calls.forecasts.length, 2);
});

test('permission and timeout errors retain the last place, flag it, and recover', async () => {
  for (const code of [1, 2, 3]) {
    let failing = true;
    const h = await harness({ position: () => {
      if (failing) throw { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
      return newPosition;
    } });
    assert.equal(h.state.location.name, 'Old city');
    assert.equal(h.element('w-stale').hidden, false);
    assert.equal(h.element('w-stale').textContent, 'location unavailable');
    await h.refresh();
    assert.equal(h.calls.positions.length, 1);
    failing = false;
    h.advance(5 * MINUTE);
    await h.refresh();
    assert.equal(h.element('w-place').textContent, 'New city');
    assert.equal(h.element('w-stale').hidden, true);
  }
});

test('a missing geolocation API also preserves the last known location', async () => {
  const h = await harness();
  h.context.navigator.geolocation = undefined;
  await h.refresh({ force: true });
  assert.equal(h.element('w-place').textContent, 'New city');
  assert.equal(h.element('w-stale').textContent, 'location unavailable');
  assert.equal(h.element('w-stale').hidden, false);
});

test('failed reverse lookup does not retain an incorrect city name', async () => {
  const h = await harness({ reverseName: () => null });
  assert.equal(h.element('w-place').textContent, 'My location');
  assert.deepEqual(h.calls.forecasts, [[40, -74]]);
});

test('forecast failure after moving never labels the old forecast with the new city', async () => {
  const h = await harness({ fetchForecast: () => { throw new Error('offline'); } });
  assert.equal(h.element('weather-card').dataset.state, 'setup');
  assert.equal(h.element('setup-error').textContent, "Couldn't reach the weather service.");
  assert.equal(h.state.weather.locKey, oldLocation.key);
});

test('Use my location persists device mode and selecting a city stops following', async () => {
  const h = await harness({ location: { ...oldLocation, source: 'manual' } });
  await h.click('use-geo');
  assert.equal(h.state.location.source, 'device');
  assert.equal(h.calls.positions.length, 1);
  await h.run('results = [{name: "Paris", lat: 48.85, lon: 2.35}]; pick(0)');
  await h.refresh({ force: true });
  assert.equal(h.state.location.source, 'manual');
  assert.equal(h.element('w-place').textContent, 'Paris');
  assert.equal(h.calls.positions.length, 1);
});

test('a late location response cannot overwrite a newer city selection', async () => {
  const pending = deferred();
  const h = await harness({ position: () => pending.promise });
  await h.run('results = [{name: "Paris", lat: 48.85, lon: 2.35}]; pick(0)');
  pending.resolve(newPosition);
  await settle();
  assert.equal(h.state.location.name, 'Paris');
  assert.equal(h.element('w-place').textContent, 'Paris');
  assert.deepEqual(h.calls.forecasts, [[48.85, 2.35]]);
});

test('a late forecast cannot overwrite a newer city selection', async () => {
  const pending = deferred();
  const h = await harness({ fetchForecast: (lat) => lat === 40 ? pending.promise : { ...forecast } });
  await h.run('results = [{name: "Paris", lat: 48.85, lon: 2.35}]; pick(0)');
  pending.resolve({ ...forecast });
  await settle();
  assert.equal(h.state.weather.locKey, '48.850,2.350');
  assert.equal(h.element('w-place').textContent, 'Paris');
});

test('opening settings prevents pending work from closing the city picker', async () => {
  const pending = deferred();
  const h = await harness({ position: () => pending.promise });
  await h.click('w-settings');
  pending.resolve(newPosition);
  await settle();
  assert.equal(h.element('weather-card').dataset.state, 'setup');
  assert.equal(h.state.location.name, 'Old city');
});

test('a pending automatic location update preserves a city selected in another tab', async () => {
  const pending = deferred();
  const h = await harness({ position: () => pending.promise });
  h.state.location = { name: 'Paris', lat: 48.85, lon: 2.35, key: '48.850,2.350', source: 'manual' };
  pending.resolve(newPosition);
  await settle();
  assert.equal(h.state.location.name, 'Paris');
  assert.equal(h.calls.forecasts.length, 0);
  await h.refresh();
  assert.equal(h.element('w-place').textContent, 'Paris');
});

test('a pending forecast preserves weather saved by another tab for a different city', async () => {
  const pending = deferred();
  const h = await harness({ fetchForecast: () => pending.promise });
  h.state.location = { name: 'Paris', lat: 48.85, lon: 2.35, key: '48.850,2.350', source: 'manual' };
  h.state.weather = { ...forecast, locKey: '48.850,2.350' };
  pending.resolve({ ...forecast });
  await settle();
  assert.equal(h.state.weather.locKey, '48.850,2.350');
  await h.refresh();
  assert.equal(h.element('w-place').textContent, 'Paris');
});
