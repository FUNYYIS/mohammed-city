# Performance budget

Target: iPhone 13 Pro Max class hardware, landscape Safari.

| Metric | Normal scene | Dense interior |
|---|---:|---:|
| Draw calls | < 150 | < 220 |
| Frame rate | 60 FPS target | 30 FPS floor |
| Active NPCs | 5–10 | 5–8 |
| Dynamic shadow lights | 1 | 1 |
| Device pixel ratio | capped at 1.75 | capped at 1.5 if needed |

The phase-one scene uses one directional shadow, instanced trees, shared materials, capped DPR, frustum culling from Three.js, and no post-processing. Production performance must be measured on a physical iPhone; desktop results are not accepted as iPhone evidence.
