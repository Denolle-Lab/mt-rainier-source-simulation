import { useEffect, useMemo, useRef, useState } from "react";
import { loadConfig, loadDatabase, loadTerrain } from "./data/bundle.js";
import { loadPoint } from "./engine/gfdb.js";
import { elementWeights } from "./engine/source.js";
import { Synthesizer } from "./engine/synth.js";
import { SimScene } from "./scene/SimScene.js";
import { toX, toZ } from "./scene/geo.js";
import { Receivers, SourceGlyph, domainBox } from "./scene/overlays.js";
import { Clock } from "./sim/clock.js";
import { DEFAULT_SOURCE, DEFAULT_STF, DEFAULT_VIEW, OUTPUT, engineSource, receiverGeometry, rotateTraces, supports } from "./sim/model.js";
import { SourcePanel } from "./ui/SourcePanel.jsx";
import { Timeline } from "./ui/Timeline.jsx";
import { Waveforms } from "./ui/Waveforms.jsx";
import { Help } from "./ui/Help.jsx";

export default function App() {
  const [err, setErr] = useState(null);
  const [db, setDb] = useState(null), [terrain, setTerrain] = useState(null);
  const [pointIdx, setPointIdx] = useState(null), [point, setPoint] = useState(null), [loading, setLoading] = useState(true);
  const [src, setSrc] = useState(DEFAULT_SOURCE), [stf, setStf] = useState(DEFAULT_STF), [view, setView] = useState(DEFAULT_VIEW);
  const [selected, setSelected] = useState(null), [sceneReady, setSceneReady] = useState(false), [help, setHelp] = useState(false);
  const [see, setSee] = useState(0);
  const canvasRef = useRef(null), sceneRef = useRef(null), ovRef = useRef(null), labelRef = useRef(null), selRef = useRef(null);
  const clock = useMemo(() => new Clock(), []);

  useEffect(() => {
    loadConfig().then(async c => {
      const [t, d] = await Promise.all([loadTerrain(c.scene), loadDatabase(c.databases[0])]);
      setTerrain(t); setDb(d);
      setPointIdx(Math.max(0, d.index.points.findIndex(p => p.default)));
    }).catch(setErr);
  }, []);

  // scene and overlays
  useEffect(() => {
    if (!terrain || !db) return undefined;
    let sc = null, gone = false;
    SimScene.create(canvasRef.current, terrain).then(s => {
      if (gone) { s.dispose(); return; }
      sc = sceneRef.current = s;
      const elev = (x, z) => s.elevKm(x, z), rec = new Receivers(db.index.receivers, elev), glyph = new SourceGlyph();
      s.overlays.add(domainBox(db.index.mesh, elev), rec.group, glyph.group);
      ovRef.current = { rec, glyph };
      s.beforeRender = (_, now) => {
        clock.tick(now);
        const el = labelRef.current, i = selRef.current;
        if (el) {
          if (i == null) el.style.display = "none";
          else { const [x, y, z] = rec.pos[i], [px, py, d] = s.project(x, y + 0.35, z); el.style.display = d < 1 ? "block" : "none"; el.style.transform = `translate(${px}px, ${py}px)`; }
        }
      };
      setSceneReady(true);
    }).catch(setErr);
    return () => { gone = true; sc?.dispose(); ovRef.current = null; setSceneReady(false); };
  }, [terrain, db, clock]);

  // source point: download and transform once
  useEffect(() => {
    if (!db || pointIdx == null) return;
    const p = db.index.points[pointIdx];
    setLoading(true);
    loadPoint(db.url, db.index, p).then(pt => {
      const syn = new Synthesizer(db.index); syn.setPoint(pt);
      setPoint({ p, pt, syn });
      setSrc(s => (supports(pt.elements, s.kind) ? s : { ...s, kind: s.kind === "mt" ? "force" : "mt" }));
    }).catch(setErr).finally(() => setLoading(false));
  }, [db, pointIdx]);

  const npts = db?.index.npts, t0 = db?.index.t0, dt = db?.index.dt;
  const result = useMemo(() => {
    if (!point || !supports(point.pt.elements, src.kind)) return null;
    const es = engineSource(src), w = elementWeights(point.pt.elements, es);
    const tr = point.syn.run(w, stf[src.kind], view.output, view.band);
    const { geo, order } = receiverGeometry(db.index.receivers, point.p);
    return { es, geo, order, traces: rotateTraces(tr, db.index.receivers.length, npts, geo, view.comps) };
  }, [point, src, stf, view, db, npts]);

  useEffect(() => { if (db) clock.setRange(t0, t0 + (npts - 1) * dt); }, [db, clock, t0, npts, dt]);

  // source glyph
  useEffect(() => {
    if (!sceneReady || !result) return;
    const p = point.p;
    ovRef.current.glyph.set(p, sceneRef.current.elevKm(toX(p.lon), toZ(p.lat)), result.es);
  }, [sceneReady, result, point]);

  // receivers follow the playback time: vertical (Z) motion, each receiver scaled by its own peak ("Each trace")
  // or all by the largest peak with a square-root amplitude ("Common scale")
  useEffect(() => {
    if (!sceneReady || !result) return undefined;
    const { rec } = ovRef.current, nrec = db.index.receivers.length, tr = result.traces, vals = new Float32Array(nrec);
    const peak = new Float32Array(nrec);
    for (let r = 0; r < nrec; r++) for (let i = 0; i < npts; i++) peak[r] = Math.max(peak[r], Math.abs(tr[r * 3 * npts + i]));
    const gmax = Math.max(...peak), common = view.norm === "common";
    const f = c => {
      const i = Math.round((c.t - t0) / dt);
      if (i < 0 || i >= npts || !gmax) { rec.setValues(null); return; }
      for (let r = 0; r < nrec; r++) {
        const v = tr[r * 3 * npts + i] / (common ? gmax : peak[r] || 1);
        vals[r] = common ? Math.sign(v) * Math.sqrt(Math.abs(v)) : v;
      }
      rec.setValues(vals);
    };
    f(clock); return clock.on(f);
  }, [sceneReady, result, clock, db, npts, t0, dt, view.norm]);

  useEffect(() => { selRef.current = selected; ovRef.current?.rec.select(selected); }, [selected, sceneReady]);
  useEffect(() => { sceneRef.current?.setSeeThrough(see); }, [see, sceneReady]);

  // click (not drag) on the scene: pick a receiver
  const down = useRef(null);
  const onPointerDown = e => { down.current = [e.clientX, e.clientY]; };
  const onPointerUp = e => {
    const d = down.current; down.current = null;
    if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 4 || !sceneRef.current) return;
    const hit = sceneRef.current.pickAt(e.clientX, e.clientY);
    if (hit?.type === "receiver") setSelected(hit.index);
  };

  if (err) return <div className="fatal"><h1>Mount Rainier Source Simulator</h1><p>Could not load: {String(err.message ?? err)}</p></div>;
  const out = OUTPUT[view.output];
  return (
    <div className="app">
      <header>
        <h1>Mount Rainier Source Simulator</h1>
        <span className="dbinfo">{db ? db.index.description : "Loading…"}</span>
        <button type="button" className="helpbtn" onClick={() => setHelp(h => !h)} aria-expanded={help}>?</button>
      </header>
      <main className="stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <canvas ref={canvasRef} aria-label="3D view of Mount Rainier with the source and the receivers" />
        <div ref={labelRef} className="slabel">{selected != null && db ? `${db.index.receivers[selected].net}.${db.index.receivers[selected].sta}` : ""}</div>
        <div className="legend">
          <span><i className="dot uw" /> UW / CC</span><span><i className="dot z5" /> Z5</span>
          <span><i className="bar" /> vertical {out.label.toLowerCase()} (up red, down blue)</span>
          <label>Ground <input type="range" min={0} max={90} value={see} onChange={e => setSee(Number(e.target.value))} aria-label="See-through ground" /></label>
        </div>
        {(loading || !sceneReady) && <div className="busy">Loading…</div>}
        <Timeline clock={clock} />
        {help && <Help onClose={() => setHelp(false)} index={db?.index} />}
      </main>
      {db && point && (
        <SourcePanel db={db} points={db.index.points} pointIdx={pointIdx} setPointIdx={setPointIdx}
          src={src} setSrc={setSrc} stf={stf} setStf={setStf} view={view} setView={setView} />
      )}
      <footer>
        {result && (
          <Waveforms traces={result.traces} npts={npts} t0={t0} dt={dt} order={result.order} geo={result.geo}
            receivers={db.index.receivers} comps={view.comps.split("")} norm={view.norm} unit={out.unit}
            clock={clock} selected={selected} onSelect={setSelected} />
        )}
      </footer>
    </div>
  );
}
