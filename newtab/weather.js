// Open-Meteo client: forecast, geocoding, WMO code mapping, icons.
// No API key; responses carry Access-Control-Allow-Origin: * so no host permission is needed.

const Weather = (() => {
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"; // only used for "Use my location" naming

  // WMO weather interpretation codes -> label + icon key
  const WMO = {
    0:  ["Clear sky", "sun"],
    1:  ["Mainly clear", "sun"],
    2:  ["Partly cloudy", "cloud-sun"],
    3:  ["Overcast", "cloud"],
    45: ["Fog", "fog"],
    48: ["Rime fog", "fog"],
    51: ["Light drizzle", "drizzle"],
    53: ["Drizzle", "drizzle"],
    55: ["Heavy drizzle", "drizzle"],
    56: ["Freezing drizzle", "sleet"],
    57: ["Freezing drizzle", "sleet"],
    61: ["Light rain", "rain"],
    63: ["Rain", "rain"],
    65: ["Heavy rain", "rain"],
    66: ["Freezing rain", "sleet"],
    67: ["Freezing rain", "sleet"],
    71: ["Light snow", "snow"],
    73: ["Snow", "snow"],
    75: ["Heavy snow", "snow"],
    77: ["Snow grains", "snow"],
    80: ["Light showers", "rain"],
    81: ["Showers", "rain"],
    82: ["Violent showers", "rain"],
    85: ["Snow showers", "snow"],
    86: ["Heavy snow showers", "snow"],
    95: ["Thunderstorm", "storm"],
    96: ["Thunderstorm, hail", "storm"],
    99: ["Thunderstorm, hail", "storm"],
  };

  // Minimal line icons, 24x24, stroke = currentColor
  const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const cloud = `<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11.5 3.5 3.5 0 0 0 7 18z"/>`;
  const ICONS = {
    "sun": `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
    "moon": `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`,
    "cloud-sun": `<circle cx="16.5" cy="7.5" r="2.5"/><path d="M16.5 2.5v1.2M21.5 7.5h-1.2M20 4l-.9.9M20 11l-.9-.9M13 4l.9.9"/><path d="M6 20h8.5a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 5.3 14.4 2.8 2.8 0 0 0 6 20z"/>`,
    "cloud-moon": `<path d="M19.5 9.2A4 4 0 0 1 14.8 4.5a4 4 0 1 0 4.7 4.7z"/><path d="M6 20h8.5a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 5.3 14.4 2.8 2.8 0 0 0 6 20z"/>`,
    "cloud": cloud,
    "fog": `<path d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7.5 3.5 3.5 0 0 0 7 14z"/><path d="M6 18h12M8 21h8"/>`,
    "drizzle": `<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M9 18.5v1.5M12 18.5v1.5M15 18.5v1.5"/>`,
    "rain": `<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>`,
    "sleet": `<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M9 18l-1 3M16 18.5v.01M12.5 20.5v.01M15 21.5v.01"/>`,
    "snow": `<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M8 18.5v.01M12 18.5v.01M16 18.5v.01M10 21v.01M14 21v.01"/>`,
    "storm": `<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.5 3.5 3.5 0 0 0 7 15z"/><path d="M13 14l-2.5 4H14l-2.5 4"/>`,
  };

  function icon(key, isDay) {
    if (!isDay) {
      if (key === "sun") key = "moon";
      else if (key === "cloud-sun") key = "cloud-moon";
    }
    return `<svg viewBox="0 0 24 24" ${S} aria-hidden="true">${ICONS[key] || ICONS.cloud}</svg>`;
  }

  function describe(code) {
    return WMO[code] || ["Unknown", "cloud"];
  }

  const cToF = (c) => c * 9 / 5 + 32;
  const kmhToMph = (k) => k / 1.609344;

  // 16-point compass
  function compass(deg) {
    const pts = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    return pts[Math.round(deg / 22.5) % 16];
  }

  async function getJSON(url, { timeout = 8000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /** Fetch current conditions + today's range. Returns a normalized object. */
  async function fetchForecast(lat, lon) {
    const q = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: [
        "temperature_2m", "apparent_temperature", "relative_humidity_2m",
        "weather_code", "wind_speed_10m", "wind_direction_10m", "is_day",
      ].join(","),
      daily: "temperature_2m_max,temperature_2m_min",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      timezone: "auto",
      forecast_days: "1",
    });
    const d = await getJSON(`${FORECAST_URL}?${q}`);
    const c = d.current;
    const [label, iconKey] = describe(c.weather_code);
    return {
      fetchedAt: Date.now(),
      tempC: c.temperature_2m,
      feelsC: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      code: c.weather_code,
      label,
      iconKey,
      isDay: c.is_day === 1,
      windKmh: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      hiC: d.daily.temperature_2m_max[0],
      loC: d.daily.temperature_2m_min[0],
    };
  }

  /** City search. Returns [{name, admin, country, lat, lon}] */
  async function geocode(query) {
    const q = new URLSearchParams({ name: query, count: "6", language: "en", format: "json" });
    const d = await getJSON(`${GEOCODE_URL}?${q}`);
    return (d.results || []).map((r) => ({
      name: r.name,
      admin: r.admin1 || "",
      country: r.country_code || r.country || "",
      lat: r.latitude,
      lon: r.longitude,
    }));
  }

  /** Best-effort place name for coordinates; falls back to rounded lat/lon. */
  async function reverseName(lat, lon) {
    try {
      const q = new URLSearchParams({ lat, lon, format: "jsonv2", zoom: "10" });
      const d = await getJSON(`${REVERSE_URL}?${q}`, { timeout: 5000 });
      const a = d.address || {};
      return a.city || a.town || a.village || a.municipality || a.county || d.name || null;
    } catch {
      return null;
    }
  }

  return { fetchForecast, geocode, reverseName, icon, describe, cToF, kmhToMph, compass };
})();
