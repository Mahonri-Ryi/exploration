/** Right-hand traffic: eastbound (+X) sits toward +Z. */
export const CAR_LANE = 0.55;
export const WALKER_LANE = 0.82;

/** Right-hand lane offset for a travel direction on the XZ plane. */
export function rightHandOffset(dx: number, dz: number, lane: number): { x: number; z: number } {
  const len = Math.hypot(dx, dz);
  if (len < 1e-8) return { x: 0, z: 0 };
  const nx = dx / len;
  const nz = dz / len;
  return { x: -nz * lane, z: nx * lane };
}

/**
 * Yaw so a mesh whose front is local -Z travels along (dx, dz).
 * Three.js lookAt also aims local -Z, but it degenerates on short segments.
 */
export function yawToward(dx: number, dz: number): number {
  return Math.atan2(dx, dz) + Math.PI;
}

/** Shift each vertex to the right of its outgoing (or last incoming) segment. */
export function offsetPolyline(
  pts: { x: number; z: number }[],
  lane: number,
): { x: number; z: number }[] {
  if (lane === 0 || pts.length < 2) return pts.map((p) => ({ x: p.x, z: p.z }));
  return pts.map((p, i) => {
    const from = i < pts.length - 1 ? p : pts[i - 1];
    const to = i < pts.length - 1 ? pts[i + 1] : p;
    const o = rightHandOffset(to.x - from.x, to.z - from.z, lane);
    return { x: p.x + o.x, z: p.z + o.z };
  });
}
