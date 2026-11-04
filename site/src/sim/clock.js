// Playback clock shared by the scene, the waveform cursor and the timeline (outside React state, so playing does
// not re-render the app every frame).
export class Clock {
  constructor(t0 = 0, t1 = 1) { this.t0 = t0; this.t1 = t1; this.t = t0; this.playing = false; this.speed = 1; this._ls = new Set(); this._last = null; }
  on(f) { this._ls.add(f); return () => this._ls.delete(f); }
  _emit() { for (const f of this._ls) f(this); }
  set(t) { this.t = Math.min(this.t1, Math.max(this.t0, t)); this._emit(); }
  setRange(t0, t1) { this.t0 = t0; this.t1 = t1; this.set(this.t); }
  play() { if (this.t >= this.t1) this.t = this.t0; this.playing = true; this._last = null; this._emit(); }
  pause() { this.playing = false; this._emit(); }
  // called every animation frame with performance.now()
  tick(now) {
    if (!this.playing) { this._last = null; return; }
    if (this._last != null) {
      this.t += ((now - this._last) / 1000) * this.speed;
      if (this.t >= this.t1) { this.t = this.t1; this.playing = false; }
      this._emit();
    }
    this._last = now;
  }
}
