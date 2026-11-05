import { describe, expect, it } from "vitest";
import { undoRowDelta } from "./bundle.js";

describe("terrain heights", () => {
  it("undoes the row differences of tools/pack_terrain.py", () => {
    const h = [100, 103, 99, 4380, 120, 120, 118, 85], cols = 4;
    const d = Int16Array.from(h, (v, i) => (i % cols ? v - h[i - 1] : v));
    expect(Array.from(undoRowDelta(d, cols))).toEqual(h);
  });
});
