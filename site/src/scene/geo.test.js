// Adapted from the Mount Rainier Seismic Atlas viewer (Denolle-Lab/mt-rainier-digital-model, web/viewer/site/src/scene/geo.test.js;
// MIT, Derek Yao; see THIRD_PARTY_NOTICES.md).
import { describe, expect, it } from "vitest";
import { fromX, fromZ, KX, LAT0, LON0, toX, toZ } from "./geo.js";

describe("geo", () => {
  it("projects around the summit in km, north is −z", () => {
    expect(toX(LON0)).toBe(0);
    expect(toX(LON0 + 1)).toBeCloseTo(76.129, 3);
    expect(toZ(LAT0 + 1)).toBeCloseTo(-111.13);
    expect(KX).toBeCloseTo(76.129, 3);
  });
  it("inverts", () => {
    expect(fromX(toX(-121.9))).toBeCloseTo(-121.9, 10);
    expect(fromZ(toZ(46.7))).toBeCloseTo(46.7, 10);
  });
});
