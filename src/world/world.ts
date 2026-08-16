import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CATALOG_BY_ID, isWaterTile, type BuildingDef, type InfoLayer } from "../game/catalog";
import type { City } from "../game/city";
import { makeTerrainTexture, mulberry } from "./textures";
import { createBuilding, setBuildingNight } from "./buildings";

export const TILE = 2;

function preferLiteGpu(): boolean {
  return window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
}

export function tileToWorld(x: number, y: number, size: number): THREE.Vector3 {
  return new THREE.Vector3((x - size / 2 + 0.5) * TILE, 0, (y - size / 2 + 0.5) * TILE);
}

export function worldToTile(pos: THREE.Vector3, size: number): { x: number; y: number } {
  return {
    x: Math.floor(pos.x / TILE + size / 2),
    y: Math.floor(pos.z / TILE + size / 2),
  };
}

interface Car {
  mesh: THREE.Group;
  path: THREE.Vector3[];
  i: number;
  t: number;
  speed: number;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  readonly ground: THREE.Mesh;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly moon: THREE.DirectionalLight;
  readonly water: THREE.Mesh;
  readonly ghost: THREE.Group;
  readonly hover: THREE.Mesh;
  readonly buildings = new Map<string, THREE.Group>();
  readonly roads = new Map<string, THREE.Mesh>();
  private cars: Car[] = [];
  private boats: Car[] = [];
  private birds: THREE.Group[] = [];
  private roadGroup = new THREE.Group();
  private buildGroup = new THREE.Group();
  private wilds = new THREE.Group();
  private asphaltTex: THREE.Texture | null = null;
  private waterTime = 0;
  private size = 40;
  private sky: THREE.Mesh;
  private bloom: UnrealBloomPass;
  private overlay: THREE.Mesh;
  private overlayTex: THREE.CanvasTexture | null = null;
  private ghostRing: THREE.Mesh;
  private lampCount = 0;
  private overlayTick = 0;
  private lastLayer: InfoLayer = "none";

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    this.camera.position.set(28, 22, 28);

    const lite = preferLiteGpu();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !lite,
      alpha: false,
      stencil: false,
      powerPreference: lite ? "default" : "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.25 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.fog = new THREE.Fog(0xb7c9d6, 55, 160);
    this.scene.background = new THREE.Color(0x9eb6c8);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

