# Tunnel implementation and verification

Local preview: http://127.0.0.1:5173/
Reference: https://singularity.engl.design/

## Implemented

- Three.js/WebGL camera moving along an original Catmull–Rom curve, with a real tube surface and spatially oriented gates.
- Additive wall/dust particles, procedural circuit lines, depth fading, desktop bloom, subtle idle drift and pointer parallax.
- Shared animation clock for the camera and existing text entrances/exits. Native scrolling and anchor navigation remain intact.
- Removed the extra viewport-sized empty gap between scenes through overlapping sticky section ranges.
- Preserved existing midnight-blue palette, local English/Arabic fonts and content.
- Deferred renderer import; lower particle budget/no bloom on phone-sized initial viewports; visibility pause; static reduced-motion view; Canvas 2D fallback after WebGL context loss.

## Verification

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Passed |
| ESLint on the five motion/renderer components | Passed |
| Production build | Passed; renderer chunk size warning noted below |
| Desktop, 1440 × 900 | Reviewed initial scene, gate approach, story, projects, contact |
| Forward/reverse wheel input | Camera distance 8 → 35.27 → 8; peak FOV ~67.18°, settles to 60° |
| Idle | Camera sway changes while longitudinal distance stays fixed |
| Eight subsequent scenes | Reading position opacity 1, `inert=false`, monotonically increasing camera distance |
| Anchor navigation | Projects link reaches visible, interactive project panel |
| Phone viewport, 390 × 844 | English and Arabic reviewed; no horizontal overflow |
| Landscape, 844 × 390 | All panels readable without zoom; no horizontal overflow |
| Reduced motion | All nine panels visible and interactive; camera diagnostics unchanged across idle samples |
| Forced WebGL context loss | Replaced by one Canvas 2D fallback; content preserved |
| Runtime errors in final scene sweep | None |

120-frame requestAnimationFrame samples: ~60.45 fps desktop, ~60.22 fps phone-sized viewport; p95 frame intervals ~16.9 / 17.1 ms. These are measurements on the test machine, not physical-phone GPU benchmarks.

## Visual comparison and refinements

Compared live reference and local screenshots at equal desktop viewport size. First pass had overly bright circuits and a large foreground gate. Reduced line/rib opacity, moved the first gate deeper, adjusted particle sizing, and varied circuit bends. Subsequent passes verified depth during scrolling and the readability of the retained centered typography. The implementation follows the reference's 3D principle; it is not a pixel-identical copy or a reuse of its application bundle.

Screenshots: `tunnel-desktop-final.png`, `tunnel-story-final.png`, `tunnel-crossing-final.png`, `tunnel-contact-final.png`, `tunnel-mobile-en.png`, `tunnel-mobile-ar.png`, `tunnel-mobile-story-ar.png`, `tunnel-fallback.png`, `tunnel-reference-top.png`, `tunnel-reference-scroll.png`.

## Known limits

- The lazily loaded Three.js renderer produces a >500 kB minified chunk warning. It is intentionally outside the initial content module.
- Phone testing used Chromium viewport emulation, not physical Safari/iOS hardware.
- No deployment, content rewrite, font change, or external project mutation was performed.
