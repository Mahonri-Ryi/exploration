#!/usr/bin/env python3
"""Generate cinematic SFX and ambient loops for Aetheris."""

from __future__ import annotations

import math
import os
import struct
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path("/workspace/public/assets/audio")
OUT.mkdir(parents=True, exist_ok=True)


def write_wav(path: Path, samples: np.ndarray, stereo: bool = False) -> None:
    samples = np.nan_to_num(samples)
    samples = np.clip(samples, -1.0, 1.0)
    if samples.ndim == 1 and stereo:
        samples = np.stack([samples, samples], axis=1)
    if samples.ndim == 2:
        nch = 2
        frames = (samples * 32767.0).astype(np.int16)
        raw = frames.tobytes()
    else:
        nch = 1
        raw = (samples * 32767.0).astype(np.int16).tobytes()
    with wave.open(str(path), "w") as w:
        w.setnchannels(nch)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(raw)


def t(n: int) -> np.ndarray:
    return np.arange(n, dtype=np.float64) / SR


def adsr(n: int, a=0.01, d=0.08, s=0.55, r=0.2) -> np.ndarray:
    env = np.zeros(n, dtype=np.float64)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    ns = max(0, n - na - nd - nr)
    i = 0
    if na:
        env[i : i + na] = np.linspace(0, 1, na, endpoint=False)
        i += na
    if nd:
        env[i : i + nd] = np.linspace(1, s, nd, endpoint=False)
        i += nd
    if ns:
        env[i : i + ns] = s
        i += ns
    if nr and i < n:
        env[i:] = np.linspace(s, 0, n - i)
    return env


def sine(tt: np.ndarray, freq: float, phase: float = 0.0) -> np.ndarray:
    return np.sin(2 * math.pi * freq * tt + phase)


def noise(n: int) -> np.ndarray:
    return np.random.default_rng(7).uniform(-1, 1, n)


def lowpass(x: np.ndarray, alpha: float) -> np.ndarray:
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = acc + alpha * (v - acc)
        y[i] = acc
    return y


def highpass(x: np.ndarray, alpha: float) -> np.ndarray:
    return x - lowpass(x, alpha)


