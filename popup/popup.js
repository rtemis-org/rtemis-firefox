// rtemis toolbar popup: theme switcher, page windows, and links.

const $ = (id) => document.getElementById(id);

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

/* ---------------- page windows ---------------- */

const windowActions = $("window-actions");
const windowError = $("window-error");
let openingWindow = false;

windowActions.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-window-state]");
  if (!btn || openingWindow) return;

  openingWindow = true;
  windowError.hidden = true;
  const buttons = windowActions.querySelectorAll("button");
  for (const button of buttons) button.disabled = true;

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id) || tab.id < 0) {
      throw new Error("No active tab is available.");
    }
    // Move the live tab to preserve its state, history, and container.
    // spec: rtemis-firefox/page-windows#window-actions
    await browser.windows.create({
      tabId: tab.id,
      type: "popup",
      state: btn.dataset.windowState,
      incognito: tab.incognito,
    });
    window.close();
  } catch (error) {
    windowError.textContent = `Could not open the page: ${error.message || error}`;
    windowError.hidden = false;
  } finally {
    openingWindow = false;
    for (const button of buttons) button.disabled = false;
  }
});

/* ---------------- links ---------------- */

// Open links in a new tab and dismiss the popup.
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  e.preventDefault();
  browser.tabs.create({ url: a.href });
  window.close();
});

/* ---------------- init ---------------- */

loadThemeMode();
