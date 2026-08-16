import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CATALOG_BY_ID, isWaterTile, type BuildingDef } from "../game/catalog";
import type { City } from "../game/city";
import { mulberry } from "./textures";
import { createBuilding, setBuildingNight } from "./buildings";

export const TILE = 2;

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
  private roadGroup = new THREE.Group();
  private buildGroup = new THREE.Group();
  private wilds = new THREE.Group();
  private asphaltTex: THREE.Texture | null = null;
  private waterTime = 0;
  private size = 40;
  private sky: THREE.Mesh;
  private bloom: UnrealBloomPass;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    this.camera.position.set(28, 22, 28);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    this.sun.shadow.mapSize.set(2048, 2048);
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
    grid.position.y = 0.05;
    const gridMat = grid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    gridMat.opacity = 0.22;
    this.scene.add(grid);

    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        deep: { value: new THREE.Color(0x0c3a4a) },
        shallow: { value: new THREE.Color(0x2f8fa3) },
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(p.x * 1.8 + time * 1.4) * 0.04 + cos(p.y * 1.6 + time) * 0.03;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 deep;
        uniform vec3 shallow;
        uniform float time;
        varying vec2 vUv;
        void main() {
          float n = sin(vUv.x * 40.0 + time) * 0.5 + cos(vUv.y * 36.0 - time * 0.8) * 0.5;
          vec3 col = mix(deep, shallow, 0.45 + n * 0.12);
          gl_FragColor = vec4(col, 0.88);
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
      new THREE.MeshBasicMaterial({ color: 0xf2d48a, transparent: true, opacity: 0.18 }),
    );
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = 0.07;
    this.scene.add(this.hover);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.28, 0.35, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener("resize", () => this.resize());
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
    grass.anisotropy = 8;
    asphalt.anisotropy = 8;
    this.asphaltTex = asphalt;
    const gmat = this.ground.material as THREE.MeshStandardMaterial;
    gmat.map = grass;
    gmat.color.set(0xffffff);
    gmat.needsUpdate = true;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  bindCity(city: City): void {
    this.size = city.size;
    this.rebuildTerrain(city);
    this.rebuildAll(city);
  }

  private rebuildTerrain(city: City): void {
    const waterGeom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let y = 0; y < city.size; y++) {
      for (let x = 0; x < city.size; x++) {
        if (!isWaterTile(x, y, city.size)) continue;
        const p = tileToWorld(x, y, city.size);
        const s = TILE * 0.52;
        const y0 = 0.03;
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
      spots.push(p);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 5), bark, spots.length);
    const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(0.38, 0.85, 7), foliage, spots.length);
    trunk.castShadow = leaves.castShadow = true;
    spots.forEach((p, i) => {
      dummy.position.set(p.x, 0.2, p.z);
      dummy.scale.setScalar(0.8 + rng() * 0.6);
      dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 0.72;
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
    for (const tile of city.tiles) {
      if (tile.road) this.ensureRoad(city, tile.x, tile.y);
      else if (tile.buildingId && tile.buildingId !== "road") this.ensureBuilding(city, tile.x, tile.y);
    }
    this.refreshCars(city);
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
    mesh.position.copy(p);
    mesh.userData.tile = { x, y };
    this.buildGroup.add(mesh);
    this.buildings.set(`${x},${y}`, mesh);
  }

  private ensureRoad(city: City, x: number, y: number): void {
    const p = tileToWorld(x, y, city.size);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5a5e66,
      map: this.asphaltTex,
      roughness: 0.62,
      metalness: 0.08,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.98, 0.1, TILE * 0.98), mat);
    mesh.position.set(p.x, 0.06, p.z);
    mesh.receiveShadow = true;
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

  setGhost(def: BuildingDef | null, x: number, y: number, valid: boolean): void {
    if (!def) {
      this.ghost.visible = false;
      return;
    }
    this.ghost.visible = true;
    const p = tileToWorld(x, y, this.size);
    this.ghost.position.copy(p);
    const mesh = this.ghost.children[0] as THREE.Mesh;
    const h = Math.max(0.2, def.height * 0.45);
    mesh.scale.set(1, h / 0.15, 1);
    mesh.position.y = h / 2;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(valid ? 0x3ad4c8 : 0xd4544a);
    mat.emissive.set(valid ? 0x1aa89c : 0x801818);
  }

  setHover(x: number, y: number, show: boolean): void {
    this.hover.visible = show;
    if (!show) return;
    const p = tileToWorld(x, y, this.size);
    this.hover.position.set(p.x, 0.07, p.z);
  }

  pickGround(ndc: THREE.Vector2): THREE.Vector3 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) return hit;
    return null;
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
    this.sun.intensity = 0.25 + (1 - night) * 2.0;
    this.sun.color.set(night > 0.6 ? 0xffb070 : 0xffe6c2);
    this.hemi.intensity = 0.22 + (1 - night) * 0.55;
    this.moon.intensity = 0.08 + night * 0.35;
    this.moon.position.set(-40, 30, -20);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(night > 0.5 ? 0x121a24 : 0xb7c9d6);
    fog.near = night > 0.5 ? 40 : 60;
    fog.far = night > 0.5 ? 130 : 170;
    this.scene.background = fog.color;
    this.renderer.toneMappingExposure = 0.82 + (1 - night) * 0.28;
    this.bloom.strength = 0.18 + night * 0.32;

    for (const [, b] of this.buildings) setBuildingNight(b, night);

    for (const car of this.cars) {
      if (car.path.length < 2) continue;
      car.t += (dt * car.speed) / 2.1;
      while (car.t >= 1) {
        car.t -= 1;
        car.i = (car.i + 1) % (car.path.length - 1);
      }
      const a = car.path[car.i];
      const b = car.path[car.i + 1];
      car.mesh.position.lerpVectors(a, b, car.t);
      car.mesh.lookAt(b);
    }
  }

  render(): void {
    this.composer.render();
  }

  nightAmount(city: City): number {
    const phase = city.dayPhase();
    const elev = Math.sin(phase * Math.PI * 2 - Math.PI / 2);
    return THREE.MathUtils.smoothstep(-0.15, 0.15, -elev);
  }
}