def fade_edges(x: np.ndarray, ms: float = 40) -> np.ndarray:
    n = max(1, int(SR * ms / 1000))
    n = min(n, len(x) // 2)
    env = np.ones_like(x)
    env[:n] = np.linspace(0, 1, n)
    env[-n:] = np.linspace(1, 0, n)
    return x * env


def to_ogg(wav: Path) -> None:
    ogg = wav.with_suffix(".ogg")
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5", str(ogg)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wav.unlink()


def ui_click() -> np.ndarray:
    n = int(0.09 * SR)
    tt = t(n)
    sig = 0.55 * sine(tt, 1840) * adsr(n, 0.002, 0.02, 0.15, 0.06)
    sig += 0.22 * sine(tt, 2760) * adsr(n, 0.001, 0.015, 0.1, 0.05)
    sig += 0.08 * highpass(noise(n), 0.35) * adsr(n, 0.001, 0.01, 0.05, 0.03)
    return fade_edges(sig, 4)


def ui_hover() -> np.ndarray:
    n = int(0.06 * SR)
    tt = t(n)
    return fade_edges(0.28 * sine(tt, 1320) * adsr(n, 0.002, 0.015, 0.2, 0.04), 3)


def place() -> np.ndarray:
    n = int(0.42 * SR)
    tt = t(n)
    thump = 0.7 * sine(tt, 92) * adsr(n, 0.004, 0.06, 0.2, 0.28)
    thump += 0.35 * sine(tt, 180) * adsr(n, 0.003, 0.05, 0.15, 0.2)
    grit = 0.18 * lowpass(noise(n), 0.18) * adsr(n, 0.002, 0.04, 0.12, 0.18)
    chime = 0.18 * sine(tt, 784) * adsr(n, 0.01, 0.08, 0.2, 0.28)
    chime += 0.12 * sine(tt, 1176) * adsr(n, 0.012, 0.1, 0.15, 0.26)
    return fade_edges(thump + grit + chime, 8)


def demolish() -> np.ndarray:
    n = int(0.7 * SR)
    tt = t(n)
    rumble = 0.7 * lowpass(noise(n), 0.08) * adsr(n, 0.01, 0.12, 0.4, 0.4)
    rumble += 0.35 * sine(tt, 55) * adsr(n, 0.005, 0.1, 0.3, 0.4)
    crash = 0.28 * highpass(noise(n), 0.25) * adsr(n, 0.002, 0.08, 0.2, 0.35)
    return fade_edges(rumble + crash, 12)


def error() -> np.ndarray:
    n = int(0.28 * SR)
    tt = t(n)
    sig = 0.32 * sine(tt, 196) * adsr(n, 0.004, 0.05, 0.4, 0.16)
    sig += 0.22 * sine(tt, 233) * adsr(n, 0.004, 0.05, 0.35, 0.16)
    return fade_edges(sig, 6)


def coin() -> np.ndarray:
    n = int(0.38 * SR)
    tt = t(n)
    sig = 0.28 * sine(tt, 988) * adsr(n, 0.004, 0.05, 0.25, 0.22)
    sig += 0.22 * sine(tt, 1318.5) * np.concatenate(
        [np.zeros(int(0.05 * SR)), adsr(n - int(0.05 * SR), 0.004, 0.06, 0.2, 0.2)]
    )
    return fade_edges(sig, 6)


def unlock() -> np.ndarray:
    n = int(1.15 * SR)
    tt = t(n)
    notes = [523.25, 659.25, 783.99, 1046.5]
    sig = np.zeros(n)
    for i, f in enumerate(notes):
        start = int(0.12 * i * SR)
        length = n - start
        tone = 0.18 * sine(t(length), f) * adsr(length, 0.01, 0.12, 0.35, 0.55)
        tone += 0.08 * sine(t(length), f * 2) * adsr(length, 0.012, 0.14, 0.2, 0.5)
        sig[start:] += tone
    return fade_edges(sig, 20)


def whoosh() -> np.ndarray:
    n = int(0.55 * SR)
    base = highpass(lowpass(noise(n), 0.35), 0.08)
    env = adsr(n, 0.08, 0.15, 0.5, 0.28)
    return fade_edges(0.35 * base * env, 10)


def construction() -> np.ndarray:
    n = int(0.5 * SR)
    tt = t(n)
    hit = 0.45 * sine(tt, 140) * adsr(n, 0.002, 0.04, 0.15, 0.2)
    hit += 0.2 * highpass(noise(n), 0.3) * adsr(n, 0.001, 0.03, 0.1, 0.12)
    return fade_edges(hit, 6)


def ambient_day() -> np.ndarray:
    n = int(12 * SR)
    tt = t(n)
    rng = np.random.default_rng(21)
    pad = 0.07 * sine(tt, 110.0) + 0.05 * sine(tt, 164.8, 0.4)
    pad += 0.04 * sine(tt, 220.0, 1.1)
    pad *= 0.65 + 0.35 * sine(tt, 0.07)
    wind = 0.045 * lowpass(rng.uniform(-1, 1, n), 0.03)
    traffic = 0.03 * lowpass(rng.uniform(-1, 1, n), 0.015) * (0.6 + 0.4 * sine(tt, 0.11))
    birds = np.zeros(n)
    for k in range(14):
        start = int(rng.uniform(0.3, 11.2) * SR)
        length = int(rng.uniform(0.08, 0.18) * SR)
        freq = rng.uniform(1800, 3200)
        frag = sine(t(length), freq) * adsr(length, 0.01, 0.03, 0.3, 0.08) * 0.035
        end = min(n, start + length)
        birds[start:end] += frag[: end - start]
    sig = fade_edges(pad + wind + traffic + birds, 180)
    left = sig
    right = np.roll(sig, 220) * 0.96
    return np.stack([left, right], axis=1)


def ambient_night() -> np.ndarray:
    n = int(12 * SR)
    tt = t(n)
    rng = np.random.default_rng(44)
    pad = 0.06 * sine(tt, 82.4) + 0.045 * sine(tt, 123.47, 0.7)
    pad += 0.03 * sine(tt, 196.0, 1.4)
    pad *= 0.7 + 0.3 * sine(tt, 0.05)
    air = 0.03 * lowpass(rng.uniform(-1, 1, n), 0.02)
    crickets = np.zeros(n)
    for k in range(80):
        start = int(rng.uniform(0.2, 11.6) * SR)
        length = int(0.035 * SR)
        freq = rng.uniform(4200, 6200)
        frag = sine(t(length), freq) * adsr(length, 0.002, 0.008, 0.2, 0.02) * 0.028
        end = min(n, start + length)
        crickets[start:end] += frag[: end - start]
    sig = fade_edges(pad + air + crickets, 180)
    return np.stack([sig, np.roll(sig, 340) * 0.94], axis=1)


def main() -> None:
    generators = {
        "ui_click": ui_click,
        "ui_hover": ui_hover,
        "place": place,
        "demolish": demolish,
        "error": error,
        "coin": coin,
        "unlock": unlock,
        "whoosh": whoosh,
        "construction": construction,
        "ambient_day": ambient_day,
        "ambient_night": ambient_night,
    }
    for name, fn in generators.items():
        wav = OUT / f"{name}.wav"
        samples = fn()
        stereo = samples.ndim == 2
        write_wav(wav, samples, stereo=stereo)
        to_ogg(wav)
        ogg = OUT / f"{name}.ogg"
        print(f"{name}: {ogg.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
