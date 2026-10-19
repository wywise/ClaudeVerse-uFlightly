#!/usr/bin/env python3
"""Builds uFlightly from src/app.template.html.

  python3 app/build/build.py            builds both targets
  python3 app/build/build.py artifact   private/uflightly.html  (for claude.ai, with your flights embedded)
  python3 app/build/build.py site       docs/                   (standalone site for GitHub Pages, no personal data)

Layout:
  docs/      the standalone site (GitHub Pages serves this folder)
  app/       source (src/) and build scripts (build/)
  private/   files that contain your flights; never publish these

The artifact build embeds your FlightDiary export so the Load button works on first run.
Put your export at private/flightdiary.csv (or set FLIGHTDIARY_CSV). Optional fixes go in private/overrides.json.
Neither file is ever copied into docs/.
"""
import json, os, re, sys, zipfile
from pathlib import Path

APP = "uFlightly"
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "app" / "build" / "data"
SITE = ROOT / "docs"
PRIVATE = ROOT / "private"
SEED_CSV = Path(os.environ.get("FLIGHTDIARY_CSV", PRIVATE / "flightdiary.csv"))
OVERRIDES = PRIVATE / "overrides.json"  # optional [[old, new], ...] text fixes applied to the export

D3_CDN = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"
TOPO_CDN = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"


def read(name):
    return (DATA / name).read_text(encoding="utf8")


def fill(template, seed_json):
    rep = {
        "/*__AIRPORTS__*/[]": read("airports.json"),
        "/*__WORLD__*/null": read("land.json").strip(),
        "/*__TZS__*/[]": read("tzs.json"),
        "/*__ISO__*/{}": read("iso.json"),
        "/*__LOGOS__*/{}": read("logos.json"),
        '/*__SEED__*/""': seed_json,
    }
    for key, value in rep.items():
        assert key in template, key
        template = template.replace(key, value)
    return template


def build_artifact(template):
    csv = SEED_CSV.read_text(encoding="utf8")
    if OVERRIDES.exists():
        for old, new in json.loads(OVERRIDES.read_text(encoding="utf8")):
            assert old in csv, "override text not found in the export: " + old[:40]
            csv = csv.replace(old, new)
    PRIVATE.mkdir(exist_ok=True)
    out = PRIVATE / "uflightly.html"
    html = fill(template, json.dumps(csv, ensure_ascii=False))
    out.write_text(html, encoding="utf8")
    print("artifact", out.name, len(html))


MANIFEST = {
    "name": APP,
    "short_name": APP,
    "description": "A private flight log that keeps your data on your device.",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#000000",
    "theme_color": "#0C2748",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
    ],
}

SW = """const V = 'uflightly-v1';
const FILES = ['./', 'index.html', 'd3.min.js', 'topojson-client.min.js', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const copy = res.clone(); caches.open(V).then(c => c.put('index.html', copy)); return res; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
"""

README = f"""# {APP}

A private flight log for iPhone. It runs entirely in your browser and keeps your flights on your device. There is no server, no account, and no tracking.

## Features

- **Log flights** by hand with airport search, airline, aircraft, seat, class, notes, rating, and photos.
- **Import** a FlightDiary / myFlightradar24 CSV, or a {APP} backup.
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
"""

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>__APP__</title>
<meta name="description" content="A private flight log that keeps your data on your device.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="__APP__">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#F2F2F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
""".replace("__APP__", APP)

TAIL = """
<script>if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})})}</script>
</body>
</html>
"""


def build_site(template):
    dist = SITE
    dist.mkdir(exist_ok=True)
    t = fill(template, '""')
    t = t.replace(D3_CDN, "d3.min.js").replace(TOPO_CDN, "topojson-client.min.js")
    t = re.sub(r"^<title>.*?</title>\n<meta[^\n]*\n<meta[^\n]*\n<meta[^\n]*\n", "", t, count=1, flags=re.S)
    assert not t.startswith("<title>"), "head not stripped"
    (dist / "index.html").write_text(HEAD + t + TAIL, encoding="utf8")
    (dist / "manifest.webmanifest").write_text(json.dumps(MANIFEST, indent=2) + "\n", encoding="utf8")
    (dist / "sw.js").write_text(SW, encoding="utf8")
    (ROOT / "README.md").write_text(README, encoding="utf8")
    (dist / ".nojekyll").write_text("", encoding="utf8")
    for f in ("d3.min.js", "topojson-client.min.js", "icon-180.png", "icon-192.png", "icon-512.png"):
        assert (dist / f).exists(), f + " is missing from docs/"
    print("site", dist, len((HEAD + t + TAIL)))
    PRIVATE.mkdir(exist_ok=True)
    with zipfile.ZipFile(PRIVATE / "uflightly-site.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(dist.rglob("*")):
            if f.is_file() and ".git" not in f.relative_to(dist).parts and f.name != ".DS_Store":
                z.write(f, f.relative_to(dist))


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    tpl = (ROOT / "app" / "src" / "app.template.html").read_text(encoding="utf8")
    if which in ("artifact", "all"):
        build_artifact(tpl)
    if which in ("site", "all"):
        build_site(tpl)
