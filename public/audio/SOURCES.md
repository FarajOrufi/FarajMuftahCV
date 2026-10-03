# Website click sound

The only runtime audio asset is `tunnel-mouse-click.wav`.

- User-supplied source: `CV/voice effect/universfield-computer-mouse-click-02-383961.mp3`.
- Filename identifies Universfield, Computer Mouse Click 02, asset 383961.
- Source duration 1.056 s, stereo 48 kHz. Original preserved unchanged.
- Trim: source 0.050–0.180 s, covering press, release and decay. Surrounding near-silence removed.
- Derived WAV: 0.130 s, mono PCM16, 48 kHz, 12524 bytes, normalized peak 0.55.
- Original pitch retained; 1 ms entrance and 8 ms exit fades avoid sharp cut edges.
- Preparation: `scripts/prepare-tunnel-audio.py` (numpy + soundfile).

No background, bass, ambience, oscillator or looping source is loaded or played.
The old derived bass and ratchet files were removed from public/audio; their
original source recordings and earlier offline previews are retained outside the site.

Playback is opt-in, local, and implemented with native Web Audio. Cadence follows
the same smoothed travel as the camera, with a 100 ms minimum interval and at most
two short voices. At rest no new source is created; the last 130 ms click can finish.

License record: this turn uses the user's existing local recording, not a new
download or independent license audit. Retain its download/license documentation
before distribution; do not redistribute it as a standalone sound-library asset.
