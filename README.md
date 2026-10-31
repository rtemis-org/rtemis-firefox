# rtemis for Firefox

Firefox extension that applies the rtemis color theme (system / light / dark) and
replaces the new tab page with a clock, weather, search, and an optional
Hacker News and Slashdot panel.

The new tab background uses faint SVG waves in the shared teal accent with slow, independent motion.
The waves adapt to light and dark mode, pause in hidden tabs, and stay still
when reduced motion is enabled.

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
- `popup/` — toolbar popup with the theme mode toggle
- `newtab/` — new tab page (clock, weather via Open-Meteo, search via the browser's own engines, opt-in Hacker News and Slashdot)
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
