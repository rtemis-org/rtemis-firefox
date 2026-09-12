console.log("Applying rtemis Firefox theme.");

// Dark theme colors.
// Key names are Firefox's theme "colors" properties; the comments describe the
// UI each one actually drives in current Firefox (verified against
// ThemeVariableMap.sys.mjs / LightweightThemeConsumer.sys.mjs and the chrome CSS).
const darkColors = {
  /* --- window frame & tab strip --- */
  // Background of the title bar / tab strip area (behind the tabs)
  frame: "rgb(30, 30, 30)",
  // Text of unselected tabs (and everything else drawn directly on the frame)
  tab_background_text: "rgb(179, 179, 179)",
  // Background of the selected tab. Defaults to `toolbar`; since frame and
  // toolbar are the same color here, set it explicitly so the active tab is visible
  tab_selected: "rgb(45, 45, 45)",
  // Outline (full border) of the selected tab; in old Firefox this was a top line
  tab_line: "rgb(77, 77, 77)",
  // Fill of the tab loading spinner/burst
  tab_loading: "rgb(77, 77, 77)",
  // Line between the tab strip and the navigation bar. Transparent removes it
  toolbar_top_separator: "transparent",

  /* --- toolbars --- */
  // Background of the navigation bar and bookmarks bar
  toolbar: "rgb(30, 30, 30)",
  // Text on the navigation bar and bookmarks bar (also the selected tab's text)
  toolbar_text: "rgb(204, 204, 204)",
  // Toolbar button icons (back/forward, reload, bookmark star, extension icons)
  icons: "rgb(116, 116, 116)",
  // "Attention" icons: filled bookmark star, download progress/arrow, badges
  icons_attention: "rgb(108, 163, 160)",
  // Border between the browser UI and the page content area
  toolbar_bottom_separator: "rgb(55, 55, 55)",

  /* --- URL bar & search field --- */
  // Background of the URL bar and search field (unfocused)
  toolbar_field: "rgb(51, 51, 51)",
  // Text in the URL bar and search field
  toolbar_field_text: "rgb(229, 229, 229)",
  // Background of the URL bar when focused AND of its results dropdown.
  // Defaults to `toolbar_field`; listed so it can be tuned independently
  toolbar_field_focus: "rgb(51, 51, 51)",
  // Focus ring around the URL bar / search field
  toolbar_field_border_focus: "rgb(90, 90, 90)",
  // Selected-text highlight inside the URL bar (default is the OS accent color)
  toolbar_field_highlight: "rgba(108, 163, 160, 0.45)",
  toolbar_field_highlight_text: "rgb(255, 255, 255)",
  // Background/text of the selected row in the URL bar and search dropdown
  popup_highlight: "rgb(108, 163, 160)",
  popup_highlight_text: "rgb(255, 255, 255)",

  /* --- menus & panels --- */
  // Background of menus and arrow panels (app menu, bookmarks menu, context menus, etc.).
  // Note: the URL bar dropdown uses `toolbar_field_focus`, not this
  popup: "rgba(56, 56, 56, 0.90)",
  // Text in menus and arrow panels
  popup_text: "rgb(204, 204, 204)",
  // Border of menus and arrow panels
  popup_border: "rgb(70, 70, 70)",

  /* --- sidebar --- */
  // Sidebar background (vertical tabs, bookmarks/history panels)
  sidebar: "rgb(32, 32, 32)",
  // Sidebar text
  sidebar_text: "rgb(185, 185, 185)",
  // Sidebar border / splitter
  sidebar_border: "rgb(31, 31, 31)",
  // Selected item in the legacy bookmarks/history tree and synced-tabs sidebar.
  // The new sidebar's vertical tabs use the tab colors above instead
  sidebar_highlight: "rgb(108, 163, 160)",
  sidebar_highlight_text: "rgb(255, 255, 255)"
};

// Light theme colors, created by inverting the gray values from the dark theme
// The formula to invert: 255 - original value
const lightColors = {
  /* --- window frame & tab strip --- */
  frame: "rgb(234, 234, 234)",
  tab_background_text: "rgb(76, 76, 76)",
  tab_selected: "rgb(250, 250, 250)",
  tab_line: "rgb(178, 178, 178)",
  tab_loading: "rgb(178, 178, 178)",
  toolbar_top_separator: "transparent",

  /* --- toolbars --- */
  toolbar: "rgb(234, 234, 234)",
  toolbar_text: "rgb(51, 51, 51)",
  icons: "rgb(139, 139, 139)",
  icons_attention: "rgb(108, 163, 160)", // Keeping the accent color the same
  toolbar_bottom_separator: "rgb(200, 200, 200)",

  /* --- URL bar & search field --- */
  toolbar_field: "rgb(204, 204, 204)",
  toolbar_field_text: "rgb(26, 26, 26)",
  toolbar_field_focus: "rgb(204, 204, 204)",
  toolbar_field_border_focus: "rgb(165, 165, 165)",
  toolbar_field_highlight: "rgba(108, 163, 160, 0.45)",
  toolbar_field_highlight_text: "rgb(0, 0, 0)",
  popup_highlight: "rgb(108, 163, 160)", // Keeping the accent color the same
  popup_highlight_text: "rgb(255, 255, 255)",

  /* --- menus & panels --- */
  popup: "rgba(199, 199, 199, 0.90)",
  popup_text: "rgb(51, 51, 51)",
  popup_border: "rgb(185, 185, 185)",

  /* --- sidebar --- */
  sidebar: "rgb(223, 223, 223)",
  sidebar_text: "rgb(70, 70, 70)",
  sidebar_border: "rgb(224, 224, 224)",
  sidebar_highlight: "rgb(108, 163, 160)", // Keeping the accent color the same
  sidebar_highlight_text: "rgb(0, 0, 0)"   // Inverted from white
};

// Theme mode chosen on the new tab page: "system" follows the OS, "light" and
// "dark" force a scheme. Stored in browser.storage.local.themeMode.
const THEME_MODES = ["system", "light", "dark"];

async function getThemeMode() {
  const { themeMode } = await browser.storage.local.get("themeMode");
  return THEME_MODES.includes(themeMode) ? themeMode : "system";
}

// Detect the OS color scheme
function detectColorScheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Apply theme based on the chosen mode (and system preference when in system mode)
async function applyTheme() {
  try {
    const mode = await getThemeMode();
    const scheme = mode === "system" ? detectColorScheme() : mode;
    await browser.theme.update({
      colors: scheme === "dark" ? darkColors : lightColors,
      // color_scheme tells Firefox which scheme its own UI (and this background
      // page) should report for prefers-color-scheme. Without it Firefox derives
      // the scheme from our toolbar color, so once the dark colors are applied
      // this page would see "dark" forever and never notice the OS switching
      // back to light. content_color_scheme does the same for web content,
      // including the new tab page.
      properties: { color_scheme: mode, content_color_scheme: mode }
    });
    console.log(`Applied ${scheme} theme (mode: ${mode})`);
  } catch (error) {
    console.error("Error applying theme:", error);
  }
}

// Initial theme application
applyTheme();

// Watch for system color scheme changes
try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
} catch (error) {
  console.error("Error setting up theme change listener:", error);
}

// Watch for mode changes made on the new tab page
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.themeMode) {
    applyTheme();
  }
});
