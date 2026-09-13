// rtemis toolbar popup: theme switcher + links.

const $ = (id) => document.getElementById(id);

/* ---------------- theme mode ---------------- */

// Mirrors THEME_MODES in styles.js, which applies the theme when this changes.
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

/* ---------------- links ---------------- */

// Open links in a new tab and dismiss the popup.
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  e.preventDefault();
  browser.tabs.create({ url: a.href });
  window.close();
});

/* ---------------- docs flyout ---------------- */

// The docs list opens as a second pane to the right of the menu.
// Open state is remembered across popup openings.
const docsToggle = $("docs-toggle");
const docsPanel = $("docs-panel");

function setDocsOpen(open) {
  docsToggle.setAttribute("aria-expanded", String(open));
  docsPanel.hidden = !open;
}

docsToggle.addEventListener("click", () => {
  const open = docsToggle.getAttribute("aria-expanded") !== "true";
  setDocsOpen(open);
  browser.storage.local.set({ popupDocsOpen: open });
});

/* ---------------- init ---------------- */

loadThemeMode();
browser.storage.local.get("popupDocsOpen").then(({ popupDocsOpen }) => {
  setDocsOpen(Boolean(popupDocsOpen));
});
