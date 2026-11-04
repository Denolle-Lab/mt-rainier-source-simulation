import { describe, expect, it } from "vitest";
import { applyWeights, idwWeights } from "./interp.js";

describe("surface field interpolation", () => {
  const rx = [0, 2, 0], rz = [0, 0, 2], grid = { x0: -1, z0: -1, w: 4, h: 4, n: 8 };   // 0.5 km cells
  const W = idwWeights(rx, rz, grid, 3, 3);
  const cell = (x, z) => Math.floor((z - grid.z0) / 0.5) * grid.n + Math.floor((x - grid.x0) / 0.5);

  it("normalizes the weights and reproduces a constant", () => {
    const out = applyWeights([5, 5, 5], W, new Float32Array(64));
    for (let c = 0; c < 64; c++) if (W.idx[c * 3] >= 0) expect(out[c]).toBeCloseTo(5, 5);
  });
  it("is close to the receiver value next to a receiver and in between halfway", () => {
    const out = applyWeights([1, 0, 0], W, new Float32Array(64));
    expect(out[cell(0.25, 0.25)]).toBeGreaterThan(0.75);          // cell centered 0.25 km from receiver 0
    expect(out[cell(1.25, -0.75)]).toBeLessThan(out[cell(0.25, -0.75)]);
  });
  it("fades out far from every receiver", () => {
    const far = idwWeights([0], [0], { x0: -10, z0: -10, w: 20, h: 20, n: 20 }, 1, 3);
    expect(far.fade[0]).toBe(0);                                  // corner, 13 km away
    expect(far.fade[10 * 20 + 10]).toBe(1);                       // next to the receiver
  });
});
