// rtemis new tab: clock + weather card wiring.

const WEATHER_TTL_MS = 15 * 60 * 1000;   // reuse cached reading for 15 min
const STORAGE_KEYS = ["location", "weather"];

const $ = (id) => document.getElementById(id);

/* ---------------- clock ---------------- */

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const utcFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const zoneFmt = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" });

// Zone abbreviation, e.g. "PDT" (some locales only have "GMT-7"-style names)
function zoneAbbr(now) {
  return zoneFmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value || "";
}

// Offset from UTC, e.g. "UTC−7" or "UTC+5:30"
function utcOffset(now) {
  const mins = -now.getTimezoneOffset();
  if (mins === 0) return "UTC";
  const sign = mins < 0 ? "\u2212" : "+";
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

function tickClock() {
  const now = new Date();
  $("clock-time").textContent = timeFmt.format(now);
  $("clock-date").textContent = dateFmt.format(now);
  $("clock-tz").textContent = zoneAbbr(now);
  $("clock-zone").textContent = utcOffset(now);
  $("clock-utc").textContent = utcFmt.format(now);
  // align next tick to the top of the next minute
  setTimeout(tickClock, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
}

/* ---------------- weather ---------------- */

const card = $("weather-card");
const setState = (s) => { card.dataset.state = s; };

function fmtTemp(c) { return `${Math.round(c)}°`; }
function fmtTempBoth(c) { return `${Math.round(c)}°C / ${Math.round(Weather.cToF(c))}°F`; }

function render(w, place, stale) {
  $("w-place").textContent = place;
  $("w-icon").innerHTML = Weather.icon(w.iconKey, w.isDay);
  $("w-temp-c").textContent = Math.round(w.tempC);
  $("w-temp-f").textContent = Math.round(Weather.cToF(w.tempC));
  $("w-cond").textContent = w.label;
  $("w-feels").textContent = fmtTempBoth(w.feelsC);
  $("w-hilo").textContent = `${fmtTemp(w.hiC)} / ${fmtTemp(w.loC)}`;
  $("w-hum").textContent = `${Math.round(w.humidity)}%`;
  $("w-wind-dir").textContent = Weather.compass(w.windDir);
  $("w-wind").textContent = `${Math.round(w.windKmh)} km/h · ${Math.round(Weather.kmhToMph(w.windKmh))} mph`;
  $("w-updated").textContent = `Updated ${relTime(w.fetchedAt)}`;
  $("w-stale").hidden = !stale;
  setState("live");
}

function relTime(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

async function loadWeather({ force = false } = {}) {
  const { location, weather } = await browser.storage.local.get(STORAGE_KEYS);
  if (!location) { setState("setup"); return; }

  const cachedFresh = weather && weather.locKey === location.key &&
                      Date.now() - weather.fetchedAt < WEATHER_TTL_MS;

  if (cachedFresh && !force) {
    render(weather, location.name, false);
    return;
  }

  if (weather && weather.locKey === location.key) {
    render(weather, location.name, false);   // show stale immediately, refresh behind it
  } else {
    setState("loading");
  }

  try {
    const w = await Weather.fetchForecast(location.lat, location.lon);
    w.locKey = location.key;
    await browser.storage.local.set({ weather: w });
    render(w, location.name, false);
  } catch (err) {
    console.warn("weather fetch failed:", err);
    if (weather && weather.locKey === location.key) {
      render(weather, location.name, true);
    } else {
      setState("setup");
      $("setup-error").textContent = "Couldn't reach the weather service.";
    }
  }
}

async function saveLocation(loc) {
  loc.key = `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
  await browser.storage.local.set({ location: loc });
  await browser.storage.local.remove("weather");
  $("city-input").value = "";
  $("city-results").innerHTML = "";
  $("setup-error").textContent = "";
  $("setup-cancel").hidden = true;
  loadWeather({ force: true });
}

/* --- city search --- */

let searchTimer = null;
let results = [];
let selected = -1;

function renderResults() {
  const ul = $("city-results");
  ul.innerHTML = "";
  results.forEach((r, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", i === selected ? "true" : "false");
    li.innerHTML = `<div>${esc(r.name)}</div><div class="sub">${esc([r.admin, r.country].filter(Boolean).join(", "))}</div>`;
    li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
    ul.appendChild(li);
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function pick(i) {
  const r = results[i];
  if (!r) return;
  // City only, matching what reverseName() returns for "Use my location".
  saveLocation({ name: r.name, lat: r.lat, lon: r.lon });
}

$("city-input").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  selected = -1;
  if (q.length < 2) { results = []; renderResults(); return; }
  searchTimer = setTimeout(async () => {
    try {
      results = await Weather.geocode(q);
      $("setup-error").textContent = results.length ? "" : "No matches.";
    } catch {
      results = [];
      $("setup-error").textContent = "Search failed.";
    }
    renderResults();
  }, 250);
});

$("city-input").addEventListener("keydown", (e) => {
  if (!results.length) return;
  if (e.key === "ArrowDown") { e.preventDefault(); selected = (selected + 1) % results.length; renderResults(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); selected = (selected - 1 + results.length) % results.length; renderResults(); }
  else if (e.key === "Enter") { e.preventDefault(); pick(selected >= 0 ? selected : 0); }
  else if (e.key === "Escape") { results = []; renderResults(); }
});

$("setup-form").addEventListener("submit", (e) => e.preventDefault());

/* --- geolocation --- */

function geoErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied.";
    case err.POSITION_UNAVAILABLE:
      return "Location unavailable. On macOS, allow Firefox under System Settings → Privacy & Security → Location Services, or search for your city.";
    case err.TIMEOUT:
      return "Timed out getting location. Try again or search for your city.";
    default:
      return "Couldn't get location.";
  }
}

function getPosition(opts) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, opts));
}

$("use-geo").addEventListener("click", async () => {
  const btn = $("use-geo");
  if (!navigator.geolocation) { $("setup-error").textContent = "Geolocation unavailable."; return; }
  btn.disabled = true;
  btn.textContent = "Locating…";
  $("setup-error").textContent = "";
  try {
    let pos;
    try {
      // Fast path: accept a recent cached fix.
      pos = await getPosition({ enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 });
    } catch (e) {
      if (e.code === e.PERMISSION_DENIED) throw e;
      // Retry once, forcing a fresh fix (helps with cold-start CoreLocation).
      pos = await getPosition({ enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    }
    const { latitude: lat, longitude: lon } = pos.coords;
    const name = (await Weather.reverseName(lat, lon)) || "My location";
    saveLocation({ name, lat, lon });
  } catch (err) {
    console.warn("geolocation failed:", err);
    $("setup-error").textContent = geoErrorMessage(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Use my location";
  }
});

/* --- manual refresh --- */

$("w-refresh").addEventListener("click", async () => {
  const btn = $("w-refresh");
  if (btn.classList.contains("busy")) return;
  btn.classList.add("busy");
  const started = Date.now();
  try {
    await loadWeather({ force: true });
  } finally {
    // keep the spinner visible long enough to register
    setTimeout(() => btn.classList.remove("busy"), Math.max(0, 500 - (Date.now() - started)));
  }
});

/* --- change location --- */

$("w-settings").addEventListener("click", () => {
  $("setup-cancel").hidden = false;
  setState("setup");
  $("city-input").focus();
});

$("setup-cancel").addEventListener("click", () => {
  $("setup-cancel").hidden = true;
  $("setup-error").textContent = "";
  loadWeather();
});

/* ---------------- theme mode ---------------- */

// Mirrors THEME_MODES in background.js, which applies the theme when this changes.
const THEME_MODES = ["system", "light", "dark"];
const themeSwitch = $("theme-switch");

function renderThemeMode(mode) {
  for (const btn of themeSwitch.querySelectorAll("button")) {
    btn.setAttribute("aria-checked", btn.dataset.mode === mode ? "true" : "false");
  }
}

async function loadThemeMode() {
  const { themeMode } = await browser.storage.local.get("themeMode");
  renderThemeMode(THEME_MODES.includes(themeMode) ? themeMode : "system");
}

themeSwitch.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (!btn) return;
  renderThemeMode(btn.dataset.mode);
  browser.storage.local.set({ themeMode: btn.dataset.mode });
});

// Keep other open new tabs in sync.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.themeMode) {
    renderThemeMode(changes.themeMode.newValue || "system");
  }
});

/* ---------------- init ---------------- */

tickClock();
loadWeather();
loadThemeMode();

// Refresh the "updated N min ago" label and re-fetch when the TTL lapses while the tab stays open.
setInterval(() => {
  if (card.dataset.state === "live") loadWeather();
}, 60000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && card.dataset.state === "live") loadWeather();
});
