import * as THREE from "three";

export function makeWindowTexture(
  cols: number,
  rows: number,
  seed: number,
  night = false,
): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = night ? "#141820" : "#7a6854";
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry(seed);
  const cw = w / cols;
  const ch = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() > (night ? 0.38 : 0.82);
      const inset = 4;
      const px = x * cw + inset;
      const py = y * ch + inset;
      if (night && lit) {
        const warmth = rng();
        ctx.fillStyle = warmth > 0.55 ? "#f3d48a" : warmth > 0.3 ? "#9fd4e6" : "#f0b36a";
        ctx.globalAlpha = 0.75 + rng() * 0.25;
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = night ? "#1c2430" : "#cfe4ee";
      }
      ctx.fillRect(px, py, cw - inset * 2, ch - inset * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = night ? "#0c0e12" : "#4a3c30";
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, cw - inset * 2, ch - inset * 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function makeFacadeTexture(base: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const rng = mulberry(seed);
  for (let i = 0; i < 900; i++) {
    const n = Math.floor(rng() * 30) - 15;
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    ctx.fillRect(rng() * 256, rng() * 256, 2 + rng() * 6, 2 + rng() * 4);
    ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.04})`;
    ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 3, 1);
    void n;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
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
