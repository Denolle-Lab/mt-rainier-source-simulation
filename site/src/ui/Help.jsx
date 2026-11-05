export function Help({ onClose, index }) {
  return (
    <div className="help" role="dialog" aria-label="About">
      <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
      <h2>About</h2>
      <p>Synthetic seismograms at the UW, CC and Z5 seismometers around Mount Rainier for a source you choose: a moment
        tensor or a force, its size and its time function. The waveforms are computed in your browser from precomputed
        3D Green&apos;s functions (SPECFEM3D, topography and a 3D velocity model, 28 × 28 km mesh resolving 10 Hz).</p>
      <h3>Use</h3>
      <ul>
        <li>Pick the source point in <b>Location</b>; set the source and the time function; the waveforms update at once.</li>
        <li>▶ plays the ground motion: each receiver is colored by its vertical motion; the record section shows the time.</li>
        <li>Click a receiver (map or record section) for its three components.</li>
        <li><b>Time</b> in the legend sets the time window of the record section and the playback.</li>
        <li><b>Surface</b> (off by default) colors the ground near the receivers by their vertical motion during playback, or by the peak
          amplitude (three components, time window, log scale). It is interpolated between the receivers, not a computed wavefield.</li>
        <li><b>Stations</b> (panel): sort by a column header; a checkbox hides or shows a receiver in the record section;
          drag over the checkboxes to set several consecutive rows at once.</li>
        <li><b>GF comparison</b> (database menu): one source point, the hypocenter of event 62134192, in several velocity
          models. Model B is drawn in purple over model A; the selected receiver shows the correlation (CC) and the peak ratio
          B / A of each component. <b>Velocity structure</b> shows Vp or Vs of A or B, or A / B − 1, on a section where the
          terrain is cut away (direction, position) and on a depth slice.</li>
        <li>Drag to move, right-drag or Ctrl-drag to rotate, scroll to zoom. The slider in the legend makes the ground see-through.</li>
      </ul>
      <h3>Accuracy</h3>
      <p>{index?.reliability_note} The database is low-passed at {index?.f_lowpass_hz} Hz.</p>
      <h3>Credits</h3>
      <p>Terrain and imagery: USGS 3DEP and The National Map (public domain), via the Mount Rainier Seismic Atlas.
        3D terrain rendering adapted from the Seismic Atlas viewer (Derek Yao, MIT). Code:
        {" "}<a href="https://github.com/Denolle-Lab/mt-rainier-source-simulation" target="_blank" rel="noreferrer">Denolle-Lab/mt-rainier-source-simulation</a>.</p>
    </div>
  );
}
