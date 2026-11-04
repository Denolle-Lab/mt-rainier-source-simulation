import { Beachball, StfPlot } from "./plots.jsx";
import { StationTable } from "./StationTable.jsx";
import { OUTPUT, engineSource, supports } from "../sim/model.js";

function Slider({ label, value, min, max, step, onChange, fmt = v => v, log = false, unit = "" }) {
  const toS = v => (log ? Math.log10(v) : v), fromS = s => (log ? 10 ** s : s);
  return (
    <label className="field">
      <span className="flabel">{label}</span>
      <input type="range" min={toS(min)} max={toS(max)} step={step} value={toS(value)}
        onChange={e => onChange(fromS(Number(e.target.value)))} />
      <input type="number" className="num" value={fmt(value)} step="any"
        onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); }} />
      <span className="unit">{unit}</span>
    </label>
  );
}

function Seg({ value, options, onChange, disabled = {} }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? "on" : ""}
          disabled={!!disabled[k]} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

const r2 = v => Math.round(v * 100) / 100;
const STF_OPTIONS = {
  mt: [["brune", "Brune"], ["halfsine", "Half-sine"], ["step", "Step"]],
  force: [["pulse", "Pulse"], ["brune", "Smooth step"], ["step", "Step"]],
};
const BANDS = [["full", "≤ 10 Hz"], ["1-5", "1–5 Hz"], ["0.5-2.5", "0.5–2.5 Hz"], ["0.1-1", "0.1–1 Hz"]];
const bandKey = b => (b.fmin == null && b.fmax == null ? "full" : `${b.fmin}-${b.fmax}`);

