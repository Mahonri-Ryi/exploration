import * as THREE from "three";

export class OrbitCam {
  target = new THREE.Vector3(0, 0, 0);
  spherical = new THREE.Spherical(34, 1.02, Math.PI / 4);
  private dragging: "orbit" | "pan" | null = null;
  private last = new THREE.Vector2();
  private keys = new Set<string>();

  constructor(
    private camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ) {
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    window.addEventListener("pointerup", () => {
      this.dragging = null;
    });
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

  private onDown(e: PointerEvent): void {
    if (e.button === 2 || e.button === 1) this.dragging = "orbit";
    else if (e.button === 0 && (e.altKey || e.shiftKey)) this.dragging = "pan";
    this.last.set(e.clientX, e.clientY);
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    this.last.set(e.clientX, e.clientY);
    if (this.dragging === "orbit") {
      this.spherical.theta -= dx * 0.007;
      this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi + dy * 0.005, 0.35, 1.25);
    } else {
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
