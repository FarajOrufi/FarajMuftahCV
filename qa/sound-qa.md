# Click-only audio QA — 2026-10-03

Supersedes previous bass/ratchet tests.

## Asset analysis and implementation

- Source: user-selected `universfield-computer-mouse-click-02-383961.mp3`, 1.056 s, 48 kHz.
- 10 ms amplitude windows locate press around 0.06 s, release around 0.13 s and decay by 0.17 s. Trimmed to 0.05–0.18 s (130 ms), preserving pitch and complete click, with 1 ms / 8 ms fades.
- One runtime asset: `public/audio/tunnel-mouse-click.wav`, mono PCM16 48 kHz, 12524 bytes, peak 0.55.
- Deleted obsolete public bass and ratchet WAVs. All original recordings and the offline Deep Sub Drop preview are preserved outside the website.
- Audio engine contains no background source, background gain, ambience meter or loop. Its only fetch is the new mouse-click WAV.
- Clicks follow smoothed camera travel in either direction, with 100 ms minimum spacing and at most two voices. Playback rate remains 1; gain responds gently to travel speed.
- At rest no new clicks are started; the current 130 ms click may finish naturally. Reduced motion suppresses ticks. Opt-in, mute, visibility pause and resource cleanup remain.

## Verification

- TypeScript, changed-file ESLint and production build passed. Existing large-chunk warning remains unrelated.
- In-app Chromium: Arabic scrolling generated 13 clicks with measured output maxPeak 0.379844. Once settled: voices=0 and instantaneous peak=0.
- Fresh English activation and scroll: 3 clicks, measured output maxPeak 0.379844, then speed=0, voices=0 and instantaneous peak=0.
- These measurements establish actual nonzero decoded output during motion and zero output at rest; the pressed button alone was not used as proof.
- Arabic mute reports enabled=false and peak=0. Language switching preserves the audio engine rather than loading a separate recording.
- No warning/error browser log entries. Screenshot: `click-only.png`.
- The test page is left muted. No listening test through physical speakers was performed; output was verified through the browser analyser.

Some initial rapid checks returned no/stale telemetry while the page initialized;
verification was repeated after initialization and used advancing audio timestamps
and measured maxPeak rather than treating initial button state as a pass.
