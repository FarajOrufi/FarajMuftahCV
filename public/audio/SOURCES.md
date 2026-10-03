# Website sound engine

The runtime uses no downloaded click or background file. Three procedural Sci-Fi
layers are generated in `app/tunnel-audio.ts` and follow the same smoothed travel
clock as the camera:

- filtered air pressure follows scroll velocity;
- a deep sub-drop triggers once when crossing into a new scene;
- a quiet harmonic chime plays when movement settles.

Playback is opt-in and respects page visibility and reduced-motion preferences.
