// Simulation overlays in the scene (km; x east, z south, y up): the SPECFEM domain box, the receivers (animated
// by the synthetic ground motion), the source (beachball sphere for a moment tensor, arrow for a force).
import * as THREE from "three";
import { toX, toZ } from "./geo.js";

const DRAPE = 0.015;   // km above the ground for lines and markers

// Mesh outline draped on the ground, its bottom and the corner edges.
export function domainBox(mesh, elevKm) {
  const c = mesh.corners_lonlat.map(([lon, lat]) => [toX(lon), toZ(lat)]), bottom = mesh.bottom_km, pts = [];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = c[i], [x1, z1] = c[(i + 1) % 4], n = 120;
    for (let k = 0; k < n; k++) {
      const a = k / n, b = (k + 1) / n;
      pts.push(x0 + (x1 - x0) * a, (elevKm(x0 + (x1 - x0) * a, z0 + (z1 - z0) * a) ?? 0) + DRAPE, z0 + (z1 - z0) * a,
        x0 + (x1 - x0) * b, (elevKm(x0 + (x1 - x0) * b, z0 + (z1 - z0) * b) ?? 0) + DRAPE, z0 + (z1 - z0) * b);
    }
    pts.push(x0, bottom, z0, x1, bottom, z1, x0, bottom, z0, x0, (elevKm(x0, z0) ?? 0), z0);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd8d4c8, transparent: true, opacity: 0.7 }));
  line.renderOrder = 15;
  return line;
}

// diverging blue-white-red for v in [-1, 1]
export function diverging(v, out) {
  const t = Math.max(-1, Math.min(1, v)), a = Math.abs(t);
  const lo = [0.13, 0.4, 0.67], hi = [0.7, 0.09, 0.17], w = [0.97, 0.97, 0.97], e = t < 0 ? lo : hi;
  out.setRGB(w[0] + (e[0] - w[0]) * a, w[1] + (e[1] - w[1]) * a, w[2] + (e[2] - w[2]) * a);
  return out;
}

export class Receivers {
  constructor(receivers, elevKm) {
    this.receivers = receivers; this.group = new THREE.Group(); this._c = new THREE.Color(); this._m = new THREE.Matrix4();
    this.pos = receivers.map(r => { const x = toX(r.lon), z = toZ(r.lat); return [x, (elevKm(x, z) ?? r.elev_m / 1000) + DRAPE, z]; });
    const geo = new THREE.SphereGeometry(0.09, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, receivers.length);
    this.mesh.renderOrder = 16;
    this.mesh.userData.pick = hit => ({ type: "receiver", index: hit.instanceId });
    // UW/CC stations: a ring around the marker
    const ring = new THREE.RingGeometry(0.16, 0.21, 24); ring.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }), receivers.length);
    this.sel = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.33, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf0e442, side: THREE.DoubleSide, depthTest: false }));
    this.sel.renderOrder = 18; this.sel.visible = false;
    this.group.add(this.mesh, this.rings, this.sel);
    this.setValues(null);
  }

  // values [nrec] in [-1, 1] (null: at rest)
  setValues(values) {
    for (let i = 0; i < this.receivers.length; i++) {
      const v = values ? values[i] : 0, s = 1 + 2.2 * Math.min(1, Math.abs(v)), [x, y, z] = this.pos[i];
      this._m.makeScale(s, s, s).setPosition(x, y + 0.09 * s, z); this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, values ? diverging(v, this._c) : this._c.set(this.receivers[i].kind === "Z5" ? 0xd9d9d9 : 0xffffff));
      const big = this.receivers[i].kind !== "Z5";
      this._m.makeScale(big ? 1 : 0, 1, big ? 1 : 0).setPosition(x, y, z); this.rings.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; this.rings.instanceMatrix.needsUpdate = true;
  }

  select(i) {
    this.sel.visible = i != null;
    if (i != null) { const [x, y, z] = this.pos[i]; this.sel.position.set(x, y + 0.01, z); }
  }
}

// Beachball sphere: colors each direction n by the sign of n^T M n (USE basis: r = up = y, t = south = z,
// p = east = x), compressional dark. Drawn through the ground so a source below the surface stays visible.
const BB_VERT = `varying vec3 vN; void main() { vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BB_FRAG = `
  uniform float m[6]; varying vec3 vN;
  void main() {
    vec3 n = normalize(vN); float r = n.y, t = n.z, p = n.x;
    float v = m[0]*r*r + m[1]*t*t + m[2]*p*p + 2.0*(m[3]*r*t + m[4]*r*p + m[5]*t*p);
    gl_FragColor = vec4(v > 0.0 ? vec3(0.13) : vec3(0.96), 1.0);
  }`;

export class SourceGlyph {
  constructor() {
    this.group = new THREE.Group();
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32),
      new THREE.ShaderMaterial({ uniforms: { m: { value: [0, 0, 0, 0, 0, 0] } }, vertexShader: BB_VERT, fragmentShader: BB_FRAG, depthTest: false }));
    this.ball.renderOrder = 20;
    this.arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1.6, 0xd55e00, 0.5, 0.3);
    this.arrow.traverse(o => { if (o.material) { o.material.depthTest = false; o.renderOrder = 20; } });
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd55e00, depthTest: false }));
    this.dot.renderOrder = 20;
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
    this.stem = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xf0e442, dashSize: 0.15, gapSize: 0.1, depthTest: false }));
    this.stem.renderOrder = 19;
    this.group.add(this.ball, this.arrow, this.dot, this.stem);
  }

  // p: { lon, lat, elev_m }, surfaceKm: ground elevation above the point; src: { kind: "mt", m } | { kind: "force", f }
  set(p, surfaceKm, src) {
    const x = toX(p.lon), z = toZ(p.lat), y = p.elev_m / 1000;
    this.ball.position.set(x, y, z); this.arrow.position.set(x, y, z); this.dot.position.set(x, y, z);
    const top = Math.max(surfaceKm ?? y, y);
    this.stem.geometry.attributes.position.array.set([x, y, z, x, top, z]); this.stem.geometry.attributes.position.needsUpdate = true;
    this.stem.computeLineDistances(); this.stem.visible = top - y > 0.05;
    const mt = src.kind === "mt";
    this.ball.visible = mt; this.arrow.visible = !mt; this.dot.visible = !mt;
    if (mt) {
      const s = Math.max(...src.m.map(Math.abs)) || 1;
      this.ball.material.uniforms.m.value = src.m.map(v => v / s);
    } else {
      const [fe, fn, fz] = src.f, d = new THREE.Vector3(fe, fz, -fn);   // scene: x east, y up, z south
      if (d.length() > 0) this.arrow.setDirection(d.normalize());
    }
  }
}
