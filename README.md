# General Zero Mobile — Alpha 3.0

An original, mobile-first RTS for browser and PWA, with no proprietary game assets. This is an **alpha**, not a finished game equivalent to Command & Conquer Generals Zero Hour.

## Included
Three maps (1v1, 2v2, 4v4 vs computer), 3 factions with distinct doctrines, easy/medium/hard AI, tactical resource outposts, fog-of-war scouting, infantry/armour/air counterplay, gunships and airfields, unit ranks, construction, repairs, sales, tactical strikes, rally points, tactical hold/retreat/scatter commands, responsive portrait + landscape UI, touch controls, original audio effects and minimap.

## Deploy to Vercel
Import this repository; Framework **Other**, Root `./`, build command blank. Static HTML/CSS/JS files deploy directly. New pushes update the site when Git integration is enabled. PWA uses versioned network-first service worker and offline cache; no PWA reinstallation is needed. A running match prompts before applying a new version.

## Tests
Run `python build_offline.py`, then `python test_gameplay_v2.py` and `python test_gameplay_v3.py` with Python Playwright/Chromium installed. Check PWA behaviour manually on real iOS Safari and Android; this cannot be certified from browser simulation alone.

See [Arabic gameplay](README_AR.md) and [rebuild plan](REBUILD_PLAN_AR.md).
