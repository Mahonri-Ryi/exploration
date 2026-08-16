import * as THREE from "three";
import type { BuildingDef } from "../game/catalog";
import { makeFacadeTexture, makeWindowTexture, mulberry } from "./textures";

const matCache = new Map<string, THREE.Material>();

function mat(key: string, factory: () => THREE.Material): THREE.Material {
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = factory();
  matCache.set(key, m);
  return m;
}

function box(w: number, h: number, d: number, material: THREE.Material, y = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.y = y + h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(
  rTop: number,
  rBot: number,
  h: number,
  material: THREE.Material,
  y = 0,
  segs = 12,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
  mesh.position.y = y + h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function place(mesh: THREE.Mesh, x: number, z: number): THREE.Mesh {
  mesh.position.x = x;
  mesh.position.z = z;
  return mesh;
}

export function createBuilding(def: BuildingDef, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = def.id;
  const rng = mulberry(seed + def.id.length * 17);
  const facade = mat(`facade-${def.id}-${(seed % 5) | 0}`, () => {
    const tex = makeFacadeTexture(hex(def.color), seed);
    return new THREE.MeshStandardMaterial({
      map: tex,
      color: def.color,
      roughness: 0.72,
      metalness: 0.08,
    });
  });
  const glass = mat(
    "glass",
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x9ec9d6,
        roughness: 0.08,
        metalness: 0.35,
        transmission: 0.25,
        transparent: true,
        opacity: 0.92,
      }),
  );
  const roof = mat(`roof-${def.category}`, () => {
    const color =
      def.category === "residential"
        ? 0x6b2e24
        : def.category === "industrial"
          ? 0x3c3a38
          : 0x2f3a44;
    return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 });
  });
  const stone = mat("stone", () => new THREE.MeshStandardMaterial({ color: 0xcfc4b0, roughness: 0.8 }));
  const trim = mat(
    "gold",
    () => new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.28 }),
  );
  const dark = mat("dark", () => new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.5, metalness: 0.3 }));
  const foliage = mat("foliage", () => new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: 0.9 }));
  const nightWin = makeWindowTexture(6, 8, seed, true);
  const dayWin = makeWindowTexture(6, 8, seed, false);
  const windowMat = new THREE.MeshStandardMaterial({
    map: dayWin,
    emissiveMap: nightWin,
    emissive: new THREE.Color(0xffd27a),
    emissiveIntensity: 0,
    roughness: 0.35,
    metalness: 0.15,
  });
  g.userData.windowMat = windowMat;

  switch (def.id) {
    case "cottage": {
      g.add(box(1.35, 0.72, 1.15, facade));
      const r = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.55, 4), roof);
      r.position.y = 1.02;
      r.rotation.y = Math.PI / 4;
      r.castShadow = true;
      g.add(r);
      g.add(place(box(0.18, 0.32, 0.18, dark, 0.95), 0.35, 0.15));
      addTree(g, foliage, dark, -0.7, 0.45, rng);
      break;
    }
    case "villa": {
      g.add(box(1.5, 0.7, 1.15, facade));
      g.add(place(box(0.85, 0.95, 0.8, facade), 0.4, 0.15));
      const r = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.45, 4), roof);
      r.rotation.y = Math.PI / 4;
      r.position.set(-0.1, 1.05, 0);
      r.castShadow = true;
      g.add(r);
      addTree(g, foliage, dark, -0.75, -0.5, rng);
      addTree(g, foliage, dark, 0.7, 0.55, rng);
      break;
    }
    case "apartments": {
      g.add(box(1.55, 3.2, 1.4, windowMat));
      g.add(box(1.62, 0.16, 1.48, stone, 3.2));
      g.add(box(1.62, 0.12, 1.48, dark, 0));
      break;
    }
    case "tower": {
      g.add(box(1.15, 5.4, 1.15, windowMat));
      g.add(box(0.85, 3.2, 0.85, windowMat, 5.4));
      g.add(box(0.45, 1.6, 0.45, glass, 8.6));
      g.add(cyl(0.06, 0.06, 0.8, trim, 10.1, 8));
      break;
    }
    case "shop": {
      g.add(box(1.5, 0.85, 1.2, facade));
      g.add(place(box(1.52, 0.28, 0.18, trim, 0.85), 0, 0.55));
      g.add(place(box(1.2, 0.45, 0.08, glass, 0.18), 0, 0.58));
      g.add(box(1.55, 0.1, 1.25, roof, 0.85));
      break;
    }
    case "market": {
      g.add(box(1.65, 1.15, 1.45, facade));
      g.add(place(box(1.5, 0.7, 0.08, glass, 0.2), 0, 0.72));
      g.add(box(1.75, 0.08, 1.55, trim, 1.15));
      break;
    }
    case "offices": {
      g.add(box(1.5, 4.8, 1.35, windowMat));
      g.add(box(1.15, 0.9, 1.0, glass, 4.8));
      g.add(box(1.55, 0.12, 1.4, dark, 0));
      break;
    }
    case "workshop": {
      g.add(box(1.6, 0.85, 1.25, facade));
      const saw = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 3), roof);
      saw.position.set(-0.35, 1.1, 0);
      saw.rotation.z = 0.15;
      saw.castShadow = true;
      g.add(saw);
      const saw2 = saw.clone();
      saw2.position.x = 0.35;
      g.add(saw2);
      break;
    }
    case "factory": {
      g.add(box(1.7, 1.3, 1.35, facade));
      g.add(place(cyl(0.16, 0.2, 1.5, dark, 1.3, 10), -0.45, 0.3));
      g.add(place(cyl(0.16, 0.2, 1.8, dark, 1.3, 10), 0.35, -0.2));
      g.add(place(box(1.1, 0.7, 0.7, dark), 0.1, 0.55));
      break;
    }
    case "plant": {
      g.add(box(1.75, 1.6, 1.45, facade));
      g.add(place(cyl(0.42, 0.55, 1.7, stone, 1.5, 14), -0.4, 0));
      g.add(place(cyl(0.32, 0.42, 1.3, stone, 1.5, 14), 0.45, 0.15));
      break;
    }
    case "park": {
      g.add(box(1.85, 0.06, 1.85, foliage));
      addTree(g, foliage, dark, -0.45, -0.4, rng);
      addTree(g, foliage, dark, 0.5, 0.35, rng);
      addTree(g, foliage, dark, 0.15, -0.55, rng);
      g.add(cyl(0.18, 0.22, 0.16, stone, 0.06, 10));
      break;
    }
    case "plaza": {
      g.add(box(1.85, 0.07, 1.85, stone));
      g.add(cyl(0.28, 0.34, 0.22, trim, 0.07, 12));
      g.add(cyl(0.08, 0.08, 0.55, stone, 0.28, 8));
      addTree(g, foliage, dark, -0.7, 0.65, rng);
      addTree(g, foliage, dark, 0.7, -0.65, rng);
      break;
    }
    case "power": {
      g.add(box(1.55, 1.15, 1.3, facade));
      g.add(place(cyl(0.38, 0.5, 1.55, stone, 1.1, 14), -0.35, 0));
      g.add(place(cyl(0.3, 0.4, 1.25, stone, 1.1, 14), 0.4, 0.1));
      const glow = mat(
        "power-glow",
        () =>
          new THREE.MeshStandardMaterial({
            color: 0x3ad4c8,
            emissive: 0x1aa89c,
            emissiveIntensity: 1.2,
          }),
      );
      g.add(place(box(0.35, 0.2, 0.35, glow, 1.15), 0.15, 0.5));
      break;
    }
    case "water": {
      g.add(cyl(0.22, 0.28, 2.2, stone, 0, 14));
      g.add(cyl(0.55, 0.55, 0.7, facade, 2.05, 16));
      g.add(cyl(0.58, 0.2, 0.28, trim, 2.7, 16));
      break;
    }
    case "police": {
      g.add(box(1.55, 1.25, 1.3, facade));
      g.add(place(box(0.7, 0.35, 0.2, trim, 1.25), 0, 0.56));
      g.add(box(1.6, 0.12, 1.35, dark));
      break;
    }
    case "fire": {
      g.add(box(1.6, 1.15, 1.3, facade));
      g.add(place(box(1.1, 0.55, 0.08, dark, 0.12), 0, 0.64));
      g.add(place(box(0.18, 0.55, 0.18, trim, 1.15), 0.55, 0.4));
      break;
    }
    case "hospital": {
      g.add(box(1.6, 1.7, 1.35, facade));
      const cross = mat(
        "cross",
        () =>
          new THREE.MeshStandardMaterial({
            color: 0x3ad4c8,
            emissive: 0x1aa89c,
            emissiveIntensity: 0.6,
          }),
      );
      g.add(place(box(0.55, 0.16, 0.08, cross, 1.2), 0, 0.68));
      g.add(place(box(0.16, 0.55, 0.08, cross, 1.02), 0, 0.68));
      break;
    }
    case "cityhall": {
      g.add(box(1.7, 1.35, 1.4, stone));
      g.add(box(0.95, 0.85, 0.95, stone, 1.35));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), trim);
      dome.position.y = 2.55;
      dome.castShadow = true;
      g.add(dome);
      g.add(cyl(0.05, 0.05, 0.4, trim, 3.0, 8));
      g.add(place(box(0.55, 0.45, 0.22, dark), 0, 0.72));
      break;
    }
    default: {
      g.add(box(1.2, Math.max(0.4, def.height * 0.35), 1.2, facade));
    }
  }

  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 16),
    mat(
      "contact",
      () => new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
    ),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.015;
  g.add(pad);
  return g;
}

function addTree(
  g: THREE.Group,
  foliage: THREE.Material,
  dark: THREE.Material,
  x: number,
  z: number,
  rng: () => number,
): void {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.28, 6), dark);
  trunk.position.set(x, 0.2, z);
  trunk.castShadow = true;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22 + rng() * 0.08, 8, 6), foliage);
  leaf.position.set(x, 0.48 + rng() * 0.08, z);
  leaf.castShadow = true;
  g.add(trunk, leaf);
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function setBuildingNight(group: THREE.Group, night: number): void {
  const windowMat = group.userData.windowMat as THREE.MeshStandardMaterial | undefined;
  if (windowMat) windowMat.emissiveIntensity = night * 1.35;
}
