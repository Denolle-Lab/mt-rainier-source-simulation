import { describe, expect, it } from "vitest";
import { PointSet } from "./points.js";
import { fromX, fromZ } from "../scene/geo.js";

// a 3 x 3 surface grid (0.25 km) and two subsurface levels (1 km grid)
const pts = [];
for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
  pts.push({ id: pts.length, kind: "surf", lon: fromX(i * 0.25), lat: fromZ(j * 0.25), elev_m: 3000 });
for (const e of [155, -845]) for (let i = -1; i <= 1; i++)
  pts.push({ id: pts.length, kind: "sub", lon: fromX(i), lat: fromZ(0), elev_m: e });

describe("PointSet", () => {
  const ps = new PointSet(pts);
  it("separates surface and subsurface points and lists the levels top first", () => {
    expect(ps.surface.length).toBe(9); expect(ps.below.length).toBe(6); expect(ps.levels).toEqual([155, -845]);
  });
  it("finds the nearest surface point", () => {
    const i = ps.nearestSurface(0.2, -0.2);
    expect(ps.x[i]).toBeCloseTo(0.25, 9); expect(ps.z[i]).toBeCloseTo(-0.25, 9);
  });
  it("finds the nearest point on a level", () => {
    const i = ps.nearestAtLevel(0.7, 0.3, -845);
    expect(pts[i].elev_m).toBe(-845); expect(ps.x[i]).toBeCloseTo(1, 9);
    expect(ps.offsetKm(i, 0.7, 0.3)).toBeCloseTo(Math.hypot(0.3, 0.3), 9);
  });
});
