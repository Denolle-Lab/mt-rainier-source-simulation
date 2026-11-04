// Spherical-earth distance and azimuths (enough within 30 km: differs from the WGS84 geodesic by < 0.05 deg).
const D2R = Math.PI / 180, R_KM = 6371.0;

export function distanceKm(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dp = p2 - p1, dl = (lon2 - lon1) * D2R;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// azimuth (degrees clockwise from north) from point 1 to point 2
export function azimuth(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) / D2R) + 360) % 360;
}

// back azimuth at the receiver: azimuth from the receiver to the source
export const backAzimuth = (rec, src) => azimuth(rec.lat, rec.lon, src.lat, src.lon);

// (N, E) -> (R, T) as ObsPy rotate_ne_rt: R = -E sin(baz) - N cos(baz), T = -E cos(baz) + N sin(baz)
export function neToRt(n, e, bazDeg) {
  const s = Math.sin(bazDeg * D2R), c = Math.cos(bazDeg * D2R), r = new Float32Array(n.length), t = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) { r[i] = -e[i] * s - n[i] * c; t[i] = -e[i] * c + n[i] * s; }
  return [r, t];
}
