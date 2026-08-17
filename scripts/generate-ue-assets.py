#!/usr/bin/env python3
"""Build runtime PNG textures and WAV SFX for the native Unreal project."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path("/workspace")
TEX = ROOT / "Unreal/Aetheris/Content/Runtime/Textures"
AUD = ROOT / "Unreal/Aetheris/Content/Runtime/Audio"
WEB_AUD = ROOT / "public/assets/audio"
WEB_TEX = ROOT / "public/assets/textures"
TEX.mkdir(parents=True, exist_ok=True)
AUD.mkdir(parents=True, exist_ok=True)


def save(img: Image.Image, name: str) -> None:
    dest = TEX / name
    img.save(dest, "PNG", optimize=True)
    print("tex", dest, dest.stat().st_size)


def noise(w: int, h: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.random((h, w), dtype=np.float32)


def fbm(w: int, h: int, seed: int, octaves: int = 5) -> np.ndarray:
    acc = np.zeros((h, w), dtype=np.float32)
    amp = 0.5
    for i in range(octaves):
        sw, sh = max(4, w >> i), max(4, h >> i)
        n = noise(sw, sh, seed + i * 17)
        n = np.array(Image.fromarray((n * 255).astype(np.uint8), "L").resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
        acc += n * amp
        amp *= 0.5
    acc -= acc.min()
    acc /= max(1e-6, acc.max())
    return acc


def brick(path: str, base: tuple[int, int, int], seed: int) -> None:
    w = h = 1024
    mortar = tuple(int(c * 0.42) for c in (210, 200, 186))
    img = Image.new("RGB", (w, h), mortar)
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed)
    bh, bw = 36, 86
    for y, row in enumerate(range(0, h + bh, bh)):
        ox = (bw // 2) if y % 2 else 0
        for x in range(-bw, w + bw, bw):
            m = 0.72 + float(rng.random()) * 0.38
            c = tuple(max(0, min(255, int(v * m + rng.integers(-8, 9)))) for v in base)
            d.rounded_rectangle((x + ox + 2, row + 2, x + ox + bw - 4, row + bh - 4), radius=3, fill=c)
    grain = fbm(w, h, seed, 4)
    arr = np.array(img, dtype=np.float32)
    arr *= (0.88 + grain[:, :, None] * 0.24)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").filter(ImageFilter.SMOOTH)
    save(img, path)


def plaster(path: str, base: tuple[int, int, int], seed: int) -> None:
    w = h = 1024
    n = fbm(w, h, seed, 6)
    speckle = noise(w, h, seed + 9)
    arr = np.zeros((h, w, 3), dtype=np.float32)
    for i in range(3):
        arr[:, :, i] = base[i] * (0.82 + n * 0.22 + speckle * 0.06)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed + 3)
    for _ in range(18):
        d.line(
            [(int(rng.integers(0, w)), int(rng.integers(0, h))), (int(rng.integers(0, w)), int(rng.integers(0, h)))],
            fill=(70, 58, 48),
            width=1,
        )
    save(img.filter(ImageFilter.SMOOTH), path)


def roof_tiles(path: str) -> None:
    w = h = 1024
    img = Image.new("RGB", (w, h), (78, 30, 24))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(9)
    for y, row in enumerate(range(0, h, 18)):
        ox = 16 if y % 2 else 0
        for x in range(-24, w, 32):
            m = 0.62 + float(rng.random()) * 0.5
            c = (int(148 * m), int(46 * m), int(34 * m))
            d.polygon([(x + ox, y + 16), (x + ox + 16, y), (x + ox + 32, y + 16)], fill=c)
            d.line((x + ox, y + 16, x + ox + 16, y), fill=(40, 16, 12), width=1)
    save(img.filter(ImageFilter.SMOOTH), path)


def asphalt(path: str) -> None:
    w = h = 1024
    n = fbm(w, h, 21, 5)
    arr = np.stack(
        [
            (34 + n * 36).astype(np.uint8),
            (36 + n * 34).astype(np.uint8),
            (40 + n * 32).astype(np.uint8),
        ],
        axis=2,
    )
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    d.rectangle((w // 2 - 5, 48, w // 2 + 5, h - 48), fill=(214, 186, 72))
    for y in range(80, h - 80, 90):
        d.rectangle((w // 2 - 5, y + 40, w // 2 + 5, y + 70), fill=(40, 42, 44))
    save(img, path)


def grass(path: str) -> None:
    w = h = 1024
    n = fbm(w, h, 33, 6)
    blades = noise(w, h, 77)
    arr = np.stack(
        [
            (36 + n * 38 + blades * 10).astype(np.uint8),
            (72 + n * 78 + blades * 18).astype(np.uint8),
            (24 + n * 26).astype(np.uint8),
        ],
        axis=2,
    )
    save(Image.fromarray(arr, "RGB"), path)


def sand(path: str) -> None:
    w = h = 1024
    n = fbm(w, h, 44, 5)
    arr = np.stack(
        [
            (176 + n * 48).astype(np.uint8),
            (154 + n * 36).astype(np.uint8),
            (104 + n * 24).astype(np.uint8),
        ],
        axis=2,
    )
    save(Image.fromarray(arr, "RGB"), path)


def water(path: str) -> None:
    w = h = 1024
    x = np.linspace(0, 14 * np.pi, w)
    y = np.linspace(0, 14 * np.pi, h)
    xx, yy = np.meshgrid(x, y)
    wave = 0.5 + 0.28 * np.sin(xx * 0.65 + yy * 0.38) + 0.22 * np.cos(yy * 0.7 + xx * 0.2)
    n = fbm(w, h, 61, 4)
    wave = np.clip(wave * 0.82 + n * 0.18, 0, 1)
    r = (6 + wave * 22).astype(np.uint8)
    g = (42 + wave * 58).astype(np.uint8)
    b = (68 + wave * 86).astype(np.uint8)
    save(Image.fromarray(np.stack([r, g, b], axis=2), "RGB"), path)


def window(path: str) -> None:
    w = h = 1024
    img = Image.new("RGB", (w, h), (18, 16, 20))
    d = ImageDraw.Draw(img)
    for gy in range(6):
        for gx in range(4):
            x0, y0 = 28 + gx * 250, 22 + gy * 168
            d.rectangle((x0, y0, x0 + 214, y0 + 140), fill=(28, 36, 48), outline=(12, 10, 10), width=10)
            d.rectangle((x0 + 14, y0 + 12, x0 + 200, y0 + 128), fill=(148, 196, 214))
            d.line((x0 + 107, y0 + 12, x0 + 107, y0 + 128), fill=(22, 18, 16), width=6)
            d.line((x0 + 14, y0 + 70, x0 + 200, y0 + 70), fill=(22, 18, 16), width=5)
            d.rectangle((x0 + 18, y0 + 16, x0 + 90, y0 + 48), fill=(210, 230, 236))
    img = ImageEnhance.Contrast(img).enhance(1.08)
    save(img, path)


def convert_audio() -> None:
    names = [
        "ui_click",
        "ui_hover",
        "place",
        "construction",
        "demolish",
        "error",
        "coin",
        "unlock",
        "whoosh",
        "fire",
        "ambient_day",
        "ambient_night",
    ]
    for name in names:
        src = WEB_AUD / f"{name}.ogg"
        dest = AUD / f"{name}.wav"
        if not src.exists():
            raise SystemExit(f"missing {src}")
        subprocess.check_call(
            ["ffmpeg", "-y", "-i", str(src), "-ar", "48000", "-ac", "2", str(dest)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print("wav", dest, dest.stat().st_size)


def copy_photos() -> None:
    for src_name, dest_name in (("tex-grass.jpg", "photo_grass.jpg"), ("tex-asphalt.jpg", "photo_asphalt.jpg")):
        src = WEB_TEX / src_name
        dest = TEX / dest_name
        dest.write_bytes(src.read_bytes())
        print("copy", dest, dest.stat().st_size)


def main() -> None:
    brick("brick.png", (168, 92, 64), 11)
    plaster("plaster.png", (210, 196, 176), 12)
    plaster("stone.png", (196, 188, 172), 13)
    roof_tiles("roof.png")
    asphalt("asphalt.png")
    grass("grass.png")
    sand("sand.png")
    water("water.png")
    window("windows.png")
    copy_photos()
    convert_audio()


if __name__ == "__main__":
    main()
