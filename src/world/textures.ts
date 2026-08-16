import * as THREE from "three";

export const FACADE_SIZE = 1024;
export const WINDOW_SIZE = 1024;
export const TERRAIN_SIZE = 1024;

function hexRgb(hex: string): { r: number; g: number; b: number } {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function shade(r: number, g: number, b: number, mul: number, a = 1): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * mul)));
  return `rgba(${c(r)},${c(g)},${c(b)},${a})`;
}

function finishMap(canvas: HTMLCanvasElement, repeat = 1, aniso = 16): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.repeat.set(repeat, repeat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function finishData(canvas: HTMLCanvasElement, repeat = 1, aniso = 16): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.repeat.set(repeat, repeat);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export function makeWindowTexture(
  cols: number,
  rows: number,
  seed: number,
  night = false,
): THREE.CanvasTexture {
  const w = WINDOW_SIZE;
  const h = WINDOW_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = night ? "#10141c" : "#5a4a3c";
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry(seed + (night ? 91 : 3));
  const cw = w / cols;
  const ch = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() > (night ? 0.34 : 0.78);
      const frame = 7;
      const px = x * cw + frame;
      const py = y * ch + frame;
      const pw = cw - frame * 2;
      const ph = ch - frame * 2;

      ctx.fillStyle = night ? "#0a0c10" : "#3a2e26";
      ctx.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);

      const interior = night
        ? lit
          ? rng() > 0.5
            ? "#f3d48a"
            : rng() > 0.4
              ? "#9fd4e6"
              : "#f0b36a"
          : "#161c26"
        : lit
          ? "#e7f3f8"
          : "#b7c8d2";
      const grad = ctx.createLinearGradient(px, py, px + pw, py + ph);
      if (night && lit) {
        grad.addColorStop(0, interior);
        grad.addColorStop(1, "#6a4a28");
      } else {
        grad.addColorStop(0, interior);
        grad.addColorStop(1, night ? "#0c1016" : "#8aa0aa");
      }
      ctx.globalAlpha = night && lit ? 0.82 + rng() * 0.18 : 1;
      ctx.fillStyle = grad;
      ctx.fillRect(px, py, pw, ph);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = night ? "rgba(230,240,255,0.08)" : "rgba(255,255,255,0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 3, py + 3);
      ctx.lineTo(px + pw * 0.42, py + 3);
      ctx.stroke();

      ctx.strokeStyle = night ? "#08090c" : "#2c241c";
      ctx.lineWidth = 3;
      ctx.strokeRect(px, py, pw, ph);
      ctx.beginPath();
      ctx.moveTo(px + pw / 2, py);
      ctx.lineTo(px + pw / 2, py + ph);
      ctx.moveTo(px, py + ph * 0.48);
      ctx.lineTo(px + pw, py + ph * 0.48);
      ctx.stroke();

      if (rng() > 0.72) {
        ctx.fillStyle = night ? "rgba(20,16,12,0.45)" : "rgba(90,70,50,0.18)";
        ctx.fillRect(px + 4, py + 4, pw * 0.28, ph - 8);
      }
    }
  }
  return finishMap(canvas);
}

export function makeFacadeTexture(base: string, seed: number): THREE.CanvasTexture {
  return makeFacadeMaps(base, seed).map;
}

export function makeFacadeMaps(
  base: string,
  seed: number,
): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const w = FACADE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = w;
  const rough = document.createElement("canvas");
  rough.width = w;
  rough.height = w;
  const ctx = canvas.getContext("2d")!;
  const rx = rough.getContext("2d")!;
  const { r, g, b } = hexRgb(base);
  const rng = mulberry(seed + 11);
  const brick = r > g + 8 && r > b + 4;

  ctx.fillStyle = shade(r, g, b, brick ? 0.78 : 0.92);
  ctx.fillRect(0, 0, w, w);
  rx.fillStyle = brick ? "#c8c8c8" : "#b0b0b0";
  rx.fillRect(0, 0, w, w);

  if (brick) {
    const bh = 28;
    const bw = 64;
    for (let y = 0, row = 0; y < w + bh; y += bh, row++) {
      const ox = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const m = 0.78 + rng() * 0.34;
        ctx.fillStyle = shade(r, g, b, m);
        ctx.fillRect(x + ox + 1, y + 1, bw - 3, bh - 3);
        rx.fillStyle = `rgb(${140 + rng() * 50 | 0},${140 + rng() * 40 | 0},${140 + rng() * 40 | 0})`;
        rx.fillRect(x + ox + 1, y + 1, bw - 3, bh - 3);
      }
    }
    ctx.strokeStyle = shade(r, g, b, 0.55, 0.55);
    ctx.lineWidth = 2;
    for (let y = 0, row = 0; y < w + bh; y += bh, row++) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 80; i++) {
      const m = 0.86 + rng() * 0.22;
      ctx.fillStyle = shade(r, g, b, m, 0.18 + rng() * 0.2);
      ctx.beginPath();
      ctx.ellipse(rng() * w, rng() * w, 18 + rng() * 70, 12 + rng() * 40, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 14000; i++) {
      const n = rng();
      ctx.fillStyle = n > 0.5 ? `rgba(255,255,255,${0.03 + rng() * 0.05})` : `rgba(0,0,0,${0.03 + rng() * 0.06})`;
      ctx.fillRect(rng() * w, rng() * w, 1 + rng() * 2, 1 + rng() * 2);
    }
    ctx.strokeStyle = "rgba(40,30,24,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.moveTo(rng() * w, rng() * w);
      ctx.lineTo(rng() * w, rng() * w);
      ctx.stroke();
    }
  }

  const dirt = ctx.createLinearGradient(0, w * 0.55, 0, w);
  dirt.addColorStop(0, "rgba(40,28,16,0)");
  dirt.addColorStop(1, "rgba(40,28,16,0.22)");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 0, w, w);

  return { map: finishMap(canvas), roughnessMap: finishData(rough) };
}

