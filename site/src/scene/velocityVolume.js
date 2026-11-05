// Velocity models below ground (GF comparison database): a vertical section on the terrain-cut plane and a horizontal
// depth slice, both sampling uint8 3D textures of Vp or Vs (index.json "volume", built by build_web_db.py compare) in
// the fragment shader. Adapted from the Mount Rainier Seismic Atlas viewer (Denolle-Lab/mt-rainier-digital-model,
// web/viewer/site/src/scene/ModelVolume.js; MIT, Derek Yao): scene (x, z) km map to the volume grid by quadratic fits,
// elevation maps to depth linearly, everything above the ground is discarded. Shown: one model (cividis over the
// variable's range) or the difference of two, 100 (A / B - 1) % (blue-white-red over +-diffPct).
import * as THREE from "three";
import { diverging } from "./overlays.js";
import { cividis } from "./field.js";

const VERT = `
  varying vec3 vPos;
  void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FRAG = `
  precision highp sampler3D;
  uniform sampler3D uVolA, uVolB; uniform sampler2D uLut, uLutDiff;
  uniform vec3 uPuA, uPuB, uPvA, uPvB; uniform float uZTop, uZSpan, uDiff, uLo, uHi, uDiffPct;
  varying vec3 vPos;
  float poly(vec3 a, vec3 b, vec2 p) { return a.x + a.y * p.x + a.z * p.y + b.x * p.x * p.x + b.y * p.x * p.y + b.z * p.y * p.y; }
  float vel(sampler3D s, vec3 t) { return uLo + min(texture(s, t).r * 255.0 / 254.0, 1.0) * (uHi - uLo); }
  void main() {
    vec2 p = vPos.xz;
    vec3 t = vec3(poly(uPuA, uPuB, p), poly(uPvA, uPvB, p), (uZTop - vPos.y) / uZSpan);
    if (any(lessThan(t, vec3(0.0))) || any(greaterThan(t, vec3(1.0)))) discard;
    if (vPos.y > groundKm(p)) discard;
    vec3 c;
    if (uDiff > 0.5) {
      float d = 100.0 * (vel(uVolA, t) / vel(uVolB, t) - 1.0);
      c = texture2D(uLutDiff, vec2(clamp(0.5 + 0.5 * d / uDiffPct, 0.0, 1.0) * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).rgb;
    } else {
      c = texture2D(uLut, vec2(min(texture(uVolA, t).r * 255.0 / 254.0, 1.0) * 255.0 / 256.0 + 0.5 / 256.0, 0.5)).rgb;
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

function lutTexture(color) {
  const a = new Uint8Array(256 * 4), c = new THREE.Color();
  for (let i = 0; i < 256; i++) { color(i / 255, c); a.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4); }
  const t = new THREE.DataTexture(a, 256, 1); t.colorSpace = THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export class VelocityVolume {
  // scene: SimScene; vol: index.json "volume"; base: the database URL
  constructor(scene, vol, base) {
    this.scene = scene; this.vol = vol; this.base = base; this.cache = new Map(); this.disposed = false;
    const g = vol.grid, [u, v] = [vol.uv_poly.u, vol.uv_poly.v];
    this.zTop = g.z_top_km; this.zBot = g.z_top_km - g.nz * g.dz_km;
    this.U = {
      uVolA: { value: null }, uVolB: { value: null }, uLut: { value: lutTexture(cividis) },
      uLutDiff: { value: lutTexture((x, c) => diverging(2 * x - 1, c)) },
      uPuA: { value: new THREE.Vector3(u[0], u[1], u[2]) }, uPuB: { value: new THREE.Vector3(u[3], u[4], u[5]) },
      uPvA: { value: new THREE.Vector3(v[0], v[1], v[2]) }, uPvB: { value: new THREE.Vector3(v[3], v[4], v[5]) },
      uZTop: { value: this.zTop }, uZSpan: { value: this.zTop - this.zBot }, uDiff: { value: 0 },
      uLo: { value: 0 }, uHi: { value: 1 }, uDiffPct: { value: 10 }, ...scene.ground.uniforms,
    };
    const mat = () => new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: VERT, fragmentShader: scene.ground.glsl + FRAG,
      side: THREE.DoubleSide });
    const span = 60;   // km, larger than the volume in any direction
    this.section = new THREE.Mesh(new THREE.PlaneGeometry(span, this.zTop - this.zBot), mat());
    this.slice = new THREE.Mesh(new THREE.PlaneGeometry(span, span), mat());
    this.slice.rotation.x = -Math.PI / 2;
    for (const m of [this.section, this.slice]) { m.visible = false; m.frustumCulled = false; m.renderOrder = 3; scene.scene.add(m); }
    this.want = { show: null, section: false, slice: false, sliceKm: -2 }; this.ready = null;
  }

  _texture(model, key) {
    const file = this.vol.models[model]?.[key], g = this.vol.grid;
    if (!file) return Promise.resolve(null);
    if (!this.cache.has(file)) {
      this.cache.set(file, fetch(this.base + file).then(r => (r.ok ? r.arrayBuffer() : null)).then(buf => {
        if (!buf || buf.byteLength !== g.nx * g.ny * g.nz) return null;
        const t = new THREE.Data3DTexture(new Uint8Array(buf), g.nx, g.ny, g.nz);
        t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType; t.unpackAlignment = 1;
        t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
        return t;
      }).catch(() => null));
    }
    return this.cache.get(file).then(t => { if (!t) this.cache.delete(file); return t; });
  }

  // show: null (off) or { key: "vp" | "vs", a: model, b: model or null (b: the difference a / b - 1), diffPct }
  async set(show) {
    this.want.show = show; this._apply();
    if (!show) return;
    const [ta, tb] = await Promise.all([this._texture(show.a, show.key), show.b ? this._texture(show.b, show.key) : null]);
    if (this.disposed || this.want.show !== show || !ta || (show.b && !tb)) return;   // a later choice won, or no data
    const [lo, hi] = this.vol.vars[show.key].range;
    this.U.uVolA.value = ta; this.U.uVolB.value = tb ?? ta;
    this.U.uLo.value = lo; this.U.uHi.value = hi; this.U.uDiff.value = show.b ? 1 : 0; this.U.uDiffPct.value = show.diffPct ?? 10;
    this.ready = show; this._apply();
  }

  setSection(on) { this.want.section = on; this._apply(); }
  setSlice(on, km = this.want.sliceKm) { this.want.slice = on; this.want.sliceKm = km; this._apply(); }
  _apply() {
    const ok = !!this.want.show && this.ready === this.want.show;
    this.section.visible = ok && this.want.section && this.scene.U.clipOn.value > 0.5;
    this.slice.visible = ok && this.want.slice;
    this.slice.position.y = this.want.sliceKm;
  }

  // every frame: the section follows the terrain cut (removed side where dot(xz, n) > offset)
  update() {
    const c = this.scene.U.clip.value;
    this.section.rotation.y = Math.atan2(c.x, c.z);
    this.section.position.set(c.x * c.w, (this.zTop + this.zBot) / 2, c.z * c.w);
    this._apply();
  }

  dispose() {
    this.disposed = true;
    for (const m of [this.section, this.slice]) { this.scene.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.U.uLut.value.dispose(); this.U.uLutDiff.value.dispose();
    for (const p of this.cache.values()) p.then(t => t?.dispose());
  }
}
