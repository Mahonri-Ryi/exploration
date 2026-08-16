import { describe, expect, it } from "vitest";
import { rightHandOffset } from "../world/lanes";

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
});
