"""Prepare a motion loop from the licensed source; keep the original unchanged."""
import hashlib
import io
import importlib.util
import json
from pathlib import Path
import wave
import numpy as np

root = Path(__file__).resolve().parents[1]
source = root / "qa/audio-source-research-20261005/originals/646-full.wav"
destination = root / "public/audio/dark-oscillator-motion-v1.wav"
report_path = root / "qa/dark-oscillator-20261005/preparation.json"
with wave.open(str(source), "rb") as reader:
    rate, channels = reader.getframerate(), reader.getnchannels()
    assert reader.getsampwidth() == 2 and channels == 2
    x = np.frombuffer(reader.readframes(reader.getnframes()), dtype="<i2").reshape(-1, channels).astype(np.float64) / 32768

# Remove DC/excessive sub-bass, retain the low oscillator character and stereo.
x -= x.mean(axis=0)
frequencies = np.fft.rfftfreq(len(x), 1 / rate)
hp = frequencies**2 / (frequencies**2 + 22**2)
lp = 1 / np.sqrt(1 + (frequencies / 2200)**8)
filtered = np.fft.irfft(np.fft.rfft(x, axis=0) * (hp * lp)[:, None], n=len(x), axis=0)
start, crossfade = round(.15 * rate), round(.12 * rate)
head = filtered[start:start+crossfade]
best = None
for end in range(round(2.03*rate), round(2.27*rate), 16):
    tail = filtered[end-crossfade:end]
    correlation = float(np.sum(head*tail) / np.sqrt(np.sum(head*head)*np.sum(tail*tail)))
    if best is None or correlation > best[0]: best = (correlation, end)
correlation, end = best
t = np.linspace(0, 1, crossfade, endpoint=False)[:, None]
blend = t*t*(3-2*t)
overlap = filtered[end-crossfade:end]*(1-blend) + head*blend
loop = np.concatenate([filtered[start+crossfade:end-crossfade], overlap])
# A retained periodic buffer, not fade-in/fade-out silence at each loop boundary.
loop *= .62 / np.max(np.abs(loop))
assert np.isfinite(loop).all()
seam = loop[0]-loop[-1]
neighbors = ((loop[1]-loop[0]) + (loop[-1]-loop[-2]))/2
assert np.max(np.abs(seam-neighbors)) < .002, "Boundary must be a normal sample step"
pcm = np.round(loop*32767).astype("<i2")
output = io.BytesIO()
with wave.open(output,"wb") as writer:
    writer.setnchannels(channels); writer.setsampwidth(2); writer.setframerate(rate)
    writer.writeframes(pcm.tobytes())
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_bytes(output.getvalue())
spec = importlib.util.spec_from_file_location("amplitude", r"C:\Users\Faraj Muftah\.codex\skills\web-motion-audio\scripts\analyze_audio.py")
amplitude = importlib.util.module_from_spec(spec); spec.loader.exec_module(amplitude)
with wave.open(str(destination),"rb") as reader:
    analysis = amplitude.analyze_pcm(reader,window_ms=5,threshold_db=-45,max_seconds=30)
report = {"source":"https://assets.mixkit.co/active_storage/sfx/646/646.wav", "title":"Dark synth oscillator",
          "license":"https://mixkit.co/license/modal/sfxFree/", "original_sha256":hashlib.sha256(source.read_bytes()).hexdigest(),
          "source_start_seconds":start/rate,"source_end_seconds":end/rate,"crossfade_seconds":crossfade/rate,
          "crossfade_correlation":correlation,"loop_seconds":len(loop)/rate,
          "filters":"DC removal; smooth highpass 22 Hz and lowpass 2200 Hz; no extra reverb/noise",
          "normalization":"Global stereo peak 0.62; original relative stereo balance preserved",
          "seam_step":seam.tolist(),"seam_deviation_from_neighbor_steps":(seam-neighbors).tolist(),
          "output":str(destination),"output_sha256":hashlib.sha256(output.getvalue()).hexdigest(),"analysis":analysis,
          "limits":"Numerical preparation and seam check, not human audition or physical A/V synchronization"}
report_path.parent.mkdir(parents=True,exist_ok=True)
report_path.write_text(json.dumps(report,indent=2),encoding="utf8")
print(json.dumps({k:v for k,v in report.items() if k!="analysis"},indent=2))
print(json.dumps({k:analysis[k] for k in ['peak_dbfs','rms_dbfs','onset_ms','trailing_below_threshold_ms','near_full_scale_sample_fraction']},indent=2))
