# rtemis for Firefox

Firefox extension that applies the rtemis color theme (system / light / dark) and
replaces the new tab page with a clock, weather, search, and an optional
Hacker News panel.

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

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

MPL-2.0. See [LICENSE](LICENSE).
