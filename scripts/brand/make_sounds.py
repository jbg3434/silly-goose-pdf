"""Synthesize Gus's original honk/squawk cues as small mono WAVs (deterministic)."""
import sys
import wave
from pathlib import Path

import numpy as np

RATE = 22050
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "apps/web/public/sounds")


def envelope(n, attack=0.02, release=0.08):
    env = np.ones(n)
    a, r = int(attack * RATE), int(release * RATE)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    return env


def honk(dur, f0, f1, nasal=0.6, wobble=6.0, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * RATE)) / RATE
    freq = np.linspace(f0, f1, t.size) * (1 + 0.03 * np.sin(2 * np.pi * wobble * t))
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    saw = 2 * ((phase / (2 * np.pi)) % 1) - 1
    buzz = np.sign(np.sin(phase * 2)) * nasal * 0.4
    noise = rng.normal(0, 0.08, t.size)
    sig = saw * 0.6 + buzz + noise
    # crude formant: a short comb filter gives the reedy goose nasal tone
    d = int(RATE / 900)
    sig[d:] += 0.5 * sig[:-d]
    return sig * envelope(t.size)


def write(name, sig):
    sig = sig / (np.abs(sig).max() + 1e-9) * 0.7
    data = (sig * 32767).astype(np.int16)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


OUT.mkdir(parents=True, exist_ok=True)
gap = np.zeros(int(0.06 * RATE))
write("honk.wav", honk(0.32, 420, 360, seed=1))
write("double-honk.wav", np.concatenate([honk(0.18, 460, 420, seed=2), gap, honk(0.26, 480, 380, seed=3)]))
write("squawk.wav", honk(0.45, 700, 1150, nasal=0.9, wobble=14, seed=4))
write("celebrate.wav", np.concatenate([honk(0.12, 500, 560, seed=5), gap, honk(0.12, 560, 640, seed=6), gap, honk(0.3, 660, 820, seed=7)]))
write("sad-honk.wav", honk(0.6, 380, 230, nasal=0.4, wobble=3, seed=8))
print("wrote sounds to", OUT)
