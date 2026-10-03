"""Prepare the sole website sound: the user's mouse click, without background.
Requires numpy and soundfile. Source recordings are never modified.
"""
from pathlib import Path
import json
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'voice effect' / 'universfield-computer-mouse-click-02-383961.mp3'
OUTPUT = ROOT / 'public' / 'audio' / 'tunnel-mouse-click.wav'
data, rate = sf.read(SOURCE, dtype='float64', always_2d=True)
# 10 ms energy windows: press at .06 s, release at .13 s, decay by .17 s.
# Preserve the complete click at its original pitch; remove surrounding silence.
start, end = round(rate * .05), round(rate * .18)
click = data[start:end].mean(axis=1)
click -= click.mean()
attack, release = round(rate * .001), round(rate * .008)
click[:attack] *= np.linspace(0, 1, attack)
click[-release:] *= np.linspace(1, 0, release)
click *= .55 / max(np.max(np.abs(click)), 1e-10)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
sf.write(OUTPUT, click, rate, subtype='PCM_16')
print(json.dumps({'source_seconds':len(data)/rate, 'source_range_seconds':[start/rate,end/rate],
                 'output_seconds':len(click)/rate, 'sample_rate':rate,
                 'peak':float(np.max(np.abs(click))), 'bytes':OUTPUT.stat().st_size}, indent=2))
