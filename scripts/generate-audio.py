#!/usr/bin/env python3
"""Cinematic SFX + ambience for Aetheris (layered synthesis, no stock beeps)."""

from __future__ import annotations

import math
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 48000
OUT = "/workspace/public/assets/audio"
os.makedirs(OUT, exist_ok=True)


def fade(n: int, a: int, r: int) -> np.ndarray:
    env = np.ones(n, dtype=np.float64)
    a = max(1, min(a, n // 3))
    r = max(1, min(r, n - a))
    env[:a] *= np.linspace(0, 1, a) ** 1.6
    env[-r:] *= np.linspace(1, 0, r) ** 1.35
    return env


def hp(x: np.ndarray, cutoff: float) -> np.ndarray:
    rc = 1.0 / (2 * math.pi * float(np.asarray(cutoff).reshape(-1)[0]))
    a = rc / (rc + 1.0 / SR)
    y = np.empty_like(x)
    prev_x = 0.0
    prev_y = 0.0
    for i, s in enumerate(x):
        prev_y = a * (prev_y + s - prev_x)
        prev_x = float(s)
        y[i] = prev_y
    return y


def hp_sweep(x: np.ndarray, lo: float, hi: float, power: float = 1.4) -> np.ndarray:
    t = np.linspace(0.0, 1.0, len(x))
    cutoff = lo + (hi - lo) * (t**power)
    y = np.empty_like(x)
    prev_x = 0.0
    prev_y = 0.0
    inv_sr = 1.0 / SR
    two_pi = 2 * math.pi
    for i, s in enumerate(x):
        rc = 1.0 / (two_pi * max(40.0, float(cutoff[i])))
        a = rc / (rc + inv_sr)
        prev_y = a * (prev_y + s - prev_x)
        prev_x = float(s)
        y[i] = prev_y
    return y


def lp(x: np.ndarray, cutoff: float) -> np.ndarray:
    rc = 1.0 / (2 * math.pi * cutoff)
    a = (1.0 / SR) / (rc + 1.0 / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i, s in enumerate(x):
        acc += a * (s - acc)
        y[i] = acc
    return y


def bp(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return lp(hp(x, lo), hi)


def sine(n: int, freq: float, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    return np.sin(2 * math.pi * freq * t + phase)


def exp_decay(n: int, ms: float) -> np.ndarray:
    tau = max(0.004, ms / 1000.0)
    return np.exp(-np.arange(n) / (SR * tau))


def noise(n: int) -> np.ndarray:
    return np.random.default_rng(7).standard_normal(n)


def noise_seed(n: int, seed: int) -> np.ndarray:
    return np.random.default_rng(seed).standard_normal(n)


def soft_clip(x: np.ndarray, drive: float = 1.15) -> np.ndarray:
    return np.tanh(x * drive)


def stereo(mono: np.ndarray, width: float = 0.18) -> np.ndarray:
    n = len(mono)
    delay = int(SR * 0.0007)
    right = np.zeros(n)
    right[delay:] = mono[:-delay] if delay < n else 0
    mid = mono
    side = (right - mono) * width
    L = mid - side
    R = mid + side
    return np.stack([L, R], axis=1)


def limiter(x: np.ndarray, ceiling: float = 0.89) -> np.ndarray:
    peak = np.max(np.abs(x))
    if peak < 1e-9:
        return x
    gain = min(1.0, ceiling / peak)
    return x * gain


def write_wav(path: str, stereo_or_mono: np.ndarray) -> None:
    data = np.asarray(stereo_or_mono, dtype=np.float64)
    if data.ndim == 1:
        data = stereo(data, 0.12)
    data = limiter(data)
    pcm = np.clip(data, -1, 1)
    interleaved = (pcm * 32767.0).astype(np.int16).reshape(-1)
    with wave.open(path, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(interleaved.tobytes())


def encode(name: str, samples: np.ndarray) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, f"{name}.wav")
        write_wav(wav, samples)
        dest = os.path.join(OUT, f"{name}.ogg")
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-i",
                wav,
                "-c:a",
                "libvorbis",
                "-q:a",
                "7",
                dest,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    print("wrote", dest, os.path.getsize(dest))


def mix(*parts: np.ndarray) -> np.ndarray:
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def room(x: np.ndarray, delay_ms: float = 26.0, mix: float = 0.2) -> np.ndarray:
    d = max(1, int(SR * delay_ms / 1000.0))
    y = np.zeros(len(x) + d * 3)
    y[: len(x)] += x
    y[d : d + len(x)] += x * mix
    y[d * 2 : d * 2 + len(x)] += x * mix * 0.42
    y[d * 3 : d * 3 + len(x)] += x * mix * 0.18
    return y


# --- SFX -------------------------------------------------------------------


def sfx_ui_click() -> np.ndarray:
    n = int(SR * 0.11)
    body = bp(noise_seed(n, 11), 900, 2800) * exp_decay(n, 18) * 0.55
    tick = sine(n, 1840) * exp_decay(n, 8) * 0.12
    wood = bp(noise_seed(n, 19), 220, 700) * exp_decay(n, 28) * 0.35
    return soft_clip(mix(body, tick, wood) * fade(n, 8, 90) * 0.72)


def sfx_ui_hover() -> np.ndarray:
    n = int(SR * 0.06)
    air = bp(noise_seed(n, 3), 2400, 6200) * exp_decay(n, 12) * 0.22
    ping = sine(n, 2620) * exp_decay(n, 9) * 0.05
    return mix(air, ping) * fade(n, 6, 40) * 0.55


def sfx_place() -> np.ndarray:
    n = int(SR * 0.42)
    thump = lp(sine(n, 72) * exp_decay(n, 90) + sine(n, 118) * exp_decay(n, 55) * 0.45, 240)
    clack = bp(noise_seed(n, 41), 700, 2400) * exp_decay(n, 22) * 0.7
    grit = bp(noise_seed(n, 42), 180, 900) * exp_decay(n, 70) * 0.28
    air = hp(noise_seed(n, 43), 4000) * exp_decay(n, 40) * 0.08
    return room(soft_clip(mix(thump * 0.85, clack, grit, air) * fade(n, 12, 220) * 0.78), 22, 0.16)


def sfx_construction() -> np.ndarray:
    n = int(SR * 0.55)
    hammer = mix(
        lp(sine(n, 96) * exp_decay(n, 40), 300) * 0.7,
        bp(noise_seed(n, 51), 800, 3200) * exp_decay(n, 16) * 0.85,
    )
    wood = bp(noise_seed(n, 52), 250, 1100) * exp_decay(n, 80) * 0.4
    second = np.zeros(n)
    offset = int(SR * 0.09)
    hit2 = bp(noise_seed(n - offset, 53), 900, 2800) * exp_decay(n - offset, 14) * 0.45
    second[offset:] = hit2
    return room(soft_clip(mix(hammer, wood, second) * fade(n, 10, 260) * 0.74), 24, 0.18)


def sfx_demolish() -> np.ndarray:
    n = int(SR * 0.7)
    rumble = lp(noise_seed(n, 61), 180) * exp_decay(n, 220) * 0.9
    crack = bp(noise_seed(n, 62), 600, 3500)
    crack *= (exp_decay(n, 18) + 0.35 * exp_decay(n, 90))
    debris = hp(noise_seed(n, 63), 1800) * exp_decay(n, 160) * 0.22
    return room(soft_clip(mix(rumble, crack * 0.55, debris) * fade(n, 8, 320) * 0.8), 30, 0.22)


def sfx_error() -> np.ndarray:
    n = int(SR * 0.28)
    t = np.arange(n) / SR
    a = sine(n, 196) * np.exp(-t * 9) * 0.28
    b = sine(n, 147) * np.exp(-t * 7)
    b[: int(SR * 0.05)] = 0
    body = lp(a + b * 0.32, 420)
    air = bp(noise_seed(n, 71), 400, 1400) * exp_decay(n, 40) * 0.12
    return mix(body, air) * fade(n, 20, 140) * 0.7


def sfx_coin() -> np.ndarray:
    n = int(SR * 0.38)
    partials = (
        sine(n, 987) * 0.22
        + sine(n, 1480) * 0.12
        + sine(n, 2210) * 0.07
        + sine(n, 3120) * 0.04
    )
    metallic = partials * exp_decay(n, 95)
    shimmer = bp(noise_seed(n, 81), 3000, 9000) * exp_decay(n, 35) * 0.08
    return soft_clip(mix(metallic, shimmer) * fade(n, 10, 180) * 0.62, 1.05)


def sfx_unlock() -> np.ndarray:
    n = int(SR * 0.85)
    t = np.arange(n) / SR
    chord = (
        sine(n, 392) * np.exp(-t * 3.2)
        + sine(n, 523.25) * np.exp(-t * 2.8) * 0.7
        + sine(n, 659.25) * np.exp(-t * 2.4) * 0.45
        + sine(n, 784) * np.exp(-t * 3.6) * 0.28
    )
    bloom = bp(noise_seed(n, 91), 200, 1800) * exp_decay(n, 180) * 0.12
    spark = hp(noise_seed(n, 92), 5000) * exp_decay(n, 50) * 0.06
    return room(soft_clip(mix(chord * 0.42, bloom, spark) * fade(n, 40, 380) * 0.7), 38, 0.24)


def sfx_whoosh() -> np.ndarray:
    n = int(SR * 1.15)
    t = np.arange(n) / SR
    sweep = hp_sweep(noise_seed(n, 101), 180, 5200, 1.35)
    sweep *= np.sin(math.pi * np.clip(t / 1.05, 0, 1)) ** 1.2
    body = lp(noise_seed(n, 102), 320) * np.sin(math.pi * t / 1.15) * 0.35
    return room(soft_clip(mix(sweep * 0.55, body) * fade(n, 80, 220) * 0.72), 32, 0.2)


def sfx_fire() -> np.ndarray:
    n = int(SR * 0.9)
    roar = lp(noise_seed(n, 111), 280) * 0.55
    pops = np.zeros(n)
    rng = np.random.default_rng(112)
    for _ in range(14):
        i = int(rng.integers(0, n - 800))
        burst = bp(noise_seed(900, 113 + i), 1200, 6000) * exp_decay(900, 12) * rng.uniform(0.15, 0.4)
        pops[i : i + 900] += burst
    hiss = hp(noise_seed(n, 114), 3500) * 0.08
    return soft_clip(mix(roar, pops, hiss) * fade(n, 40, 160) * 0.7)


def ambient_day() -> np.ndarray:
    n = int(SR * 8.0)
    wind = lp(noise_seed(n, 201), 380) * 0.18
    leaves = bp(noise_seed(n, 202), 1800, 5200) * 0.04
    t = np.arange(n) / SR
    birds = np.zeros(n)
    rng = np.random.default_rng(203)
    for k in range(9):
        start = int(rng.uniform(0.4, 7.2) * SR)
        dur = int(rng.uniform(0.08, 0.18) * SR)
        if start + dur >= n:
            continue
        f = rng.uniform(2100, 3400)
        chirp = sine(dur, f) * np.hanning(dur) * rng.uniform(0.03, 0.07)
        birds[start : start + dur] += chirp
    wash = lp(sine(n, 78) * 0.02 + sine(n, 110) * 0.015, 200)
    bed = mix(wind, leaves, birds, wash) * fade(n, 600, 700)
    return limiter(bed, 0.45)


def ambient_night() -> np.ndarray:
    n = int(SR * 8.0)
    drone = lp(sine(n, 46) * 0.06 + sine(n, 69) * 0.04 + noise_seed(n, 301) * 0.08, 140)
    t = np.arange(n) / SR
    crickets = np.zeros(n)
    rng = np.random.default_rng(302)
    for k in range(40):
        start = int(rng.uniform(0.1, 7.6) * SR)
        dur = int(0.035 * SR)
        if start + dur >= n:
            continue
        chirp = sine(dur, rng.uniform(4200, 6100)) * np.hanning(dur) * 0.035
        crickets[start : start + dur] += chirp
    breeze = bp(noise_seed(n, 303), 400, 1600) * 0.05
    bed = mix(drone, crickets, breeze) * fade(n, 700, 800)
    return limiter(bed, 0.4)


def main() -> None:
    encode("ui_click", sfx_ui_click())
    encode("ui_hover", sfx_ui_hover())
    encode("place", sfx_place())
    encode("construction", sfx_construction())
    encode("demolish", sfx_demolish())
    encode("error", sfx_error())
    encode("coin", sfx_coin())
    encode("unlock", sfx_unlock())
    encode("whoosh", sfx_whoosh())
    encode("fire", sfx_fire())
    encode("ambient_day", ambient_day())
    encode("ambient_night", ambient_night())


if __name__ == "__main__":
    main()
