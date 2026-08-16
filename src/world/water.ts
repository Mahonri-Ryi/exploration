import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  WATER_LAKE_NX,
  WATER_LAKE_NY,
  WATER_LAKE_R,
  WATER_RIVER_AMP,
  WATER_RIVER_FREQ,
  WATER_RIVER_HALF,
  WATER_RIVER_NY,
} from "../game/catalog";

export type GroundWaterUniforms = {
  uSize: { value: number };
  uTile: { value: number };
};

function tileWorld(tx: number, ty: number, size: number, tile: number): { x: number; z: number } {
  return {
    x: (tx - size / 2 + 0.5) * tile,
    z: (ty - size / 2 + 0.5) * tile,
  };
}

function riverNy(nx: number): number {
  return WATER_RIVER_NY + WATER_RIVER_AMP * Math.sin(nx * Math.PI * WATER_RIVER_FREQ);
}

/** Winding river ribbon in XZ, width matching `isWaterTile`. */
function buildRibbon(size: number, tile: number, halfNy: number, y: number, segs = 96): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const halfTiles = halfNy * (size - 1);
  const left: { x: number; z: number }[] = [];
  const right: { x: number; z: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    const nx = i / segs;
    const xTile = nx * (size - 1);
    const yTile = riverNy(nx) * (size - 1);
    const nxA = Math.max(0, nx - 1 / segs);
    const nxB = Math.min(1, nx + 1 / segs);
    const tx = nxB * (size - 1) - nxA * (size - 1);
    const ty = riverNy(nxB) * (size - 1) - riverNy(nxA) * (size - 1);
    const len = Math.hypot(tx, ty) || 1;
    const hx = (-ty / len) * halfTiles;
    const hy = (tx / len) * halfTiles;
    left.push(tileWorld(xTile + hx, yTile + hy, size, tile));
    right.push(tileWorld(xTile - hx, yTile - hy, size, tile));
  }
  for (let i = 0; i < left.length; i++) {
    const u = i / segs;
    pos.push(left[i].x, y, left[i].z, right[i].x, y, right[i].z);
    nrm.push(0, 1, 0, 0, 1, 0);
    uv.push(0, u, 1, u);
    if (i < left.length - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function buildLakeDisk(size: number, tile: number, y: number, radiusScale: number): THREE.BufferGeometry {
  const r = size * WATER_LAKE_R * tile * radiusScale;
  const geo = new THREE.CircleGeometry(r, 48);
  geo.rotateX(-Math.PI / 2);
  const c = tileWorld(size * WATER_LAKE_NX, size * WATER_LAKE_NY, size, tile);
  geo.translate(c.x, y, c.z);
  return geo;
}

function buildLakeRing(size: number, tile: number, y: number): THREE.BufferGeometry {
  const r = size * WATER_LAKE_R * tile;
  const geo = new THREE.RingGeometry(r * 0.96, r * 1.14, 48);
  geo.rotateX(-Math.PI / 2);
  const c = tileWorld(size * WATER_LAKE_NX, size * WATER_LAKE_NY, size, tile);
  geo.translate(c.x, y, c.z);
  return geo;
}

/** Thin strips along each river bank. */
function buildRiverFoam(size: number, tile: number, y: number, segs = 96): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const halfTiles = WATER_RIVER_HALF * (size - 1);
  const band = 0.12 / tile;
  const edges: { a: { x: number; z: number }; b: { x: number; z: number } }[][] = [[], []];
  for (let i = 0; i <= segs; i++) {
    const nx = i / segs;
    const xTile = nx * (size - 1);
    const yTile = riverNy(nx) * (size - 1);
    const nxA = Math.max(0, nx - 1 / segs);
    const nxB = Math.min(1, nx + 1 / segs);
    const tx = nxB * (size - 1) - nxA * (size - 1);
    const ty = riverNy(nxB) * (size - 1) - riverNy(nxA) * (size - 1);
    const len = Math.hypot(tx, ty) || 1;
    const nxn = -ty / len;
    const nyn = tx / len;
    for (const side of [-1, 1]) {
      const inner = halfTiles * side;
      const outer = (halfTiles + band) * side;
      edges[side < 0 ? 0 : 1].push({
        a: tileWorld(xTile + nxn * inner, yTile + nyn * inner, size, tile),
        b: tileWorld(xTile + nxn * outer, yTile + nyn * outer, size, tile),
      });
    }
  }
  let base = 0;
  for (const edge of edges) {
    for (let i = 0; i < edge.length; i++) {
      const u = i / segs;
      pos.push(edge[i].a.x, y, edge[i].a.z, edge[i].b.x, y, edge[i].b.z);
      nrm.push(0, 1, 0, 0, 1, 0);
      uv.push(0, u, 1, u);
      if (i < edge.length - 1) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += edge.length * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function buildWaterGeometries(
  size: number,
  tile: number,
): { bed: THREE.BufferGeometry; surface: THREE.BufferGeometry; foam: THREE.BufferGeometry } {
  const bed = mergeGeometries(
    [buildRibbon(size, tile, WATER_RIVER_HALF * 1.22, 0.03), buildLakeDisk(size, tile, 0.03, 1.16)],
    false,
  );
  const surface = mergeGeometries(
    [buildRibbon(size, tile, WATER_RIVER_HALF * 1.04, 0.15), buildLakeDisk(size, tile, 0.15, 1.0)],
    false,
  );
  const foam = mergeGeometries([buildRiverFoam(size, tile, 0.185), buildLakeRing(size, tile, 0.185)], false);
  if (!bed || !surface || !foam) {
    throw new Error("water merge failed");
  }
  return { bed, surface, foam };
}

export function createGroundWaterUniforms(size: number, tile: number): GroundWaterUniforms {
  return { uSize: { value: size }, uTile: { value: tile } };
}

/** Tint the grass plane itself so water is obvious even from a low camera. */
export function applyGroundWater(mat: THREE.MeshStandardMaterial, uniforms: GroundWaterUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSize = uniforms.uSize;
    shader.uniforms.uTile = uniforms.uTile;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSize;
         uniform float uTile;
         varying vec3 vWorldPos;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         float denom = max(uSize - 1.0, 1.0);
         float xTile = vWorldPos.x / uTile + uSize * 0.5 - 0.5;
         float yTile = vWorldPos.z / uTile + uSize * 0.5 - 0.5;
         float nx = xTile / denom;
         float ny = yTile / denom;
         float riverLine = ${WATER_RIVER_NY.toFixed(4)} + ${WATER_RIVER_AMP.toFixed(4)} * sin(nx * 3.14159265 * ${WATER_RIVER_FREQ.toFixed(4)});
         float river = 1.0 - smoothstep(${(WATER_RIVER_HALF * 0.88).toFixed(4)}, ${(WATER_RIVER_HALF * 1.12).toFixed(4)}, abs(ny - riverLine));
         float bank = 1.0 - smoothstep(${(WATER_RIVER_HALF * 1.12).toFixed(4)}, ${(WATER_RIVER_HALF * 1.75).toFixed(4)}, abs(ny - riverLine));
         vec2 lakeC = vec2(uSize * ${WATER_LAKE_NX.toFixed(4)}, uSize * ${WATER_LAKE_NY.toFixed(4)});
         float lakeD = length(vec2(xTile, yTile) - lakeC);
         float lakeR = uSize * ${WATER_LAKE_R.toFixed(4)};
         float lake = 1.0 - smoothstep(lakeR * 0.92, lakeR * 1.04, lakeD);
         float lakeBank = 1.0 - smoothstep(lakeR * 1.04, lakeR * 1.38, lakeD);
         float wet = max(river, lake);
         float shore = max(bank, lakeBank);
         vec3 bankCol = vec3(0.66, 0.54, 0.28);
         vec3 waterCol = vec3(0.04, 0.40, 0.58);
         diffuseColor.rgb = mix(diffuseColor.rgb, bankCol, clamp(shore * (1.0 - wet * 0.65), 0.0, 1.0));
         diffuseColor.rgb = mix(diffuseColor.rgb, waterCol, wet);`,
      );
  };
  mat.customProgramCacheKey = () => "aetheris-ground-water-v1";
}