export function makeRoofTexture(kind: "tile" | "slate" | "metal", seed: number): THREE.CanvasTexture {
  const w = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = w;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry(seed + 44);
  if (kind === "metal") {
    ctx.fillStyle = "#3a3c40";
    ctx.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 36) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + rng() * 0.05})`;
      ctx.fillRect(0, y, w, 2);
      ctx.fillStyle = `rgba(0,0,0,0.18)`;
      ctx.fillRect(0, y + 18, w, 1);
    }
  } else if (kind === "slate") {
    ctx.fillStyle = "#2a3340";
    ctx.fillRect(0, 0, w, w);
    for (let y = 0, row = 0; y < w; y += 18, row++) {
      const ox = row % 2 ? 16 : 0;
      for (let x = -20; x < w; x += 32) {
        ctx.fillStyle = `rgb(${36 + rng() * 22 | 0},${44 + rng() * 24 | 0},${54 + rng() * 28 | 0})`;
        ctx.fillRect(x + ox, y, 30, 16);
      }
    }
  } else {
    ctx.fillStyle = "#5a241c";
    ctx.fillRect(0, 0, w, w);
    for (let y = 0, row = 0; y < w; y += 16, row++) {
      const ox = row % 2 ? 14 : 0;
      for (let x = -20; x < w; x += 28) {
        const m = 0.7 + rng() * 0.4;
        ctx.fillStyle = `rgb(${(110 * m) | 0},${(42 * m) | 0},${(32 * m) | 0})`;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + 14);
        ctx.lineTo(x + ox + 14, y);
        ctx.lineTo(x + ox + 28, y + 14);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  return finishMap(canvas, 2);
}

export function makeTerrainTexture(): THREE.CanvasTexture {
  return makeTerrainMaps().map;
}

export function makeTerrainMaps(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const w = TERRAIN_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = w;
  const rough = document.createElement("canvas");
  rough.width = w;
  rough.height = w;
  const height = document.createElement("canvas");
  height.width = w;
  height.height = w;
  const ctx = canvas.getContext("2d")!;
  const rx = rough.getContext("2d")!;
  const hx = height.getContext("2d")!;
  ctx.fillStyle = "#4a6b38";
  ctx.fillRect(0, 0, w, w);
  rx.fillStyle = "#d0d0d0";
  rx.fillRect(0, 0, w, w);
  hx.fillStyle = "#808080";
  hx.fillRect(0, 0, w, w);

  for (let i = 0; i < 42000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * w;
    const g = 78 + Math.floor(Math.random() * 90);
    const r = 38 + Math.floor(Math.random() * 46);
    const b = 28 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgba(${r},${g},${b},${0.12 + Math.random() * 0.38})`;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 4);
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(92, 68, 38, ${0.07 + Math.random() * 0.14})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * w, 6 + Math.random() * 28, 0, Math.PI * 2);
    ctx.fill();
    rx.fillStyle = `rgba(90,90,90,${0.15 + Math.random() * 0.25})`;
    rx.beginPath();
    rx.arc(Math.random() * w, Math.random() * w, 4 + Math.random() * 16, 0, Math.PI * 2);
    rx.fill();
  }
  for (let i = 0; i < 2400; i++) {
    const warm = Math.random() > 0.5;
    ctx.fillStyle = warm ? "rgba(210,90,70,0.35)" : "rgba(230,210,90,0.28)";
    ctx.fillRect(Math.random() * w, Math.random() * w, 1, 1);
  }
  for (let i = 0; i < 18000; i++) {
    const v = 90 + Math.random() * 80;
    hx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    hx.fillRect(Math.random() * w, Math.random() * w, 2, 2);
  }

  const normal = heightToNormal(height);
  return {
    map: finishMap(canvas, 8),
    roughnessMap: finishData(rough, 8),
    normalMap: finishData(normal, 8),
  };
}

function heightToNormal(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext("2d")!;
  const srcData = sctx.getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const dctx = out.getContext("2d")!;
  const img = dctx.createImageData(w, h);
  const strength = 1.8;
  const at = (x: number, y: number) => srcData[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1) || 1;
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 128;
      img.data[i + 3] = 255;
    }
  }
  dctx.putImageData(img, 0, 0);
  return out;
}

export function mulberry(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
