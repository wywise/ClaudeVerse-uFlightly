# uFlightly

A private flight log for iPhone. It runs entirely in your browser and keeps your flights on your device. There is no server, no account, and no tracking.

## Features

- **Log flights** by hand with airport search, airline, aircraft, seat, class, notes, rating, and photos.
- **Import** a FlightDiary / myFlightradar24 CSV, or a uFlightly backup.
- **Map** with great-circle routes, visited countries, and a globe view.
- **Stats**: distance, time in the air, top airlines, aircraft, airports and routes, continents, time zones, and CO2 estimate.
- **Goals and achievements** for each year.
- **Passport card**: a shareable image of your flying, with a Blacklight mode.
- **Works offline** once opened, and follows light and dark mode.

## Use on iPhone

1. Open the site in Safari.
2. Tap Share, then Add to Home Screen.
3. Open it from the Home Screen icon and import your flights there.

Data in Safari and data in the Home Screen icon are stored separately, so import into the one you plan to use.

## Your data

Everything is stored locally in your browser. Nothing is sent anywhere. Clearing website data in Safari deletes your flights, so use Settings > Export backup (JSON) now and then. The backup includes photos.

## Project layout

- `docs/` is the standalone site served by GitHub Pages.
- `app/src/app.template.html` is the single source of the app.
- `app/build/build.py` builds the site, using the public data in `app/build/data` (airports, map, logos).

```
python3 app/build/build.py site
```

## Credits

- Airport data: [OpenFlights](https://openflights.org/data.html), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
- World map: [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, public domain).
- Maps and charts: [D3](https://d3js.org) and [TopoJSON](https://github.com/topojson/topojson-client).
- Airline logos are trademarks of their respective owners and are shown only to identify airlines.