export function SourcePanel({ db, ps, pointIdx, setPointIdx, mode, setMode, setLevel, click, src, setSrc, stf, setStf, view, setView, geo, off, setOff }) {
  const points = db.index.points, p = points[pointIdx], labeled = points.flatMap((q, i) => (q.label ? [i] : [])), elements = db.index.kinds[p.kind].elements, fRel = db.index.f_reliable_hz;
  const canMT = supports(elements, "mt"), canF = supports(elements, "force");
  const set = patch => setSrc({ ...src, ...patch });
  const st = stf[src.kind], setSt = patch => setStf({ ...stf, [src.kind]: { ...st, ...patch } });
  const corner = st.kind === "brune" ? st.fc : st.kind === "step" ? Infinity : 1 / st.T;
  const above = (view.band.fmax ?? db.index.f_lowpass_hz) > fRel && corner > fRel;
  const m = src.kind === "mt" ? engineSource(src).m : null;
  return (
    <aside className="panel" aria-label="Source">
      <section>
        <h2>Location</h2>
        <Seg value={mode} options={[["surface", "On the surface"], ["below", "Below the surface"]]} onChange={setMode}
          disabled={{ surface: !ps.surface.length, below: !ps.below.length }} />
        {mode === "below" && ps.levels.length > 1 && (
          <label className="field level"><span className="flabel">Level</span>
            <select value={p.elev_m} onChange={e => setLevel(Number(e.target.value))} aria-label="Elevation level">
              {ps.levels.map(l => <option key={l} value={l}>{(l / 1000).toFixed(3)} km above sea level</option>)}
            </select>
          </label>
        )}
        <p className="hint">Click the map: the source moves to the nearest {mode === "surface" ? "surface point (250 m grid)" : "point on this level"}.</p>
        {labeled.length > 0 && (
          <select value={labeled.includes(pointIdx) ? pointIdx : ""} aria-label="Labeled points"
            onChange={e => e.target.value !== "" && setPointIdx(Number(e.target.value))}>
            <option value="">Labeled points…</option>
            {labeled.map(i => <option key={i} value={i}>{points[i].label}</option>)}
          </select>
        )}
        <dl className="facts">
          <dt>Lat, lon</dt><dd>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</dd>
          <dt>Elevation</dt><dd>{(p.elev_m / 1000).toFixed(2)} km</dd>
          <dt>Below surface</dt><dd>{(p.burial_m / 1000).toFixed(2)} km</dd>
          {click && <><dt>Snapped</dt><dd>{(click.offset * 1000).toFixed(0)} m from the click</dd></>}
        </dl>
      </section>
      <section>
        <h2>Source</h2>
        <Seg value={src.kind} options={[["mt", "Moment tensor"], ["force", "Force"]]} onChange={k => set({ kind: k })}
          disabled={{ mt: !canMT, force: !canF }} />
        {src.kind === "mt" ? (
          <>
            <Seg value={src.mode} options={[["sdr", "Strike / dip / rake"], ["tensor", "Six components"]]} onChange={k => set({ mode: k })} />
            <div className="mtrow">
              <div className="mtinputs">
                {src.mode === "sdr" ? (
                  <>
                    <Slider label="Strike" value={src.strike} min={0} max={360} step={1} unit="°" onChange={v => set({ strike: v })} />
                    <Slider label="Dip" value={src.dip} min={0} max={90} step={1} unit="°" onChange={v => set({ dip: v })} />
                    <Slider label="Rake" value={src.rake} min={-180} max={180} step={1} unit="°" onChange={v => set({ rake: v })} />
                  </>
                ) : (
                  <div className="tensor">
                    {["Mrr", "Mtt", "Mpp", "Mrt", "Mrp", "Mtp"].map((n, i) => (
                      <label key={n}><span>{n}</span>
                        <input type="number" step="any" value={src.tensor[i]}
                          onChange={e => { const t = [...src.tensor]; t[i] = Number(e.target.value) || 0; set({ tensor: t }); }} />
                      </label>
                    ))}
                  </div>
                )}
                <Slider label="Mw" value={src.mw} min={-1} max={4} step={0.01} fmt={r2} onChange={v => set({ mw: v })} />
              </div>
              <Beachball m={m} />
            </div>
          </>
        ) : (
          <>
            <Slider label="Force" value={src.force.log10N} min={5} max={12} step={0.1} fmt={r2} unit="log₁₀ N"
              onChange={v => set({ force: { ...src.force, log10N: v } })} />
            <Slider label="Azimuth" value={src.force.az} min={0} max={360} step={1} unit="°" onChange={v => set({ force: { ...src.force, az: v } })} />
            <Slider label="Plunge" value={src.force.plunge} min={-90} max={90} step={1} unit="°" onChange={v => set({ force: { ...src.force, plunge: v } })} />
          </>
        )}
      </section>
      <section>
        <h2>Time function</h2>
        <Seg value={st.kind} options={STF_OPTIONS[src.kind]} onChange={k => setSt({ kind: k })} />
        {st.kind === "brune" && <Slider label="fc" value={st.fc} min={0.1} max={10} step={0.01} log fmt={r2} unit="Hz" onChange={v => setSt({ fc: v })} />}
        {(st.kind === "halfsine" || st.kind === "pulse") && <Slider label="Duration" value={st.T} min={0.05} max={10} step={0.01} log fmt={r2} unit="s" onChange={v => setSt({ T: v })} />}
        <StfPlot stf={st} isForce={src.kind === "force"} />
      </section>
      {geo && <StationTable receivers={db.index.receivers} geo={geo} off={off} setOff={setOff} />}
      <section>
        <h2>View</h2>
        <Seg value={view.output} options={OUTPUT.map(o => [o.key, o.label])} onChange={k => setView({ ...view, output: k })} />
        <Seg value={bandKey(view.band)} options={BANDS} onChange={k => setView({ ...view,
          band: k === "full" ? { fmin: null, fmax: null } : { fmin: Number(k.split("-")[0]), fmax: Number(k.split("-")[1]) } })} />
        <Seg value={view.comps} options={[["ZNE", "Z N E"], ["ZRT", "Z R T"]]} onChange={k => setView({ ...view, comps: k })} />
        <Seg value={view.norm} options={[["trace", "Each trace"], ["common", "Common scale"]]} onChange={k => setView({ ...view, norm: k })} />
        {above && <p className="note">Frequencies above ~{fRel} Hz are included. There the 10 Hz mesh differs from a 20 Hz mesh by up to ~30 %; use the 0.5–2.5 Hz band for the most reliable waveforms.</p>}
      </section>
    </aside>
  );
}
