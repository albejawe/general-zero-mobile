# General Zero Mobile — Tactical RTS Alpha 4.0

An **original** single-player real-time strategy game for mobile browsers, playable in portrait or landscape. Inspired by classic base-building strategy (without using any commercial game's assets).

This is a working, tested **alpha**, not a polished commercial game and **not** a replica of Generals Zero Hour. The technical milestones and remaining art/gameplay work are documented rather than claimed complete.

## Play

Open the deployed website, choose a faction/difficulty and play **1v1, 2v2 or 4v4**. All players other than you are AI (the game does **not** offer multiplayer networking). Three AI difficulty levels, supply outposts, exploration/fog, infantry/rocket/scout/tank/artillery/elite/air units, upgrades, repairs/sales, artillery strikes, formation selection, tactical commands, sound effects and save/continue.

Use tabs **Build / Units / Upgrades / Support**. Build a refinery on a yellow crystal, then barracks, factories and an airfield. Hold supply points to increase income; use rockets against armour and air; use scouts to spot enemies.

The **Save** button is in the pause menu. Progress autosaves periodically (and when the page goes into the background) to local browser storage. Installed PWA updates to a new version without reinstallation; a match in progress is saved before a reload when supported.

## Deployment

Vercel: import [this repository](https://github.com/albejawe/general-zero-mobile) as a static site. Framework **Other**, root `./`, no build command or environment variables. Once Git is linked, pushes to `main` deploy automatically.

## Tests

```bash
python -m pip install playwright==1.57.0
python -m playwright install chromium
python build_offline.py
python test_game.py
python test_touch.py
node test_pwa.cjs
python test_pwa_browser.py
```

`test_game` covers 9 map/difficulty combinations, 4 screen sizes, saving/loading a live match, and 4v4 >150 units simulated. `test_touch` uses real simulated taps in both orientations. `test_pwa.cjs` checks the mocked service worker; `test_pwa_browser.py` validates a REAL Chromium service-worker install, offline reload, a normal version update without reinstalling, and preservation of a live match across a second update. **Safari iPhone and real Android performance/PWA migration remain unverified**.

## Project structure

- `index.html`, `styles.css`, `game.js`: browser game source.
- `sprite_atlas.png`, `build_sprites.py`: original, generated 21-tile sprite atlas (7 roles × 3 factions).
- `sw.js`, `pwa.js`, `manifest.webmanifest`: PWA installation, caching and version updates.
- `ZERO_FRONTIER_OFFLINE.html`: generated standalone file (includes inline JS/CSS/sprite atlas).
- `test_game.py`, `test_touch.py`, `test_pwa.cjs`, `test_pwa_browser.py`: automated checks.
- `MASTER_GAME_PLAN_AR.md`: long-term acceptance gates.
- `RELEASE_REPORT_AR.md`: scope, tests, unfinished work.

All artwork/code in this repository is original. The game runs entirely locally in the browser without paid backend or external services; multiplayer mode is not implemented.
