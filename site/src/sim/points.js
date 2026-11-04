// The database's source points in scene coordinates, and the lookups behind picking a location on the map:
// the nearest surface point to a clicked ground position, or the nearest point below the surface on a chosen
// elevation level (the 1 km grid's levels, plus the 0.5 km block's).
import { toX, toZ } from "../scene/geo.js";

export class PointSet {
  constructor(points) {
    const n = points.length;
    this.points = points;
    this.x = Float64Array.from(points, p => toX(p.lon));
    this.z = Float64Array.from(points, p => toZ(p.lat));
    this.surface = []; this.below = [];
    for (let i = 0; i < n; i++) (points[i].kind === "surf" ? this.surface : this.below).push(i);
    this.levels = [...new Set(this.below.map(i => points[i].elev_m))].sort((a, b) => b - a);   // top first
  }

  _nearest(cands, x, z) {
    let best = null, bd = Infinity;
    for (const i of cands) { const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }

  nearestSurface(x, z) { return this._nearest(this.surface, x, z); }

  atLevel(elevM) { return this.below.filter(i => Math.abs(this.points[i].elev_m - elevM) < 0.5); }

  nearestAtLevel(x, z, elevM) { return this._nearest(this.atLevel(elevM), x, z); }

  // horizontal distance (km) between a point and a scene position
  offsetKm(i, x, z) { return Math.hypot(this.x[i] - x, this.z[i] - z); }
}