    this.hemi = new THREE.HemisphereLight(0xc8ddf0, 0x3d4a32, 0.7);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffe6c2, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.camera.left = -55;
    this.sun.shadow.camera.right = 55;
    this.sun.shadow.camera.top = 55;
    this.sun.shadow.camera.bottom = -55;
    this.sun.shadow.bias = -0.00025;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x8aa4d4, 0.15);
    this.scene.add(this.moon);

    const skyGeo = new THREE.SphereGeometry(180, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(0x7fb3d4) },
        mid: { value: new THREE.Color(0xd7c4a4) },
        bot: { value: new THREE.Color(0x1a2230) },
        night: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 bot;
        uniform float night;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          vec3 day = mix(mid, top, smoothstep(0.35, 0.95, h));
          vec3 nd = mix(bot, vec3(0.05, 0.07, 0.14), smoothstep(0.2, 0.9, h));
          gl_FragColor = vec4(mix(day, nd, night), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4d6a3d,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(80.4, 80.4),
      new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.9 }),
    );
    board.rotation.x = -Math.PI / 2;
    board.position.y = -0.04;
    this.scene.add(board);

    const grid = new THREE.GridHelper(80, 40, 0xc9a227, 0x6a7a58);
    grid.position.y = 0.02;
    const gridMat = grid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    gridMat.opacity = 0.1;
    this.scene.add(grid);

    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        deep: { value: new THREE.Color(0x064a68) },
        shallow: { value: new THREE.Color(0x4ec8d4) },
        foam: { value: new THREE.Color(0xd8f4f8) },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          vec3 p = position;
          float w = sin(p.x * 1.6 + time * 1.3) * 0.05 + cos(p.z * 1.4 + time * 0.9) * 0.04;
          p.y += w;
          vWave = w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 deep;
        uniform vec3 shallow;
        uniform vec3 foam;
        uniform float time;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          float n = sin(vUv.x * 28.0 + time) * 0.5 + cos(vUv.y * 22.0 - time * 0.8) * 0.5;
          float edge = smoothstep(0.08, 0.0, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
          vec3 col = mix(deep, shallow, 0.45 + n * 0.22 + vWave * 2.0);
          col = mix(col, foam, edge * 0.65);
          gl_FragColor = vec4(col, 0.92);
        }
      `,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 24, 24), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.04;
    this.scene.add(this.water);

    this.scene.add(this.roadGroup);
    this.scene.add(this.buildGroup);
    this.scene.add(this.wilds);

    this.ghost = new THREE.Group();
    const ghostBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.15, 1.7),
      new THREE.MeshStandardMaterial({
        color: 0x3ad4c8,
        transparent: true,
        opacity: 0.4,
        emissive: 0x1aa89c,
        emissiveIntensity: 0.4,
      }),
    );
    ghostBox.position.y = 0.12;
    this.ghost.add(ghostBox);
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    this.hover = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.96, TILE * 0.96),
      new THREE.MeshBasicMaterial({ color: 0xf2d48a, transparent: true, opacity: 0.32 }),
    );
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = 0.07;
    this.scene.add(this.hover);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.05, 48),
      new THREE.MeshBasicMaterial({ color: 0x3ad4c8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    ring.visible = false;
    this.ghost.add(ring);
    this.ghostRing = ring;

    const overlayMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), overlayMat);
    this.overlay.rotation.x = -Math.PI / 2;
    this.overlay.position.y = 0.09;
    this.overlay.visible = false;
    this.scene.add(this.overlay);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), lite ? 0.14 : 0.28, 0.35, 0.82);
    this.composer.addPass(this.bloom);
    if (!lite) this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());

    this.spawnBirds();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("resize", () => this.resize());
    window.visualViewport?.addEventListener("scroll", () => this.resize());
    canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
    canvas.addEventListener("webglcontextrestored", () => this.resize());
  }

  async loadTextures(): Promise<void> {
    const loader = new THREE.TextureLoader();
    const [grass, asphalt] = await Promise.all([
      loader.loadAsync("./assets/textures/tex-grass.jpg"),
      loader.loadAsync("./assets/textures/tex-asphalt.jpg"),
    ]);
    grass.colorSpace = THREE.SRGBColorSpace;
    asphalt.colorSpace = THREE.SRGBColorSpace;
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    grass.repeat.set(10, 10);
    asphalt.repeat.set(1, 1);
    const aniso = preferLiteGpu() ? 1 : 8;
    grass.anisotropy = aniso;
    asphalt.anisotropy = aniso;
    this.asphaltTex = asphalt;
    const generated = makeTerrainTexture();
    generated.anisotropy = aniso;
    const gmat = this.ground.material as THREE.MeshStandardMaterial;
    gmat.map = generated;
    gmat.color.set(0xc8d4b0);
    gmat.roughness = 0.95;
    gmat.needsUpdate = true;
    void grass;
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = Math.max(1, canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, canvas.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preferLiteGpu() ? 1.25 : 2));
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  bindCity(city: City): void {
    this.size = city.size;
    this.rebuildTerrain(city);
    this.rebuildAll(city);
  }

  private heightAt(x: number, y: number, size: number): number {
    if (isWaterTile(x, y, size)) return -0.06;
    const nx = x / Math.max(1, size - 1);
    const ny = y / Math.max(1, size - 1);
    let h = 0.02 + Math.sin(nx * 5.2 + 0.3) * Math.cos(ny * 4.1) * 0.38 + Math.sin(nx * 12.4) * 0.07;
    const riverY = 0.44 + 0.11 * Math.sin(nx * Math.PI * 2.15);
    const dist = Math.abs(ny - riverY);
    if (dist < 0.14) h *= dist / 0.14;
    return Math.max(0, h);
  }

  private rebuildTerrain(city: City): void {
    const segs = city.size;
    const geom = new THREE.PlaneGeometry(segs * TILE, segs * TILE, segs, segs);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    const color = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      const tx = Math.round(wx / TILE + city.size / 2);
      const ty = Math.round(wz / TILE + city.size / 2);
      const h = this.heightAt(tx, ty, city.size);
      pos.setY(i, h);
      const here = city.get(tx, ty);
      const wet =
        isWaterTile(tx, ty, city.size) ||
        Boolean(here && city.neighbors4(tx, ty).some((n) => n.water));
      if (wet) {
        color[i * 3] = 0.72;
        color[i * 3 + 1] = 0.68;
        color[i * 3 + 2] = 0.48;
      } else if (h > 0.28) {
        color[i * 3] = 0.55;
        color[i * 3 + 1] = 0.58;
        color[i * 3 + 2] = 0.5;
      } else {
        color[i * 3] = 0.45;
        color[i * 3 + 1] = 0.58;
        color[i * 3 + 2] = 0.32;
      }
    }
    geom.setAttribute("color", new THREE.BufferAttribute(color, 3));
    geom.computeVertexNormals();
    this.ground.geometry.dispose();
    this.ground.geometry = geom;
    this.ground.rotation.set(0, 0, 0);
    this.ground.position.set(0, 0, 0);
    const gmat = this.ground.material as THREE.MeshStandardMaterial;
    gmat.vertexColors = true;

    const waterGeom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let y = 0; y < city.size; y++) {
      for (let x = 0; x < city.size; x++) {
        if (!isWaterTile(x, y, city.size)) continue;
        const p = tileToWorld(x, y, city.size);
        const s = TILE * 0.52;
        const y0 = 0.1;
        const quad = [
          [p.x - s, y0, p.z - s],
          [p.x + s, y0, p.z - s],
          [p.x + s, y0, p.z + s],
          [p.x - s, y0, p.z - s],
          [p.x + s, y0, p.z + s],
          [p.x - s, y0, p.z + s],
        ];
        for (const v of quad) positions.push(v[0], v[1], v[2]);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      }
    }
    waterGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    waterGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    waterGeom.computeVertexNormals();
    this.water.geometry.dispose();
    this.water.geometry = waterGeom;
    this.water.rotation.set(0, 0, 0);
    this.water.position.set(0, 0, 0);
  }

  private scatterWilds(city: City): void {
    this.wilds.clear();
    const rng = mulberry(91);
    const foliage = new THREE.MeshStandardMaterial({ color: 0x2c5c34, roughness: 0.92 });
    const bark = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 });
    const dummy = new THREE.Object3D();
    const spots: THREE.Vector3[] = [];
    for (let i = 0; i < 220; i++) {
      const x = Math.floor(rng() * city.size);
      const y = Math.floor(rng() * city.size);
      const tile = city.get(x, y);
      if (!tile || tile.water || tile.buildingId || tile.road) continue;
      const edge = x < 3 || y < 3 || x > city.size - 4 || y > city.size - 4;
      const nearWater = city.neighbors4(x, y).some((n) => n.water);
      if (!edge && !nearWater && rng() > 0.07) continue;
      const p = tileToWorld(x, y, city.size);
      p.x += (rng() - 0.5) * 1.2;
      p.z += (rng() - 0.5) * 1.2;
      p.y = this.heightAt(x, y, city.size);
      spots.push(p);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 5), bark, spots.length);
    const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(0.38, 0.85, 7), foliage, spots.length);
    trunk.castShadow = leaves.castShadow = true;
    spots.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 0.22, p.z);
      dummy.scale.setScalar(0.9 + rng() * 0.7);
      dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.y = p.y + 0.78;
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    });
    this.wilds.add(trunk, leaves);
  }

  rebuildAll(city: City): void {
    for (const [, m] of this.buildings) this.buildGroup.remove(m);
    for (const [, m] of this.roads) this.roadGroup.remove(m);
    this.buildings.clear();
    this.roads.clear();
    this.lampCount = 0;
    for (const tile of city.tiles) {
      if (tile.road) this.ensureRoad(city, tile.x, tile.y);
      else if (tile.buildingId && tile.buildingId !== "road") this.ensureBuilding(city, tile.x, tile.y);
    }
    this.refreshCars(city);
    this.refreshBoats(city);
    this.scatterWilds(city);
  }

  syncTile(city: City, x: number, y: number): void {
    const key = `${x},${y}`;
    const tile = city.get(x, y);
    const existingB = this.buildings.get(key);
    const existingR = this.roads.get(key);
    if (existingB) {
      this.buildGroup.remove(existingB);
      this.buildings.delete(key);
    }
    if (existingR) {
      this.roadGroup.remove(existingR);
      this.roads.delete(key);
    }
    if (!tile) return;
    if (tile.road) this.ensureRoad(city, x, y);
    else if (tile.buildingId && tile.buildingId !== "road") this.ensureBuilding(city, x, y);
    for (const n of city.neighbors4(x, y)) {
      if (n.road) {
        const nk = `${n.x},${n.y}`;
        const old = this.roads.get(nk);
        if (old) {
          this.roadGroup.remove(old);
          this.roads.delete(nk);
        }
        this.ensureRoad(city, n.x, n.y);
      }
    }
    this.refreshCars(city);
    this.refreshBoats(city);
    this.scatterWilds(city);
  }

  private ensureBuilding(city: City, x: number, y: number): void {
    const tile = city.get(x, y);
    if (!tile?.buildingId) return;
    const def = CATALOG_BY_ID[tile.buildingId];
    if (!def || def.isRoad) return;
    const mesh = createBuilding(def, x * 131 + y * 17);
    mesh.scale.setScalar(1.28);
    const p = tileToWorld(x, y, city.size);
    p.y = this.heightAt(x, y, city.size);
    mesh.position.copy(p);
    mesh.userData.tile = { x, y };
    this.buildGroup.add(mesh);
    this.buildings.set(`${x},${y}`, mesh);
  }

  private ensureRoad(city: City, x: number, y: number): void {
    const tile = city.get(x, y);
    const p = tileToWorld(x, y, city.size);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5a5e66,
      map: this.asphaltTex,
      roughness: 0.62,
      metalness: 0.08,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.98, tile?.water ? 0.16 : 0.1, TILE * 0.98), mat);
    const groundY = tile?.water ? 0.22 : this.heightAt(x, y, city.size) + 0.05;
    mesh.position.set(p.x, groundY, p.z);
    mesh.receiveShadow = true;
    mesh.castShadow = Boolean(tile?.water);
    if (tile?.water) {
      mat.color.set(0x8d6b4a);
      mat.map = null;
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * 0.92, 0.12, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.45, roughness: 0.35 }),
      );
      rail.position.y = 0.14;
      mesh.add(rail);
      const rail2 = rail.clone();
      rail2.position.z = 0;
      rail2.rotation.y = Math.PI / 2;
      mesh.add(rail2);
    }
    const n = city.get(x, y - 1)?.road;
    const s = city.get(x, y + 1)?.road;
    const e = city.get(x + 1, y)?.road;
    const w = city.get(x - 1, y)?.road;
    const mark = new THREE.MeshStandardMaterial({
      color: 0xe6c56a,
      emissive: 0x6a5010,
      emissiveIntensity: 0.15,
    });
    if (e || w) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.7, 0.02, 0.05), mark);
      line.position.y = 0.05;
      mesh.add(line);
    }
    if (n || s) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, TILE * 0.7), mark);
      line.position.y = 0.05;
      mesh.add(line);
    }
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(TILE * 0.98, 0.03, TILE * 0.16),
      new THREE.MeshStandardMaterial({ color: 0xb7b0a0, roughness: 0.85 }),
    );
    walk.position.set(0, 0.04, TILE * 0.42);
    const walk2 = walk.clone();
    walk2.position.z = -TILE * 0.42;
    if (!tile?.water) mesh.add(walk, walk2);
    const links = [n, s, e, w].filter(Boolean).length;
    if (!tile?.water && (links >= 3 || (x + y) % 3 === 0) && this.lampCount < 48) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.85, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.4, roughness: 0.4 }),
      );
      pole.position.set(0.7, 0.48, 0.7);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshStandardMaterial({
          color: 0xf3d48a,
          emissive: 0xf0b36a,
          emissiveIntensity: 0.9,
        }),
      );
      bulb.position.set(0.7, 0.92, 0.7);
      mesh.add(pole, bulb);
      this.lampCount += 1;
    }
    mesh.userData.tile = { x, y };
    this.roadGroup.add(mesh);
    this.roads.set(`${x},${y}`, mesh);
  }

  private refreshCars(city: City): void {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    const nodes: { x: number; y: number }[] = [];
    for (const t of city.tiles) if (t.road) nodes.push({ x: t.x, y: t.y });
    if (nodes.length < 2) return;
    const count = Math.min(28, Math.floor(nodes.length / 3));
    for (let i = 0; i < count; i++) {
      const path = this.randomPath(city, nodes);
      if (path.length < 2) continue;
      const mesh = this.makeCar(i);
      this.scene.add(mesh);
      this.cars.push({ mesh, path, i: 0, t: Math.random(), speed: 1.4 + Math.random() * 1.1 });
    }
    const walkers = Math.min(16, Math.floor(nodes.length / 4));
    for (let i = 0; i < walkers; i++) {
      const path = this.randomPath(city, nodes);
      if (path.length < 2) continue;
      const mesh = this.makePerson(i);
      this.scene.add(mesh);
      this.cars.push({ mesh, path, i: 0, t: Math.random(), speed: 0.45 + Math.random() * 0.25 });
    }
  }

  private randomPath(city: City, nodes: { x: number; y: number }[]): THREE.Vector3[] {
    const start = nodes[Math.floor(Math.random() * nodes.length)];
    const pts: THREE.Vector3[] = [];
    let cur = start;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < 18; i++) {
      pts.push(tileToWorld(cur.x, cur.y, city.size).add(new THREE.Vector3(0, 0.12, 0)));
      const opts = city.neighbors4(cur.x, cur.y).filter((n) => n.road);
      if (!opts.length) break;
      let next = opts[Math.floor(Math.random() * opts.length)];
      if (opts.length > 1 && prev) {
        const filtered = opts.filter((n) => n.x !== prev!.x || n.y !== prev!.y);
        if (filtered.length) next = filtered[Math.floor(Math.random() * filtered.length)];
      }
      prev = cur;
      cur = { x: next.x, y: next.y };
    }
    return pts;
  }

  private makeCar(seed: number): THREE.Group {
    const g = new THREE.Group();
    const colors = [0xc45c4a, 0x2c3d5a, 0xc9a227, 0xe8e4dc, 0x3d7a4a];
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.12, 0.2),
      new THREE.MeshStandardMaterial({ color: colors[seed % colors.length], metalness: 0.4, roughness: 0.35 }),
    );
    body.position.y = 0.08;
    body.castShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.1, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x89c2d4, metalness: 0.3, roughness: 0.15 }),
    );
    cabin.position.set(-0.02, 0.16, 0);
    g.add(body, cabin);
    return g;
  }

  private makePerson(seed: number): THREE.Group {
    const g = new THREE.Group();
    const hues = [0xc45c4a, 0x2c3d5a, 0xe8e4dc, 0x3d7a4a, 0xc9a227];
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.05, 0.12, 4, 6),
      new THREE.MeshStandardMaterial({ color: hues[seed % hues.length], roughness: 0.7 }),
    );
    body.position.y = 0.14;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xe0c4a8, roughness: 0.8 }),
    );
    head.position.y = 0.26;
    g.add(body, head);
    return g;
  }

  private refreshBoats(city: City): void {
    for (const b of this.boats) this.scene.remove(b.mesh);
    this.boats = [];
    const nodes: { x: number; y: number }[] = [];
    for (const t of city.tiles) if (t.water) nodes.push({ x: t.x, y: t.y });
    if (nodes.length < 4) return;
    const docks = city.tiles.filter((t) => t.buildingId === "dock").length;
    const count = Math.min(12, 4 + docks * 2);
    for (let i = 0; i < count; i++) {
      const path = this.randomWaterPath(city, nodes);
      if (path.length < 2) continue;
      const mesh = this.makeBoat(i);
      this.scene.add(mesh);
      this.boats.push({ mesh, path, i: 0, t: Math.random(), speed: 0.55 + Math.random() * 0.35 });
    }
  }

  private randomWaterPath(city: City, nodes: { x: number; y: number }[]): THREE.Vector3[] {
    const start = nodes[Math.floor(Math.random() * nodes.length)];
    const pts: THREE.Vector3[] = [];
    let cur = start;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < 22; i++) {
      pts.push(tileToWorld(cur.x, cur.y, city.size).add(new THREE.Vector3(0, 0.18, 0)));
      const opts = city.neighbors4(cur.x, cur.y).filter((n) => n.water);
      if (!opts.length) break;
      let next = opts[Math.floor(Math.random() * opts.length)];
      if (opts.length > 1 && prev) {
        const filtered = opts.filter((n) => n.x !== prev!.x || n.y !== prev!.y);
        if (filtered.length) next = filtered[Math.floor(Math.random() * filtered.length)];
      }
      prev = cur;
      cur = { x: next.x, y: next.y };
    }
    return pts;
  }

  private makeBoat(seed: number): THREE.Group {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.28),
      new THREE.MeshStandardMaterial({ color: seed % 2 ? 0xcfc4b0 : 0x8a5a32, roughness: 0.55 }),
    );
    hull.position.y = 0.06;
    hull.castShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.14, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 }),
    );
    cabin.position.set(-0.08, 0.16, 0);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.025, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c }),
    );
    mast.position.set(0.1, 0.38, 0);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d4, side: THREE.DoubleSide, roughness: 0.9 }),
    );
    sail.position.set(0.18, 0.42, 0);
    g.add(hull, cabin, mast, sail);
    return g;
  }

  private spawnBirds(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.7 });
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mat);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.05), mat);
      g.add(body, wing);
      g.userData.phase = Math.random() * Math.PI * 2;
      g.userData.radius = 18 + Math.random() * 16;
      g.userData.height = 7 + Math.random() * 5;
      g.userData.speed = 0.18 + Math.random() * 0.12;
      this.scene.add(g);
      this.birds.push(g);
    }
  }

  setGhost(def: BuildingDef | null, x: number, y: number, valid: boolean): void {
    if (!def) {
      this.ghost.visible = false;
      return;
    }
    this.ghost.visible = true;
    const p = tileToWorld(x, y, this.size);
    p.y = this.heightAt(x, y, this.size);
    this.ghost.position.copy(p);
    const mesh = this.ghost.children[0] as THREE.Mesh;
    const h = Math.max(0.2, def.height * 0.45);
    mesh.scale.set(1, h / 0.15, 1);
    mesh.position.y = h / 2;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(valid ? 0x3ad4c8 : 0xd4544a);
    mat.emissive.set(valid ? 0x1aa89c : 0x801818);
    const radius = Math.max(1, def.serviceRadius || 0);
    this.ghostRing.visible = radius > 1;
    this.ghostRing.scale.setScalar(radius * TILE * 0.55);
    const ringMat = this.ghostRing.material as THREE.MeshBasicMaterial;
    ringMat.color.set(valid ? 0x3ad4c8 : 0xd4544a);
  }

  setLayer(id: InfoLayer): void {
    this.overlay.visible = id !== "none";
  }

  updateLayer(city: City, layer: InfoLayer): void {
    if (layer === "none") {
      this.overlay.visible = false;
      return;
    }
    this.overlayTick += 1;
    if (this.overlayTex && this.lastLayer === layer && this.overlayTick % 10 !== 1) {
      this.overlay.visible = true;
      return;
    }
    this.lastLayer = layer;
    this.overlay.visible = true;
    const s = city.size;
    const canvas = document.createElement("canvas");
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext("2d")!;
    for (const t of city.tiles) {
      let fill = "rgba(0,0,0,0.15)";
      if (layer === "power") {
        if (t.buildingId && !t.road) fill = t.powered ? "rgba(58,212,200,0.55)" : "rgba(208,80,70,0.5)";
        else if (t.road) fill = t.powered ? "rgba(58,212,200,0.28)" : "rgba(20,20,24,0.35)";
      } else if (layer === "water") {
        if (t.water) fill = "rgba(42,160,184,0.45)";
        else if (t.buildingId && !t.road) fill = t.watered ? "rgba(90,168,212,0.55)" : "rgba(208,80,70,0.5)";
        else if (t.road) fill = t.watered ? "rgba(90,168,212,0.28)" : "rgba(20,20,24,0.35)";
      } else {
        const cov = city.coverageAt(t.x, t.y);
        const v = Math.max(0, Math.min(1, cov.park / 10 + cov.service / 4 - cov.pollution / 8));
        fill = `rgba(${Math.round(220 - v * 140)},${Math.round(80 + v * 140)},${Math.round(70 + v * 40)},0.45)`;
      }
      ctx.fillStyle = fill;
      ctx.fillRect(t.x, s - 1 - t.y, 1, 1);
    }
    if (this.overlayTex) this.overlayTex.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.overlayTex = tex;
    const mat = this.overlay.material as THREE.MeshBasicMaterial;
    mat.map = tex;
    mat.opacity = 0.85;
    mat.needsUpdate = true;
  }

  setHover(x: number, y: number, show: boolean): void {
    this.hover.visible = show;
    if (!show) return;
    const p = tileToWorld(x, y, this.size);
    this.hover.position.set(p.x, this.heightAt(x, y, this.size) + 0.08, p.z);
  }

  pickGround(ndc: THREE.Vector2): THREE.Vector3 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) return hit;
    return null;
  }

  /** Prefer a building or road mesh so clicking a roof surveys that plot, not the grass behind it. */
  pickTile(ndc: THREE.Vector2, size: number): { x: number; y: number } | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects([this.buildGroup, this.roadGroup, this.ground], true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const tile = obj.userData?.tile as { x: number; y: number } | undefined;
        if (tile && Number.isFinite(tile.x) && Number.isFinite(tile.y)) return tile;
        obj = obj.parent;
      }
    }
    const ground = this.pickGround(ndc);
    return ground ? worldToTile(ground, size) : null;
  }

  update(dt: number, city: City): void {
    this.waterTime += dt;
    const mat = this.water.material as THREE.ShaderMaterial;
    if (mat.uniforms?.time) mat.uniforms.time.value = this.waterTime;

    const phase = city.dayPhase();
    const sunAngle = phase * Math.PI * 2 - Math.PI / 2;
    const elev = Math.sin(sunAngle);
    const night = THREE.MathUtils.smoothstep(-0.15, 0.15, -elev);
    const skyMat = this.sky.material as THREE.ShaderMaterial;
    skyMat.uniforms.night.value = night;
    this.sun.position.set(Math.cos(sunAngle) * 60, Math.max(4, elev * 50 + 8), Math.sin(sunAngle) * 40);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = 0.35 + (1 - night) * 2.35;
    this.sun.color.set(night > 0.55 ? 0xff9a62 : elev > 0.15 ? 0xffe4b8 : 0xffc08a);
    this.hemi.intensity = 0.28 + (1 - night) * 0.62;
    this.moon.intensity = 0.08 + night * 0.35;
    this.moon.position.set(-40, 30, -20);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(night > 0.5 ? 0x121a24 : 0xb7c9d6);
    fog.near = night > 0.5 ? 40 : 60;
    fog.far = night > 0.5 ? 130 : 170;
    this.scene.background = fog.color;
    this.renderer.toneMappingExposure = 0.82 + (1 - night) * 0.28;
    this.bloom.strength = preferLiteGpu() ? 0.08 + night * 0.16 : 0.18 + night * 0.32;

    for (const [, b] of this.buildings) {
      setBuildingNight(b, night);
      const fire = b.userData.fire as THREE.Group | undefined;
      const tilePos = b.userData.tile as { x: number; y: number } | undefined;
      const tile = tilePos ? city.get(tilePos.x, tilePos.y) : null;
      if (fire) {
        fire.visible = Boolean(tile?.onFire);
        if (fire.visible) {
          fire.rotation.y += dt * 5;
          const pulse = 0.82 + Math.sin(this.waterTime * 11 + (tilePos?.x ?? 0)) * 0.18;
          fire.scale.set(pulse, 0.9 + pulse * 0.25, pulse);
        }
      }
      const spin = b.userData.spin as THREE.Object3D | undefined;
      if (spin) spin.rotation.z += dt * 1.15;
    }

    for (const car of this.cars) {
      this.advanceMover(car, dt, 2.1);
    }
    for (const boat of this.boats) {
      this.advanceMover(boat, dt, 2.6);
    }
    for (const bird of this.birds) {
      const phase = (bird.userData.phase as number) + dt * (bird.userData.speed as number);
      bird.userData.phase = phase;
      const r = bird.userData.radius as number;
      bird.position.set(Math.cos(phase) * r, bird.userData.height as number, Math.sin(phase) * r * 0.72);
      bird.lookAt(Math.cos(phase + 0.2) * r, bird.position.y, Math.sin(phase + 0.2) * r * 0.72);
    }
  }

  private advanceMover(car: Car, dt: number, scale: number): void {
    if (car.path.length < 2) return;
    car.t += (dt * car.speed) / scale;
    while (car.t >= 1) {
      car.t -= 1;
      car.i = (car.i + 1) % (car.path.length - 1);
    }
    const a = car.path[car.i];
    const b = car.path[car.i + 1];
    car.mesh.position.lerpVectors(a, b, car.t);
    car.mesh.lookAt(b);
  }

  render(): void {
    this.composer.render();
  }

  nightAmount(city: City): number {
    const phase = city.dayPhase();
    const elev = Math.sin(phase * Math.PI * 2 - Math.PI / 2);
    return THREE.MathUtils.smoothstep(-0.15, 0.15, -elev);
  }

  drawMinimap(canvas: HTMLCanvasElement, city: City): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = city.size;
    if (canvas.width !== s) {
      canvas.width = s;
      canvas.height = s;
    }
    ctx.fillStyle = "#1c2418";
    ctx.fillRect(0, 0, s, s);
    for (const t of city.tiles) {
      if (t.water && !t.road) ctx.fillStyle = "#2aa0b8";
      else if (t.road) ctx.fillStyle = t.water ? "#c9a227" : "#5a5e66";
      else if (t.onFire) ctx.fillStyle = "#ff6a2a";
      else if (!t.buildingId) continue;
      else {
        const def = CATALOG_BY_ID[t.buildingId];
        ctx.fillStyle =
          def?.category === "residential"
            ? "#d4a017"
            : def?.category === "commercial"
              ? "#c45c4a"
              : def?.category === "industrial"
                ? "#6b5a4a"
                : def?.category === "civic"
                  ? "#3d7a4a"
                  : def?.category === "utility"
                    ? "#3ad4c8"
                    : "#c9a227";
      }
      ctx.fillRect(t.x, t.y, 1, 1);
    }
  }
}
