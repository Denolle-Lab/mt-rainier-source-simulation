// Velocity structure of the GF comparison models below ground (scene/velocityVolume.js): model A, model B or their
// difference, Vp or Vs, on a vertical section where the terrain is cut away and on a horizontal depth slice.
// Adapted from the Mount Rainier Seismic Atlas viewer (Denolle-Lab/mt-rainier-digital-model, web/viewer/site/src/ui/
// SubsurfacePanel.jsx; MIT, Derek Yao; see THIRD_PARTY_NOTICES.md).
import { useEffect, useState } from "react";
import { Seg } from "./Seg.jsx";

const DIFF_PCT = 10;
const SHOW = [["off", "Off"], ["A", "A"], ["B", "B"], ["diff", "A / B − 1"]];

export function VelocityPanel({ volume, scene, vol, modelA, modelB }) {
  const [show, setShow] = useState("off"), [key, setKey] = useState("vs");
  const [section, setSection] = useState(true), [slice, setSlice] = useState(false);
  const [km, setKm] = useState(0), [cut, setCut] = useState({ angle: 90, offset: 0 });
  const on = show !== "off";

  useEffect(() => {
    volume.set(on ? { key, a: show === "B" ? modelB : modelA, b: show === "diff" ? modelB : null, diffPct: DIFF_PCT } : null);
  }, [volume, on, show, key, modelA, modelB]);
  useEffect(() => {
    scene.setCut({ on: on && section, ...cut }); volume.setSection(on && section);
  }, [scene, volume, on, section, cut]);
  useEffect(() => { volume.setSlice(on && slice, km); }, [volume, on, slice, km]);
  useEffect(() => () => scene.setCut({ on: false, angle: 0, offset: 0 }), [scene]);

  const v = vol.vars[key], [lo, hi] = v.range;
  const ticks = show === "diff" ? [`≤ −${DIFF_PCT}`, "0", `≥ +${DIFF_PCT}`] : [`≤ ${lo.toFixed(1)}`, ((lo + hi) / 2).toFixed(2), `≥ ${hi.toFixed(1)}`];
  return (
    <section className="velpanel">
      <h2>Velocity structure</h2>
      <Seg label="Velocity model shown" value={show} options={SHOW} onChange={setShow} />
      {on && (
        <>
          <Seg label="Velocity" value={key} options={Object.entries(vol.vars).map(([k, x]) => [k, x.label])} onChange={setKey} />
          <label className="check"><input type="checkbox" checked={section} onChange={e => setSection(e.target.checked)} /> Section where the terrain is cut</label>
          {section && (
            <>
              <label className="field"><span className="flabel">Direction</span>
                <input type="range" min={0} max={359} value={cut.angle} aria-label="Section direction"
                  onChange={e => setCut({ ...cut, angle: Number(e.target.value) })} /><span className="mono">{cut.angle}°</span></label>
              <label className="field"><span className="flabel">Position</span>
                <input type="range" min={-14} max={14} step={0.25} value={cut.offset} aria-label="Section position"
                  onChange={e => setCut({ ...cut, offset: Number(e.target.value) })} /><span className="mono">{cut.offset.toFixed(2)} km</span></label>
            </>
          )}
          <label className="check"><input type="checkbox" checked={slice} onChange={e => setSlice(e.target.checked)} /> Depth slice</label>
          {slice && (
            <label className="field"><span className="flabel">Elevation</span>
              <input type="range" min={-10} max={4} step={0.1} value={km} aria-label="Slice elevation"
                onChange={e => setKm(Number(e.target.value))} /><span className="mono">{km.toFixed(1)} km</span></label>
          )}
          <div className="vlegend">
            <i className={show === "diff" ? "grad diff" : "grad roma"} />
            <div className="vticks">{ticks.map(t => <span key={t}>{t}</span>)}</div>
            <div className="vlabel">{show === "diff" ? `${v.label} A / B − 1 (%)` : `${v.label} (km/s), model ${show}`}</div>
          </div>
        </>
      )}
    </section>
  );
}
