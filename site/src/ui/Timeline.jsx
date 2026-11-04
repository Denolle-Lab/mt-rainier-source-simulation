import { useEffect, useState } from "react";

export function Timeline({ clock }) {
  const [, force] = useState(0);
  useEffect(() => {
    let last = 0;
    return clock.on(c => { const now = performance.now(); if (!c.playing || now - last > 60) { last = now; force(x => x + 1); } });
  }, [clock]);
  return (
    <div className="timeline">
      <button type="button" className="play" onClick={() => (clock.playing ? clock.pause() : clock.play())}
        aria-label={clock.playing ? "Pause" : "Play"}>{clock.playing ? "❚❚" : "▶"}</button>
      <input type="range" min={clock.t0} max={clock.t1} step={0.01} value={clock.t} aria-label="Time"
        onChange={e => { clock.pause(); clock.set(Number(e.target.value)); }} />
      <span className="tnum">{clock.t.toFixed(2)} s</span>
      <select value={clock.speed} aria-label="Playback speed" onChange={e => { clock.speed = Number(e.target.value); force(x => x + 1); }}>
        {[0.25, 0.5, 1, 2].map(s => <option key={s} value={s}>×{s}</option>)}
      </select>
    </div>
  );
}

// two-handle slider for the time window [start, end] (s) of the record section and the playback, at least minSpan long
export function TimeRange({ min, max, step, value: [a, b], onChange, minSpan = 1 }) {
  const pct = v => ((v - min) / (max - min)) * 100;
  return (
    <span className="twin">Time
      <span className="trange">
        <span className="track" /><span className="fill" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        <input type="range" min={min} max={max} step={step} value={a} aria-label="Window start"
          onChange={e => onChange([Math.min(Number(e.target.value), b - minSpan), b])} />
        <input type="range" min={min} max={max} step={step} value={b} aria-label="Window end"
          onChange={e => onChange([a, Math.max(Number(e.target.value), a + minSpan)])} />
      </span>
      <span className="tval">{a.toFixed(1)} to {b.toFixed(1)} s</span>
    </span>
  );
}
