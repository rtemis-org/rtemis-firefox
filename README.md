# rtemis for Firefox

Firefox extension that applies the rtemis color theme, provides a direct system / light / dark mode toggle, and replaces the new tab page with a clock, weather, search, and an optional Hacker News and Slashdot panel.

The extension icon, toolbar button, popup mark, and new-tab favicon share
`icons/logomark.svg`: black in light mode and white in dark mode.

The new tab background uses faint SVG waves in the shared teal accent with slow, independent motion.
The waves adapt to light and dark mode, pause in hidden tabs, and stay still
when reduced motion is enabled.

The toolbar menu offers **App window** and **Full screen** for the current page.
Both move the current tab into a separate window without browser toolbars,
retaining the live page and its history. App windows keep the operating system's
title bar and window buttons; Full screen requests Firefox's fullscreen mode.
In a regular window, the page's right-click menu also offers **Open in app
window** and **Open in full screen** (under rtemis when Firefox groups the entries).
These actions move the current page even when right-clicking a link or image.
App windows offer both **Open in full screen** and **Return to regular window**.
The fullscreen action moves the live tab into a new window created in fullscreen,
without reloading. It remains available when already fullscreen, so you can
re-enter fullscreen through the same path after using the native window button.
The window title follows the page title; Firefox controls any added site
identification or browser branding, which extensions cannot remove.
To leave fullscreen, use Command-Shift-F on macOS or F11 on Windows and Linux
([Firefox shortcuts](https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly)).

To restore browser toolbars and tabs, right-click the page and choose **Return
to regular window**, or press **Option-Shift-R** on macOS / **Alt-Shift-R** on
Windows and Linux. This moves the same live tab into a new regular window,
without reloading the web app, and also works directly from fullscreen.
The return action appears only in app/popup windows. All window actions preserve private browsing.
The context menu uses the `menus` permission; no page-content access is needed.
If a web app replaces the right-click menu, use the shortcut. You can change it
in Firefox's **Manage Extension Shortcuts** settings at `about:addons`.

Choose **Use my location** in weather settings to follow your device as you
move. Location updates run when opening a new tab, roughly every five minutes
while it is visible, and on manual refresh. Cities selected through search stay
fixed. If you saved a location in an older version, select **Use my location**
once to enable automatic updates.

Expand news with the down arrow beneath search; collapse it with the up arrow.
Switch between **Hacker News** and **Slashdot** in the panel header. The selected
source is remembered across new tabs; Hacker News is the initial default.
Hacker News offers **Top**, **New**, **Best**, **Ask**, and **Show**. Slashdot offers
**Main**, **Ask Slashdot**, **Linux**, **Developers**, **Science**, **Games**,
**Politics**, and **Your Rights Online** in a dropdown. Each new tab starts on
Top or Main. Source, feed, refresh, and collapse controls share one header row;
on narrow screens, the feed controls wrap below the source selector.

Only the selected feed is fetched. Each feed has its own cache: ten minutes for
Hacker News and thirty minutes for Slashdot. Slashdot refresh also respects its
[thirty-minute request interval](https://search.slashdot.org/faq/feeds.shtml),
including across open tabs and after failed requests. Slashdot feed access uses
a host permission limited to `https://rss.slashdot.org/*`.

## Layout

- `manifest.json` — extension manifest (MV2)
- `background.js` — background script: sets the theme and follows the system color scheme
- `page-windows.js` — background handlers for page-window context menus and the return shortcut
- `popup/` — toolbar popup with theme, page-window actions, and links
- `newtab/` — new tab page (clock, weather via Open-Meteo, search via the browser's own engines, opt-in Hacker News and Slashdot)
- `icons/` — extension and listing icons

## Build

```sh
./build.sh          # writes rtemis-<version>.xpi
npx web-ext lint    # optional: run the AMO validator locally
```

Load `manifest.json` via `about:debugging` → *This Firefox* → *Load Temporary Add-on* for development.

Run the regression tests with `node --test tests/*.test.cjs`.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

MPL-2.0. See [LICENSE](LICENSE).
