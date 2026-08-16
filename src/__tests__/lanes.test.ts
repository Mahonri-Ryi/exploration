import { describe, expect, it } from "vitest";
import { CAR_LANE, offsetPolyline, rightHandOffset, yawToward } from "../world/lanes";

function rotateY(x: number, z: number, yaw: number): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}

describe("right-hand lanes", () => {
  it("puts traffic to the right when heading east (+X)", () => {
    const o = rightHandOffset(1, 0, 0.32);
    expect(o.x).toBeCloseTo(0);
    expect(o.z).toBeCloseTo(0.32);
  });

  it("puts traffic to the right when heading south (+Z)", () => {
    const o = rightHandOffset(0, 1, 0.32);
    expect(o.x).toBeCloseTo(-0.32);
    expect(o.z).toBeCloseTo(0);
  });

  it("offsets an eastbound polyline onto the south lane", () => {
    const out = offsetPolyline(
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 8, z: 0 },
      ],
      CAR_LANE,
    );
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeCloseTo(CAR_LANE);
    }
  });

  it("aims local -Z along each cardinal travel direction", () => {
    const cases = [
      { dx: 1, dz: 0, fx: 1, fz: 0 },
      { dx: -1, dz: 0, fx: -1, fz: 0 },
      { dx: 0, dz: 1, fx: 0, fz: 1 },
      { dx: 0, dz: -1, fx: 0, fz: -1 },
    ];
    for (const c of cases) {
      const front = rotateY(0, -1, yawToward(c.dx, c.dz));
      expect(front.x).toBeCloseTo(c.fx);
      expect(front.z).toBeCloseTo(c.fz);
    }
  });
});
