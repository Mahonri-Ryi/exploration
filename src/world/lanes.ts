/** Right-hand lane offset for a travel direction on the XZ plane. */
export function rightHandOffset(dx: number, dz: number, lane: number): { x: number; z: number } {
  const len = Math.hypot(dx, dz);
  if (len < 1e-8) return { x: 0, z: 0 };
  const nx = dx / len;
  const nz = dz / len;
  return { x: -nz * lane, z: nx * lane };
}
