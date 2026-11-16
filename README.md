# General Zero Mobile — v2.0
An original, mobile-first RTS browser/PWA playable in landscape and portrait. Lightweight Canvas graphics; no commercial game assets.

**An improved early build, not a complete or equivalent replica of Generals Zero Hour.**

Features: 1v1 / 2v2 / 4v4 AI matches, three factions, easy/normal/hard, economy and base construction, six units, upgrades, tactical artillery, reinforcements, rally points, selection box, minimap, touch/pinch zoom.

Deploy to Vercel: Import this repository; Framework: **Other**, Root: **./**, Build Command: blank; static files will be served directly.

PWA updates automatically on app launch and when returning online, using a network-first service worker. Mid-battle updates offer a reload prompt to avoid losing the match. **Reinstall is not required.** Bump versions in `sw.js`, `pwa.js`, and HTML's `?v=` on each release.

Run `python test_e2e.py` and `python test_gameplay_v2.py` after `python build_offline.py` with Python Playwright+Chromium installed.

See [Arabic instructions](README_AR.md) and [roadmap](ROADMAP_AR.md).