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
