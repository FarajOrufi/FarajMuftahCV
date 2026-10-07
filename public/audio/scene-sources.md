# Scene audio v1

Processed for this portfolio under the Pixabay Content License:
https://pixabay.com/service/license-summary/

- Approach: https://pixabay.com/sound-effects/film-special-effects-menu-open-sound-effect-432999/ — source 0.38–1.25 s, 180 ms loop crossfade.
- Crossing v2: https://pixabay.com/sound-effects/technology-mini-ui-window-open-01-614741/ — first 120 ms of prepared v1 (original 0.02–0.14 s), final 15 ms fade. Attack preserved; peak window ~25 ms, direction-aware camera anticipation offsets this attack. No sustained tail.
- Travel/departure: https://pixabay.com/sound-effects/film-special-effects-cinematic-designed-sci-fi-whoosh-transition-nexawave-228295/ — source 0.65–2.30 s, 280 ms loop crossfade.
- Darkness/exit: https://pixabay.com/sound-effects/film-special-effects-space-hole-test-23665/ — source 30–34 s, 220 Hz soft spectral lowpass, 550 ms loop crossfade.

48 kHz stereo PCM; RMS matching with peak cap 0.62. Original files preserved outside public assets. Spatial envelopes select audible roles; every layer shares the movement gate. No ambient playback at rest. Native Web Audio only; no third-party playback requests.

Refinement: approach layer plays at 0.85 rate (18% longer and slightly deeper), level 1.00 instead of 0.80 (+1.94 dB). Dark layer level 0.82 instead of 0.65 (+2.02 dB). Travel v1 unchanged. Global 1.30 output gain retained.
