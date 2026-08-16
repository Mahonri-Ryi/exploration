import * as THREE from "three";

type DragMode = "orbit" | "pan" | null;

export class OrbitCam {
  target = new THREE.Vector3(0, 0, 0);
  spherical = new THREE.Spherical(34, 1.02, Math.PI / 4);
  lookMode = false;

  private dragging: DragMode = null;
  private last = new THREE.Vector2();
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private pinchMid = new THREE.Vector2();
  private gesturing = false;
  /** Stays true after a pinch until the next one-finger down, so Android pointerup cannot place. */
  private suppressTap = false;
  /** Native TouchEvents own the camera on phones; Pointer Events still drive mouse/pen. */
  private usingTouches = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
  ) {
    canvas.style.touchAction = "none";
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    const touchOpts: AddEventListenerOptions = { passive: false };
    canvas.addEventListener("touchstart", (e) => this.onTouch(e), touchOpts);
    canvas.addEventListener("touchmove", (e) => this.onTouch(e), touchOpts);
    canvas.addEventListener("touchend", (e) => this.onTouch(e), touchOpts);
    canvas.addEventListener("touchcancel", (e) => this.onTouch(e), touchOpts);
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    window.addEventListener("pointerup", (e) => this.onUp(e));
    window.addEventListener("pointercancel", (e) => this.onUp(e));
    window.addEventListener("pointermove", (e) => this.onMove(e));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.spherical.radius = THREE.MathUtils.clamp(
          this.spherical.radius + e.deltaY * 0.03,
          10,
          72,
        );
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
  }

  pointerCount(): number {
    return this.pointers.size;
  }

  /** True while look-mode, pinch, or two-finger orbit should steal the pointer from tools. */
  isBusy(): boolean {
    return this.lookMode || this.gesturing || this.pointers.size >= 2 || this.suppressTap;
  }

  setLookMode(on: boolean): void {
    this.lookMode = on;
    this.canvas.style.cursor = on ? "grab" : "";
  }

  toggleLookMode(): boolean {
    this.setLookMode(!this.lookMode);
    return this.lookMode;
  }

  private onTouch(e: TouchEvent): void {
    e.preventDefault();
    this.usingTouches = e.touches.length > 0;
    const prev = this.pointers.size;
    this.pointers.clear();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches.item(i);
      if (!t) continue;
      this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    const n = this.pointers.size;

    if (e.type === "touchstart" && n === 1 && prev === 0) this.suppressTap = false;

    if (n >= 2) {
      this.suppressTap = true;
      this.gesturing = true;
      this.dragging = null;
      this.applyPinch(prev < 2);
      return;
    }

    if (n === 1 && this.lookMode) {
      const pt = [...this.pointers.values()][0];
      if (e.type === "touchstart" || prev !== 1) {
        this.last.set(pt.x, pt.y);
        this.dragging = "orbit";
        this.gesturing = true;
      } else {
        this.orbit(pt.x - this.last.x, pt.y - this.last.y);
        this.last.set(pt.x, pt.y);
      }
      return;
    }

    if (n === 0) {
      this.dragging = null;
      this.gesturing = false;
      this.pinchDist = 0;
      this.usingTouches = false;
    }
  }

  private applyPinch(reset: boolean): void {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const midX = (pts[0].x + pts[1].x) / 2;
    const midY = (pts[0].y + pts[1].y) / 2;
    if (!reset && this.pinchDist > 0) {
      const ratio = this.pinchDist / Math.max(1, d);
      this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * ratio, 10, 72);
      this.orbit(midX - this.pinchMid.x, midY - this.pinchMid.y);
    }
    this.pinchDist = d;
    this.pinchMid.set(midX, midY);
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === "touch") {
      if (this.usingTouches) return;
      this.ingestPointer(e);
      return;
    }
    this.ingestPointer(e);
    if (this.pointers.size >= 2) {
      this.suppressTap = true;
      this.gesturing = true;
      this.dragging = null;
      this.syncPinch();
      return;
    }
    if (this.lookMode && e.button === 0) {
      this.dragging = "orbit";
      this.gesturing = true;
      return;
    }
    if (e.button === 2 || e.button === 1) this.dragging = "orbit";
    else if (e.button === 0 && (e.altKey || e.shiftKey)) this.dragging = "pan";
  }

  private ingestPointer(e: PointerEvent): void {
    if (this.pointers.size === 0) this.suppressTap = false;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.last.set(e.clientX, e.clientY);
    if (e.pointerType === "touch" && this.lookMode && this.pointers.size === 1) {
      this.dragging = "orbit";
      this.gesturing = true;
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerType === "touch" && this.usingTouches) return;
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.pointers.size >= 2) {
      this.gesturing = true;
      this.suppressTap = true;
      const pts = [...this.pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (this.pinchDist > 0) {
        const ratio = this.pinchDist / Math.max(1, d);
        this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * ratio, 10, 72);
        this.orbit(midX - this.pinchMid.x, midY - this.pinchMid.y);
      }
      this.pinchDist = d;
      this.pinchMid.set(midX, midY);
      return;
    }

    if (!this.dragging) return;
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    this.last.set(e.clientX, e.clientY);
    if (this.dragging === "orbit") this.orbit(dx, dy);
    else this.pan(dx, dy);
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerType === "touch" && this.usingTouches) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.pointers.size === 1) {
      const remain = [...this.pointers.values()][0];
      this.last.set(remain.x, remain.y);
    }
    if (this.pointers.size === 0) {
      this.dragging = null;
      this.gesturing = false;
    }
  }

  private syncPinch(): void {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    this.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    this.pinchMid.set((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
  }

  private orbit(dx: number, dy: number): void {
    this.spherical.theta -= dx * 0.007;
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi + dy * 0.005, 0.35, 1.25);
  }

  private pan(dx: number, dy: number): void {
    const pan = 0.03 * (this.spherical.radius / 40);
    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.target.addScaledVector(right, -dx * pan);
    this.target.addScaledVector(forward, dy * pan);
  }

  update(dt: number): void {
    const speed = 18 * dt * (this.spherical.radius / 40);
    const forward = new THREE.Vector3(Math.sin(this.spherical.theta), 0, Math.cos(this.spherical.theta));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    if (this.keys.has("w") || this.keys.has("arrowup")) this.target.addScaledVector(forward, -speed);
    if (this.keys.has("s") || this.keys.has("arrowdown")) this.target.addScaledVector(forward, speed);
    if (this.keys.has("a") || this.keys.has("arrowleft")) this.target.addScaledVector(right, -speed);
    if (this.keys.has("d") || this.keys.has("arrowright")) this.target.addScaledVector(right, speed);
    if (this.keys.has("q")) this.spherical.theta += dt * 1.1;
    if (this.keys.has("e")) this.spherical.theta -= dt * 1.1;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -50, 50);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -50, 50);
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  reset(): void {
    this.target.set(0, 0, 0);
    this.spherical.set(34, 1.02, Math.PI / 4);
  }
}
