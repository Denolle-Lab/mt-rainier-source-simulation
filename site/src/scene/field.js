// Surface color field: receiver values interpolated onto the ground (inverse-distance weights, src/sim/interp.js) and
// drawn through the terrain shader's overlay texture. Only near receivers; it is an interpolation, not a wavefield.
//   motion(v): values in [-1, 1] (the receivers' vertical motion), blue-white-red, transparent where v ~ 0
//   peak(p): values in [0, 1] (log peak over its maximum), cividis
import * as THREE from "three";
import { toX, toZ } from "./geo.js";
import { diverging } from "./overlays.js";
import { applyWeights, idwWeights } from "../sim/interp.js";

const N = 160, OPACITY = 0.8;
const CIVIDIS = [[0.0, 0.135, 0.305], [0.103, 0.22, 0.436], [0.264, 0.308, 0.423], [0.381, 0.395, 0.436], [0.489, 0.485, 0.471],
  [0.609, 0.58, 0.464], [0.736, 0.681, 0.424], [0.871, 0.79, 0.343], [0.996, 0.909, 0.218]];

export function cividis(t, out) {
  const x = Math.min(1, Math.max(0, t)) * (CIVIDIS.length - 1), i = Math.min(CIVIDIS.length - 2, Math.floor(x)), f = x - i;
  const a = CIVIDIS[i], b = CIVIDIS[i + 1];
  return out.setRGB(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
}

export class SurfaceField {
  // U: the scene's terrain uniforms (over, overA, oRect); receivers: [{ lon, lat }]
  constructor(U, receivers, { maxKm = 3, k = 6 } = {}) {
    this.U = U;
    const rx = receivers.map(r => toX(r.lon)), rz = receivers.map(r => toZ(r.lat));
    const x0 = Math.min(...rx) - maxKm, z0 = Math.min(...rz) - maxKm;
    this.grid = { x0, z0, w: Math.max(...rx) + maxKm - x0, h: Math.max(...rz) + maxKm - z0, n: N };
    this.W = idwWeights(rx, rz, this.grid, k, maxKm);
    this.cells = new Float32Array(N * N); this.data = new Uint8Array(N * N * 4); this._c = new THREE.Color();
    this.tex = new THREE.DataTexture(this.data, N, N);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
    U.over.value = this.tex; U.oRect.value.set(x0, z0, this.grid.w, this.grid.h); U.overA.value = 0;
  }

  _paint(color, alpha) {
    const { fade } = this.W, d = this.data, c = this._c;
    for (let i = 0; i < this.cells.length; i++) {
      color(this.cells[i], c);
      d[4 * i] = 255 * c.r; d[4 * i + 1] = 255 * c.g; d[4 * i + 2] = 255 * c.b; d[4 * i + 3] = 255 * fade[i] * alpha(this.cells[i]);
    }
    this.tex.needsUpdate = true; this.U.overA.value = OPACITY;
  }

  motion(vals) {
    if (!vals) { this.hide(); return; }
    applyWeights(vals, this.W, this.cells);
    this._paint(diverging, v => Math.min(1, 1.6 * Math.abs(v)));
  }

  peak(vals) {
    if (!vals) { this.hide(); return; }
    applyWeights(vals, this.W, this.cells);
    this._paint(cividis, () => 1);
  }

  hide() { this.U.overA.value = 0; }

  dispose() { this.hide(); this.tex.dispose(); }
}
