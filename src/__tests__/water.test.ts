import { describe, expect, it } from "vitest";
import { buildWaterGeometries } from "../world/water";

describe("water meshes", () => {
  it("builds a river ribbon and lake with positions", () => {
    const { bed, surface, foam } = buildWaterGeometries(40, 2);
    expect(surface.getAttribute("position").count).toBeGreaterThan(100);
    expect(bed.getAttribute("position").count).toBeGreaterThan(100);
    expect(foam.getAttribute("position").count).toBeGreaterThan(50);
    const pos = surface.getAttribute("position");
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minX = Math.min(minX, pos.getX(i));
      maxX = Math.max(maxX, pos.getX(i));
    }
    expect(maxX - minX).toBeGreaterThan(40);
  });
});
