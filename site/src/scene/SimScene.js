// The 3D scene: the Mount Rainier overview terrain (USGS elevation and imagery), navigation, see-through and cut,
// and a group for the simulation overlays (domain box, receivers, source). Trimmed from the Seismic Atlas viewer's
// RainierScene (Denolle-Lab/mt-rainier-digital-model, MIT, Derek Yao): no summit lidar tiles or model layers,
// sized to its container instead of the window. Units: km; x east, z south, y up.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ease, isMoveKey, motionDuration, moveStep } from "./cameraMath.js";
import { decimate, gridGeometry } from "./gridGeometry.js";
import { deviceProfile } from "./device.js";
import { cutUniform, isUnder, terrainOrder } from "./groundControls.js";
import { makeGround } from "./ground.js";
import { terrainMaterial } from "./terrainMaterial.js";

const BLANK = new THREE.DataTexture(new Uint8Array(4), 1, 1); BLANK.needsUpdate = true;
export const HOME = { pos: [-17, 19, 30], target: [0.5, 0.8, 0.5] };

export class SimScene {
  static async create(canvas, terrain) {
    const photo = await new THREE.TextureLoader().loadAsync(terrain.imageUrl);
    return new SimScene(canvas, terrain, photo, deviceProfile());
  }

  constructor(canvas, terrain, photo, profile) {
    this.canvas = canvas; this.held = new Set(); this.flight = null; this.materials = []; this.see = 0;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: profile.antialias, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, profile.maxPixelRatio));
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color("#121211");
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 2000);
    this.scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x2a2a28, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(-30, 40, -20); this.scene.add(sun);

    this.U = {
      clip: { value: new THREE.Vector4(0, 0, 1, 0) }, clipOn: { value: 0 }, alpha: { value: 1 }, under: { value: 0 },
      style: { value: 0 }, flat: { value: 0 }, hole: { value: new THREE.Vector4(1, -1, 1, -1) }, holeOn: { value: 0 },
      over: { value: BLANK }, overA: { value: 0 }, lines: { value: BLANK }, linesOn: { value: 0 }, oRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    };
    const { meta, heights } = terrain;
    this.ground = makeGround(meta, heights);
    photo.flipY = false; photo.colorSpace = THREE.NoColorSpace; photo.anisotropy = r.capabilities.getMaxAnisotropy(); photo.needsUpdate = true;
    const km = new Float32Array(heights.length); for (let i = 0; i < km.length; i++) km[i] = heights[i] / 1000;
    const d = decimate(km, meta.cols, meta.rows, profile.terrainStride), s = d.s;
    const g = gridGeometry(d.n, d.m, (c, rr) => [meta.x0 + (c * s + 0.5) * meta.dx, meta.z0 + (rr * s + 0.5) * meta.dz, meta.dx * s, meta.dz * s], d.heights,
      (c, rr) => [(c * s + 0.5) / meta.cols, (rr * s + 0.5) / meta.rows]);
    const m = terrainMaterial(this.U, photo); this.materials.push(m);
    this.terrain = new THREE.Mesh(g, m); this.terrain.frustumCulled = false; this.scene.add(this.terrain);
    this.overlays = new THREE.Group(); this.scene.add(this.overlays);

    // navigation as in the Seismic Atlas: drag moves, right- or Ctrl/Cmd-drag rotates, scroll zooms
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.enableDamping = true; c.dampingFactor = 0.08; c.screenSpacePanning = false; c.zoomToCursor = true;
    c.minPolarAngle = 0; c.maxPolarAngle = Math.PI; c.minDistance = 0.1; c.maxDistance = 150;
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.addEventListener("start", () => { this.flight = null; });
    this._onContext = e => e.preventDefault(); canvas.addEventListener("contextmenu", this._onContext);
    this._onKeyDown = e => { if (!isMoveKey(e)) return; e.preventDefault(); this.held.add(e.key); this.flight = null; };
    this._onKeyUp = e => (e.key === "Meta" ? this.held.clear() : this.held.delete(e.key));
    addEventListener("keydown", this._onKeyDown); addEventListener("keyup", this._onKeyUp);
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement);
    this.resize();
    this.camera.position.set(...HOME.pos); this.controls.target.set(...HOME.target);
    this.clock = new THREE.Clock(); this._v = new THREE.Vector3();
    window.__sim = this;   // test hook (e2e)
    this._raf = requestAnimationFrame(this._tick);
  }

  resize() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false); this.canvas.style.width = `${width}px`; this.canvas.style.height = `${height}px`;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.width = width; this.height = height;
  }

  elevKm(x, z) { return this.ground.elevKm(x, z); }

  // canvas pixel position of a scene point ([x, y, depth]; depth > 1 = behind the camera)
  project(x, y, z) { const v = this._v.set(x, y, z).project(this.camera); return [((v.x + 1) / 2) * this.width, ((1 - v.y) / 2) * this.height, v.z]; }

  _ray(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    return ray;
  }

  // ground point under a screen position: march the view ray against the terrain heights, then bisect
  groundAt(clientX, clientY) {
    const { origin: o, direction: d } = this._ray(clientX, clientY).ray;
    const above = t => { const x = o.x + d.x * t, z = o.z + d.z * t, e = this.elevKm(x, z); return e == null ? null : o.y + d.y * t - e; };
    const far = Math.min(400, this.camera.position.distanceTo(this.controls.target) * 8), n = 400;
    let t0 = 0, h0 = above(0);
    for (let i = 1; i <= n; i++) {
      const t = (far * i) / n, h = above(t);
      if (h != null && h0 != null && h0 > 0 && h <= 0) {
        let a = t0, b = t;
        for (let k = 0; k < 24; k++) { const mm = (a + b) / 2, hm = above(mm); if (hm != null && hm > 0) a = mm; else b = mm; }
        const x = o.x + d.x * b, z = o.z + d.z * b; return { x, z, elevKm: this.elevKm(x, z) };
      }
      if (h != null) { t0 = t; h0 = h; }
    }
    return null;
  }

  // first overlay object hit under a screen position (objects with userData.pick)
  pickAt(clientX, clientY) {
    const hits = this._ray(clientX, clientY).intersectObjects(this.overlays.children, true).filter(h => h.object.userData.pick);
    return hits.length ? hits[0].object.userData.pick(hits[0]) : null;
  }

  setSeeThrough(pct) {
    this.see = pct; this.U.alpha.value = 1 - pct / 100;
    for (const m of this.materials) { m.transparent = pct > 0; m.depthWrite = pct === 0; }
  }

  setCut({ on, angle, offset }) { this.U.clip.value.set(...cutUniform(angle, offset)); this.U.clipOn.value = on ? 1 : 0; }

  flyTo(pos, target, dur = 1200) {
    this.flight = { t0: performance.now(), dur: motionDuration(dur, matchMedia?.("(prefers-reduced-motion: reduce)").matches),
      fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) };
  }

  _tick = () => {
    const now = performance.now(), dt = Math.min(this.clock.getDelta(), 0.05), f = this.flight;
    if (f) {
      const t = f.dur > 0 ? Math.min(1, (now - f.t0) / f.dur) : 1, k = ease(t);
      this.camera.position.lerpVectors(f.fromPos, f.pos, k); this.controls.target.lerpVectors(f.fromTarget, f.target, k);
      if (t >= 1) this.flight = null;
    }
    if (this.held.size) {
      const d = moveStep(this.held, this.camera.position.toArray(), this.controls.target.toArray(), dt);
      this.camera.position.x += d[0]; this.camera.position.z += d[2]; this.controls.target.x += d[0]; this.controls.target.z += d[2];
    }
    this.controls.update();
    const dist = this.camera.position.distanceTo(this.controls.target);
    this.camera.near = THREE.MathUtils.clamp(dist * 0.004, 0.0004, 0.1); this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const under = isUnder(this.camera.position.toArray(), (x, z) => this.elevKm(x, z));
    this.U.under.value = under ? 1 : 0; this.terrain.renderOrder = terrainOrder(under);
    this.beforeRender?.(this, now);
    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(this._tick);
  };

  dispose() {
    cancelAnimationFrame(this._raf); this._ro.disconnect();
    removeEventListener("keydown", this._onKeyDown); removeEventListener("keyup", this._onKeyUp);
    this.canvas.removeEventListener("contextmenu", this._onContext);
    this.controls.dispose(); this.renderer.dispose();
    if (window.__sim === this) delete window.__sim;
  }
}
