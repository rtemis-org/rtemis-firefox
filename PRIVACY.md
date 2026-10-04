# Privacy Policy

rtemis for Firefox does not collect, store, or transmit any personal data to
its author or to any analytics service.

## Data stored locally

The extension uses Firefox's `storage.local` to remember, on your device only:

- the selected theme mode (system / light / dark)
- the location you chose for the weather card, whether it follows your device,
  and the last fetched forecast
- your chosen search engine for the new tab search box
- whether the Hacker News panel is shown, and the last fetched headlines for
  each feed you view

Removing the extension deletes this data.

## Network requests

The new tab page makes requests to the following third-party services. No
identifiers other than what is listed are sent.

| Service | When | Data sent |
|---|---|---|
| `api.open-meteo.com` | loading the weather card | latitude/longitude of your chosen location |
| `geocoding-api.open-meteo.com` | searching for a city in weather setup | the city name you typed |
| `nominatim.openstreetmap.org` | when you enable "Use my location" and when the device location changes | your device's coordinates, to obtain a place name |
| `hacker-news.firebaseio.com` | only if you enable the Hacker News panel | none |

Searches from the new tab box are run through the search engine you selected
in Firefox, using Firefox's own search API; the extension does not see or
forward your queries to any other service.

Selecting "Use my location" enables automatic device-location updates, subject
to Firefox's location permission. The new tab page checks your location when
opened, roughly every five minutes while visible, and when you refresh the
weather manually. Returning to an open tab also checks if an update is due.
Selecting a city through search stops these automatic location requests.

## Contact

Questions about this policy: https://github.com/rtemis-org/rtemis-firefox/issues
