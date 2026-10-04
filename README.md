# rtemis for Firefox

Firefox extension that applies the rtemis color theme (system / light / dark) and
replaces the new tab page with a clock, weather, search, and an optional
Hacker News panel.

The new tab background uses faint SVG waves in the shared teal accent with slow, independent motion.
The waves adapt to light and dark mode, pause in hidden tabs, and stay still
when reduced motion is enabled.

Choose **Use my location** in weather settings to follow your device as you
move. Location updates run when opening a new tab, roughly every five minutes
while it is visible, and on manual refresh. Cities selected through search stay
fixed. If you saved a location in an older version, select **Use my location**
once to enable automatic updates.

Expand Hacker News with the down arrow beneath search; collapse it with the
up arrow in its header. Switch between **Top**, **New**, **Best**, **Ask**, and
**Show** using the header links. Each new tab starts on Top, and the Hacker News
heading opens the selected feed on the website. Each feed is cached separately.

## Layout

- `manifest.json` — extension manifest (MV2)
- `background.js` — background script: sets the theme and follows the system color scheme
- `popup/` — toolbar popup with the theme mode toggle
- `newtab/` — new tab page (clock, weather via Open-Meteo, search via the browser's own engines, opt-in Hacker News)
- `icons/` — extension and listing icons

## Build

```sh
./build.sh          # writes rtemis-<version>.xpi
npx web-ext lint    # optional: run the AMO validator locally
```

Load `manifest.json` via `about:debugging` → *This Firefox* → *Load Temporary Add-on* for development.

Run the weather and news regression tests with `node --test tests/*.test.cjs`.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

MPL-2.0. See [LICENSE](LICENSE).
