/**
 * Controlled routing evaluation under synthetic inundation scenarios
 * -------------------------------------------------------------------
 * Runs three routing rules on identical inputs (road graph, origins, eligible
 * shelters, prescribed depth raster) and evaluates every returned route with one
 * common rule. Standalone: does not need the RAKIT server.
 *
 *   node experiments/synthetic_routing_eval.js            (full run)
 *   node experiments/synthetic_routing_eval.js --quick    (1 timing repetition, no linear-scan check)
 *
 * All design parameters are fixed in CFG below and were set before any results
 * were inspected. Outputs are written to experiments/results/.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'results');
const QUICK = process.argv.includes('--quick');

// ───────────────────────── 0. Fixed design parameters ─────────────────────────
const CFG = {
    sampleSpacingM: 7.5,          // fixed sampling interval along each road segment (half a grid cell)
    evalDepth: 0.30,              // common evaluation rule: an edge is non-traversable if d > 0.30 m
    sensitivityEvalDepths: [0.20, 0.80],
    nOrigins: 40,
    minOriginShelterDistM: 500,
    timingReps: QUICK ? 1 : 5,
    s1: { nZones: 8, innerR: 120, outerR: 200, minSepM: 800, shelterBufferM: 400, originBufferM: 300,
          depthInner: 0.30, depthOuter: 0.10 },
    s2: { depthInner: 0.60, depthOuter: 0.30 },
    s3: { radiusM: 300, depth: 0.60 },
    s4: { nIsolated: 6, innerR: 120, outerR: 320, depth: 0.60 },
    sensitivityDepth: 0.90,       // S2b / S4b: same geometry, blocking depth raised above every method's threshold
    an: { v0: 1.6, eta: 0.9 },    // An et al. (2025), Eq. (6): walking speed (m/s) and reduction coefficient
};

// Shelters exactly as listed in public/app.js (lines 66–74).
const SHELTERS = [
    { id: 1, name: 'Stadion GBLA (Gedebage)', lat: -6.9570, lng: 107.7120 },
    { id: 2, name: 'SOR Arcamanik', lat: -6.9150, lng: 107.6710 },
    { id: 3, name: 'Kantor Kecamatan Buahbatu (Kordon)', lat: -6.9410, lng: 107.6580 },
    { id: 4, name: 'SMAN 15 Bandung (Bojonagara)', lat: -6.8940, lng: 107.5960 },
    { id: 5, name: 'SMKN 3 Bandung (Karees)', lat: -6.9240, lng: 107.6360 },
    { id: 6, name: 'UIN Sunan Gunung Djati (Ujungberung)', lat: -6.9300, lng: 107.7180 },
    { id: 7, name: 'Monumen BLA (Tegalega)', lat: -6.9360, lng: 107.6030 },
    { id: 8, name: 'Pusdai (Cibeunying)', lat: -6.9010, lng: 107.6220 },
    { id: 9, name: 'ITB Sabuga (SWK)', lat: -6.8863, lng: 107.6087 },
];

// ───────────────────────── 1. Raster geometry (same mapping as server.js) ─────────────────────────
const META = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'data', 'raster', 'dtm_bandung_wgs84.json'), 'utf8'));
const { rows: ROWS, cols: COLS } = META;
const BB = META.bounds;
// server.js getFloodDepthAt(): r = floor((N-lat)/(N-S)*ROWS), c = floor((lng-W)/(E-W)*COLS); outside -> no data
function cellIndex(lat, lng) {
    if (lat > BB.north || lat < BB.south || lng < BB.west || lng > BB.east) return -1;
    const r = Math.floor(((BB.north - lat) / (BB.north - BB.south)) * ROWS);
    const c = Math.floor(((lng - BB.west) / (BB.east - BB.west)) * COLS);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return -1;
    return r * COLS + c;
}
function cellCenter(idx) {
    const r = Math.floor(idx / COLS), c = idx % COLS;
    return { lat: BB.north - (r + 0.5) * (BB.north - BB.south) / ROWS, lng: BB.west + (c + 0.5) * (BB.east - BB.west) / COLS };
}
const LAT0 = (BB.north + BB.south) / 2;
const MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110574;
function distM(a, b) { return Math.hypot((a.lng - b.lng) * MX, (a.lat - b.lat) * MY); }
function haversineKm(lat1, lon1, lat2, lon2) { // identical to server.js
    const R = 6371, d2r = Math.PI / 180;
    const dLat = (lat2 - lat1) * d2r, dLon = (lon2 - lon1) * d2r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ───────────────────────── 2. Road graph (same construction as server.js buildGraph) ─────────────────────────
function buildGraph() {
    const gj = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'data', 'roads', 'bandung_roads_real.geojson'), 'utf8'));
    const nodes = []; const key2id = new Map();
    const nid = (lat, lng) => {
        const k = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (!key2id.has(k)) { key2id.set(k, nodes.length); nodes.push({ lat, lng }); }
        return key2id.get(k);
    };
    const undirected = []; // {a, b, km}
    for (const f of gj.features) {
        if (f.geometry.type !== 'LineString') continue; // server.js also ignores MultiLineString
        const c = f.geometry.coordinates;
        for (let i = 0; i < c.length - 1; i++) {
            const a = nid(c[i][1], c[i][0]), b = nid(c[i + 1][1], c[i + 1][0]);
            undirected.push({ a, b, km: haversineKm(c[i][1], c[i][0], c[i + 1][1], c[i + 1][0]) });
        }
    }
    return { nodes, undirected, nFeatures: gj.features.length };
}

// Fixed-interval sampling of a straight segment. Returns raster indices of
//   all  : endpoints + sub-segment midpoints (edge depth = max over these)
//   mids : sub-segment midpoints, each representing dl metres (exposure, wet length)
//   app3 : the deployed implementation's samples (two endpoints + midpoint)
function sampleSegment(A, B, km) {
    const L = km * 1000;
    const n = Math.max(1, Math.ceil(L / CFG.sampleSpacingM));
    const all = [], mids = [];
    for (let k = 0; k <= n; k++) {
        const t = k / n;
        all.push(cellIndex(A.lat + t * (B.lat - A.lat), A.lng + t * (B.lng - A.lng)));
    }
    for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const ix = cellIndex(A.lat + t * (B.lat - A.lat), A.lng + t * (B.lng - A.lng));
        mids.push(ix); all.push(ix);
    }
    const app3 = [cellIndex(A.lat, A.lng), cellIndex(B.lat, B.lng),
                  cellIndex((A.lat + B.lat) / 2, (A.lng + B.lng) / 2)];
    return { all: Int32Array.from(all), mids: Int32Array.from(mids), dl: L / n, app3: Int32Array.from(app3) };
}

// ───────────────────────── 3. Routing rules ─────────────────────────
const METHODS = {
    M1_distance: { label: 'Distance-based Dijkstra', usesDepth: false, cost: (km) => km },
    M2_proposed: { label: 'Proposed flood-aware', usesDepth: true,
        cost: (km, d) => { const p = d > 0.50 ? Infinity : d > 0.20 ? 10 : d > 0.05 ? 2 : 1; return km * p; } },
    M3_an2025: { label: 'Adapted from An et al. (2025)', usesDepth: true,
        cost: (km, d) => { // travel time (s), An et al. Eq. (6)
            const { v0, eta } = CFG.an;
            let v;
            if (d <= 0) v = v0;
            else if (d <= 0.2) v = eta * (v0 - 3.1 * d);
            else if (d <= 0.8) v = 0.5 * eta * v0;
            else return Infinity;
            return (km * 1000) / v;
        } },
};

// Binary min-heap keyed on cost (ties broken by node id for determinism).
class Heap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
        const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
        while (i > 0) { const p = (i - 1) >> 1;
            if (k[p] < key || (k[p] === key && v[p] <= val)) break;
            k[i] = k[p]; v[i] = v[p]; i = p; }
        k[i] = key; v[i] = val;
    }
    pop() {
        const k = this.k, v = this.v; const topK = k[0], topV = v[0];
        const lk = k.pop(), lv = v.pop(); const n = k.length;
        if (n > 0) { let i = 0;
            while (true) { let l = 2 * i + 1, r = l + 1, m = i, mk = lk, mv = lv;
                if (l < n && (k[l] < mk || (k[l] === mk && v[l] < mv))) { m = l; mk = k[l]; mv = v[l]; }
                if (r < n && (k[r] < mk || (k[r] === mk && v[r] < mv))) { m = r; mk = k[r]; mv = v[r]; }
                if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; }
            k[i] = lk; v[i] = lv; }
        return [topK, topV];
    }
}

function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const log = (...a) => console.log(...a);
    const t0 = Date.now();

    // ── Graph and experimental domain ──
    const G = buildGraph();
    const N = G.nodes.length;
    log(`Road graph: ${N} nodes, ${G.undirected.length * 2} directed edges (server.js construction).`);
    // Explicit no-data rule: a segment with any sample outside the raster has unknown depth and is
    // excluded from the experimental graph for every method (not treated as dry).
    const keepEdges = []; let droppedNoData = 0;
    for (const e of G.undirected) {
        const s = sampleSegment(G.nodes[e.a], G.nodes[e.b], e.km);
        if (s.all.some(ix => ix < 0)) { droppedNoData++; continue; }
        keepEdges.push({ ...e, s });
    }
    // adjacency (directed edges share their segment samples)
    const adj = Array.from({ length: N }, () => []);
    keepEdges.forEach((e, i) => { adj[e.a].push({ to: e.b, km: e.km, ei: i }); adj[e.b].push({ to: e.a, km: e.km, ei: i }); });
    // connected components on the dry domain graph
    const comp = new Int32Array(N).fill(-1); let nComp = 0; const compSize = [];
    for (let s = 0; s < N; s++) {
        if (comp[s] >= 0 || adj[s].length === 0) continue;
        const q = [s]; comp[s] = nComp; let sz = 0;
        while (q.length) { const u = q.pop(); sz++; for (const e of adj[u]) if (comp[e.to] < 0) { comp[e.to] = nComp; q.push(e.to); } }
        compSize.push(sz); nComp++;
    }
    const mainComp = compSize.indexOf(Math.max(...compSize));
    const domainNodes = [...Array(N).keys()].filter(i => adj[i].length > 0);
    const mainNodes = domainNodes.filter(i => comp[i] === mainComp);
    const snapMain = (lat, lng) => { let best = -1, bd = Infinity;
        for (const i of mainNodes) { const d = distM(G.nodes[i], { lat, lng }); if (d < bd) { bd = d; best = i; } }
        return { node: best, snapM: bd }; };

    // ── Eligible shelters (inside the raster domain), snapped to the main component ──
    const shelters = SHELTERS.map(s => {
        const inside = cellIndex(s.lat, s.lng) >= 0;
        const sn = inside ? snapMain(s.lat, s.lng) : { node: -1, snapM: null };
        return { ...s, eligible: inside, ...sn };
    });
    const elig = shelters.filter(s => s.eligible);
    const targetMap = new Map(elig.map(s => [s.node, s]));
    log(`Experimental domain: ${keepEdges.length * 2} directed edges kept, ${droppedNoData} segments dropped (no-data rule); ` +
        `${nComp} components, main = ${compSize[mainComp]} of ${domainNodes.length} nodes. Eligible shelters: ${elig.map(s => s.id).join(', ')}.`);

    // ── Origins: stratified grid, node nearest each cell centroid (deterministic) ──
    function pickOrigins() {
        for (let gc = 8, gr = 5; gc <= 16; gc++, gr = Math.round(gc * 5 / 8)) {
            const reps = [];
            for (let r = 0; r < gr; r++) for (let c = 0; c < gc; c++) {
                const lat1 = BB.north - r * (BB.north - BB.south) / gr, lat0 = lat1 - (BB.north - BB.south) / gr;
                const lng0 = BB.west + c * (BB.east - BB.west) / gc, lng1 = lng0 + (BB.east - BB.west) / gc;
                const ctr = { lat: (lat0 + lat1) / 2, lng: (lng0 + lng1) / 2 };
                let best = -1, bd = Infinity;
                for (const i of mainNodes) { const p = G.nodes[i];
                    if (p.lat < lat0 || p.lat >= lat1 || p.lng < lng0 || p.lng >= lng1) continue;
                    if (elig.some(s => distM(p, s) < CFG.minOriginShelterDistM)) continue;
                    const d = distM(p, ctr); if (d < bd) { bd = d; best = i; } }
                if (best >= 0) reps.push({ node: best, cell: `${gr}x${gc}:r${r}c${c}` });
            }
            if (reps.length >= CFG.nOrigins) {
                if (reps.length === CFG.nOrigins) return { grid: `${gc}x${gr}`, reps };
                // more populated cells than needed: farthest-point subset, seeded at the rep nearest the domain centre
                const ctr = { lat: LAT0, lng: (BB.west + BB.east) / 2 };
                const sel = [reps.reduce((b, x) => distM(G.nodes[x.node], ctr) < distM(G.nodes[b.node], ctr) ? x : b)];
                while (sel.length < CFG.nOrigins) {
                    let bx = null, bd = -1;
                    for (const x of reps) { if (sel.includes(x)) continue;
                        const d = Math.min(...sel.map(s => distM(G.nodes[s.node], G.nodes[x.node]))); if (d > bd) { bd = d; bx = x; } }
                    sel.push(bx);
                }
                sel.sort((a, b) => (G.nodes[b.node].lat - G.nodes[a.node].lat) || (G.nodes[a.node].lng - G.nodes[b.node].lng));
                return { grid: `${gc}x${gr} (farthest-point subset)`, reps: sel };
            }
        }
        throw new Error('Could not place origins');
    }
    const op = pickOrigins();
    const origins = op.reps.map((x, i) => ({ id: i + 1, node: x.node, lat: G.nodes[x.node].lat, lng: G.nodes[x.node].lng, cell: x.cell }));
    log(`Origins: ${origins.length} (grid ${op.grid}).`);

    // ── Routing core ──
    let depth = new Float64Array(ROWS * COLS); // active prescribed raster (Float64: exact comparison with thresholds)
    const edgeDepth = (s, which = 'all') => { const ix = s[which]; let m = 0; for (let j = 0; j < ix.length; j++) { const d = depth[ix[j]]; if (d > m) m = d; } return m; };

    function route(origin, method, sampling = 'all') {
        const M = METHODS[method];
        const dist = new Float64Array(N).fill(Infinity), prevE = new Int32Array(N).fill(-1), prevN = new Int32Array(N).fill(-1);
        const done = new Uint8Array(N);
        const h = new Heap(); dist[origin.node] = 0; h.push(0, origin.node);
        let target = -1;
        while (h.size) {
            const [du, u] = h.pop(); if (done[u]) continue; if (du > dist[u]) continue;
            if (targetMap.has(u)) { target = u; break; }
            done[u] = 1;
            for (const e of adj[u]) {
                if (done[e.to]) continue;
                const d = M.usesDepth ? edgeDepth(keepEdges[e.ei].s, sampling) : 0;
                const c = M.cost(e.km, d); if (!isFinite(c)) continue;
                const alt = du + c;
                if (alt < dist[e.to]) { dist[e.to] = alt; prevE[e.to] = e.ei; prevN[e.to] = u; h.push(alt, e.to); }
            }
        }
        if (target < 0) return { found: false };
        const edges = []; for (let v = target; v !== origin.node; v = prevN[v]) edges.push(prevE[v]);
        return { found: true, target, cost: dist[target], edges: edges.reverse() };
    }
    // Replica of the deployed linear-scan Dijkstra (server.js Step 7) with the same cost and sampling, for verification.
    function routeLinear(origin, method) {
        const M = METHODS[method];
        const dist = new Float64Array(N).fill(Infinity), visited = new Uint8Array(N);
        dist[origin.node] = 0; let target = -1;
        for (let i = 0; i < N; i++) {
            let u = -1, mn = Infinity; for (let j = 0; j < N; j++) if (!visited[j] && dist[j] < mn) { mn = dist[j]; u = j; }
            if (u === -1) break; if (targetMap.has(u)) { target = u; break; }
            visited[u] = 1;
            for (const e of adj[u]) { if (visited[e.to]) continue;
                const d = M.usesDepth ? edgeDepth(keepEdges[e.ei].s) : 0; const c = M.cost(e.km, d); if (!isFinite(c)) continue;
                if (dist[u] + c < dist[e.to]) dist[e.to] = dist[u] + c; }
        }
        return target < 0 ? { found: false } : { found: true, target, cost: dist[target] };
    }
    // Reference reachability under a common evaluation threshold (graph after removing edges with d > thr).
    function reachableSet(thr) {
        const ok = keepEdges.map(e => edgeDepth(e.s) <= thr);
        const seen = new Uint8Array(N); const q = [];
        for (const s of elig) { seen[s.node] = 1; q.push(s.node); }
        while (q.length) { const u = q.pop(); for (const e of adj[u]) if (ok[e.ei] && !seen[e.to]) { seen[e.to] = 1; q.push(e.to); } }
        return seen;
    }
    // Post-hoc evaluation of a returned route with the common procedure.
    function evaluate(r) {
        let km = 0, E = 0, maxD = 0, wet = 0; const unsafe = { primary: 0 };
        const over = Object.fromEntries([CFG.evalDepth, ...CFG.sensitivityEvalDepths].map(t => [t, 0]));
        for (const ei of r.edges) { const e = keepEdges[ei]; km += e.km;
            for (const ix of e.s.mids) { const d = depth[ix]; E += d * e.s.dl; if (d > 0) wet += e.s.dl; }
            const de = edgeDepth(e.s); if (de > maxD) maxD = de;
            for (const t in over) if (de > +t) over[t]++; }
        return { km, E, maxD, wet, over };
    }

    // ── Synthetic scenarios ──
    function rasterize(zones) {
        const r = new Float64Array(ROWS * COLS);
        const cellLat = (BB.north - BB.south) / ROWS, cellLng = (BB.east - BB.west) / COLS;
        for (const z of zones) {
            const R = z.outerR ?? z.r;
            const dLat = R / MY, dLng = R / MX;
            const r0 = Math.max(0, Math.floor((BB.north - (z.lat + dLat)) / cellLat)), r1 = Math.min(ROWS - 1, Math.ceil((BB.north - (z.lat - dLat)) / cellLat));
            const c0 = Math.max(0, Math.floor((z.lng - dLng - BB.west) / cellLng)), c1 = Math.min(COLS - 1, Math.ceil((z.lng + dLng - BB.west) / cellLng));
            for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
                const idx = rr * COLS + cc; const d = distM(cellCenter(idx), z);
                let v = 0;
                for (const band of z.bands) if (d > band.from && d <= band.to) v = Math.max(v, band.depth);
                if (v > r[idx]) r[idx] = v;
            }
        }
        return r;
    }
    const zone = (id, lat, lng, bands, note) => ({ id, lat, lng, bands, outerR: Math.max(...bands.map(b => b.to)), note });

    // S0 baseline routes (distance-based) define corridor usage for S1 and the busiest shelter for S3.
    depth = new Float64Array(ROWS * COLS);
    const s0 = origins.map(o => route(o, 'M1_distance'));
    const usage = new Map();
    s0.forEach(r => r.found && r.edges.forEach(ei => usage.set(ei, (usage.get(ei) || 0) + 1)));
    const mid = ei => { const e = keepEdges[ei]; const A = G.nodes[e.a], B = G.nodes[e.b]; return { lat: (A.lat + B.lat) / 2, lng: (A.lng + B.lng) / 2 }; };
    const hot = [...usage.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const s1Centers = [];
    for (const [ei, n] of hot) {
        if (s1Centers.length >= CFG.s1.nZones) break;
        const m = mid(ei);
        if (elig.some(s => distM(m, s) < CFG.s1.shelterBufferM)) continue;
        if (origins.some(o => distM(m, o) < CFG.s1.originBufferM)) continue;
        if (s1Centers.some(c => distM(m, c) < CFG.s1.minSepM)) continue;
        s1Centers.push({ ...m, edge: ei, uses: n });
    }
    const corridorZones = (inner, outer) => s1Centers.map((c, i) => zone(`C${i + 1}`, c.lat, c.lng,
        [{ from: -1, to: CFG.s1.innerR, depth: inner }, { from: CFG.s1.innerR, to: CFG.s1.outerR, depth: outer }],
        `corridor on S0 edge used by ${c.uses} of ${origins.length} baseline routes`));
    const selCount = new Map(); s0.forEach(r => r.found && selCount.set(r.target, (selCount.get(r.target) || 0) + 1));
    const s3Node = [...selCount.entries()].sort((a, b) => b[1] - a[1] || targetMap.get(a[0]).id - targetMap.get(b[0]).id)[0][0];
    const s3Shelter = targetMap.get(s3Node);
    const isoIds = []; // predefined rule: ids round((k-0.5)*40/6), skipping any whose ring would contain a shelter
    for (let k = 1, cand = 0; isoIds.length < CFG.s4.nIsolated && k <= 40; k++) {
        cand = Math.round((k - 0.5) * origins.length / CFG.s4.nIsolated);
        if (isoIds.length >= k) continue;
        let id = cand; while (id <= origins.length && (isoIds.includes(id) || elig.some(s => distM(origins[id - 1], s) <= CFG.s4.outerR + 50))) id++;
        if (id <= origins.length) isoIds.push(id);
    }
    const ringZones = (dep) => isoIds.map(id => { const o = origins[id - 1];
        return zone(`R${id}`, o.lat, o.lng, [{ from: CFG.s4.innerR, to: CFG.s4.outerR, depth: dep }], `ring around origin ${id}`); });
    const shelterZone = (dep) => [zone(`SH${s3Shelter.id}`, s3Shelter.lat, s3Shelter.lng, [{ from: -1, to: CFG.s3.radiusM, depth: dep }],
        `disk around shelter ${s3Shelter.id} (${s3Shelter.name}), most selected in S0`)];

    const SCEN = [
        { id: 'S0', name: 'No inundation', zones: [] },
        { id: 'S1', name: 'Corridor inundation (passable)', zones: corridorZones(CFG.s1.depthInner, CFG.s1.depthOuter) },
        { id: 'S2', name: 'Corridors made impassable', zones: corridorZones(CFG.s2.depthInner, CFG.s2.depthOuter) },
        { id: 'S3', name: 'Shelter access cut', zones: shelterZone(CFG.s3.depth) },
        { id: 'S4', name: 'Controlled isolation', zones: ringZones(CFG.s4.depth) },
        { id: 'S2b', name: 'S2 with 0.90 m blocking depth (sensitivity)', zones: corridorZones(CFG.sensitivityDepth, CFG.s2.depthOuter), sensitivity: true },
        { id: 'S4b', name: 'S4 with 0.90 m blocking depth (sensitivity)', zones: ringZones(CFG.sensitivityDepth), sensitivity: true },
    ];
    const rasters = {};
    for (const S of SCEN) { rasters[S.id] = rasterize(S.zones); S.wetCells = rasters[S.id].reduce((n, v) => n + (v > 0), 0); }

    fs.writeFileSync(path.join(OUT, 'design.json'), JSON.stringify({
        cfg: CFG, raster: { rows: ROWS, cols: COLS, bounds: BB, mapping: 'server.js getFloodDepthAt (bounds-proportional)' },
        graph: { nodes: N, directedEdges: G.undirected.length * 2, domainDirectedEdges: keepEdges.length * 2, droppedNoDataSegments: droppedNoData,
                 components: nComp, mainComponentNodes: compSize[mainComp], domainNodes: domainNodes.length },
        shelters, origins, originGrid: op.grid, s3Shelter: s3Shelter.id, isolatedOrigins: isoIds,
        scenarios: SCEN.map(S => ({ id: S.id, name: S.name, sensitivity: !!S.sensitivity, wetCells: S.wetCells, zones: S.zones })),
    }, null, 1));
    log(`Scenarios defined. S1 corridor zones: ${s1Centers.length}; S3 shelter: ${s3Shelter.id} ${s3Shelter.name}; S4 isolated origins: ${isoIds.join(', ')}.`);

    // ── Runs ──
    const rows = []; const verify = []; const sampleCheck = [];
    // JIT warm-up (untimed)
    depth = rasters.S1; for (const m of Object.keys(METHODS)) for (let i = 0; i < 3; i++) route(origins[i], m);

    for (const S of SCEN) {
        depth = rasters[S.id];
        const ref = Object.fromEntries([CFG.evalDepth, ...CFG.sensitivityEvalDepths].map(t => [t, reachableSet(t)]));
        // effect of the deployed 3-point sampling vs fixed-interval sampling on edge depth
        let diffEdges = 0, wetEdges = 0;
        for (const e of keepEdges) { const a = edgeDepth(e.s), b = edgeDepth(e.s, 'app3'); if (a > 0 || b > 0) wetEdges++; if (a !== b) diffEdges++; }
        for (const o of origins) {
            for (const m of Object.keys(METHODS)) {
                const times = []; let r;
                for (let k = 0; k < CFG.timingReps; k++) {
                    const t1 = process.hrtime.bigint(); r = route(o, m); const t2 = process.hrtime.bigint();
                    times.push(Number(t2 - t1) / 1e6);
                }
                times.sort((a, b) => a - b);
                const row = { scenario: S.id, sensitivity: !!S.sensitivity, origin: o.id, method: m,
                    returned: r.found, diagnostic: r.found ? '' : (comp[o.node] === mainComp ? 'FLOOD_ISOLATION' : 'NETWORK_DISCONNECTION'),
                    shelter: r.found ? targetMap.get(r.target).id : '', cost: r.found ? +r.cost.toFixed(4) : '',
                    query_ms_median: +times[Math.floor(times.length / 2)].toFixed(3), query_ms_all: times.map(t => t.toFixed(3)).join(';') };
                for (const t of [CFG.evalDepth, ...CFG.sensitivityEvalDepths]) row[`ref_reachable_${t}`] = !!ref[t][o.node];
                if (r.found) {
                    const ev = evaluate(r);
                    Object.assign(row, { length_km: +ev.km.toFixed(4), exposure_m2: +ev.E.toFixed(3), max_depth_m: +ev.maxD.toFixed(3), wet_length_m: +ev.wet.toFixed(1), edges: r.edges.length });
                    for (const t of [CFG.evalDepth, ...CFG.sensitivityEvalDepths]) { row[`unsafe_edges_${t}`] = ev.over[t]; row[`traversable_${t}`] = ev.over[t] === 0; }
                } else {
                    for (const t of [CFG.evalDepth, ...CFG.sensitivityEvalDepths]) row[`traversable_${t}`] = false;
                }
                rows.push(row);
                if (m === 'M2_proposed') {
                    const r3 = route(o, m, 'app3');
                    sampleCheck.push({ scenario: S.id, origin: o.id, same_found: r3.found === r.found,
                        cost_fixed: r.found ? r.cost : null, cost_app3: r3.found ? r3.cost : null, same_shelter: r3.found && r.found ? r3.target === r.target : r3.found === r.found });
                    if (!QUICK && !S.sensitivity) {
                        const t1 = process.hrtime.bigint(); const rl = routeLinear(o, m); const t2 = process.hrtime.bigint();
                        verify.push({ scenario: S.id, origin: o.id, heap_found: r.found, linear_found: rl.found,
                            heap_cost: r.found ? r.cost : null, linear_cost: rl.found ? rl.cost : null,
                            equal: r.found === rl.found && (!r.found || Math.abs(r.cost - rl.cost) < 1e-9),
                            heap_ms: row.query_ms_median, linear_ms: +(Number(t2 - t1) / 1e6).toFixed(1) });
                    }
                }
            }
        }
        S.sampling = { wetEdges, diffEdges };
        log(`${S.id} done (${((Date.now() - t0) / 1000).toFixed(0)} s): wet cells ${S.wetCells}, ref reachable@${CFG.evalDepth} ` +
            `${origins.filter(o => ref[CFG.evalDepth][o.node]).length}/${origins.length}; edges whose depth differs under 3-point sampling: ${diffEdges}/${wetEdges}`);
    }

    // ── Write outputs ──
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => r[c] ?? '').join(','))).join('\n');
    fs.writeFileSync(path.join(OUT, QUICK ? 'runs_quick.csv' : 'runs.csv'), csv);
    fs.writeFileSync(path.join(OUT, QUICK ? 'checks_quick.json' : 'checks.json'), JSON.stringify({
        sampling: SCEN.map(S => ({ id: S.id, ...S.sampling })), sampleCheck, verify }, null, 1));
    // scenario rasters (Float32, row-major, ROWS x COLS) for figures / reuse
    if (!QUICK) { const rd = path.join(OUT, 'rasters'); fs.mkdirSync(rd, { recursive: true });
        for (const S of SCEN) fs.writeFileSync(path.join(rd, `${S.id}.bin`), Buffer.from(Float32Array.from(rasters[S.id]).buffer)); }
    log(`Finished in ${((Date.now() - t0) / 1000).toFixed(0)} s. ${rows.length} runs written.`);
}

main();
