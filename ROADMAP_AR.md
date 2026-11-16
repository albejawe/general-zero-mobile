# Roadmap — General Zero Mobile

## Implemented in v2
- Responsive command UI in portrait and landscape, three maps and three AI difficulties.
- Enhanced Canvas battlefield details, roads, rocks, resource crystals, vehicles and buildings.
- Tactical support: artillery strike + reinforcements; economy, 3 research upgrades, rally points and selection box.
- Cached A* navigation with a binary heap, capped rendering pixel ratio on large matches.
- PWA cache versioning with network-first resources and offline fallback; safe refresh when updates arrive.
- Browser regression tests for orientations, building/training, battle outcomes and no runtime exceptions.

## Remaining requirements for a truly high-quality RTS
1. Art-directed original high-quality 3D/2.5D sprite atlas and animations, original sounds.
2. Harvesting vehicles, power infrastructure, richer tech trees and balancing.
3. Fog of war and scouting, meaningful line of sight.
4. Advanced AI coordinated attacks, defense, retreats and tactics.
5. Better unit collision, formations, pathfinding and army control.
6. Sustained physical-device performance profiling for 4v4 on iOS and Android.
7. Campaign/scenarios and saving/resuming matches.

No false “zero bug” guarantee. This remains an early standalone game with significant work remaining versus C&C: Generals Zero Hour.