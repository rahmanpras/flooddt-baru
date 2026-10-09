/**
 * Robustness of routing-rule rankings across mode-specific hazard and closure criteria
 * ------------------------------------------------------------------------------------
 * Reuses the controlled routing evaluation (synthetic_routing_eval.js): same road graph, no-data rule,
 * 40 origins, eligible shelters, and scenario geometry (read from results/design.json). Two things vary:
 *
 *   1. The hazard criterion, taken per travel mode from an external guideline instead of being chosen by
 *      the authors. Depth-only limits of the flood hazard vulnerability classes in Australian Institute for
 *      Disaster Resilience (AIDR) Guideline 7-3 (2017), assuming low flow velocity (the synthetic fields
 *      prescribe depth only):
 *        SV  small vehicles (cars; motorcycles assigned here)   d <= 0.30 m  (H1; also Pregnolato et al. 2017,
 *                                                                              car speed falls to zero at 0.30 m)
 *        LV  large vehicles; children and elderly on foot      d <= 0.50 m  (H2)
 *        AD  able-bodied adults on foot                        d <= 1.20 m  (H3)
 *      The criterion is used both as the traversability reference for evaluation and, for the mode-matched
 *      rules, as the closure depth.
 *   2. The synthetic hazard depth: every depth band of scenarios S1-S4 is multiplied by k in {0.5, 0.75, 1, 1.5, 2}.
 *      k = 0.75 was added after the first run of the grid {0.5, 1, 1.5, 2}, because no condition of that grid made
 *      water between 0.30 and 0.50 m the only access to an origin (S4 rings at 0.45 m).
 *
 * Rules: distance-based Dijkstra; the proposed rule as deployed (closure 0.50 m for every mode); the proposed
 * penalty ladder with mode-matched closure; the rule adapted from An et al. (2025) as published (closure
 * 0.80 m); and the adapted rule with mode-matched closure.
 *
 *   node experiments/mode_criteria_robustness.js
 *
 * All other parameters below were fixed before any result of this analysis was inspected. Outputs:
 * results/mode_robustness_runs.csv (one row per criterion, scenario, scale, origin, rule),
 * results/mode_robustness_summary.json and results/mode_robustness_summary.md.
 * At k = 1 the scenario rasters and the routes of the three original rules are checked against the archived
 * outputs of synthetic_routing_eval.js (results/rasters/*.bin, results/runs.csv); the script stops on any mismatch.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'results');

const CFG = {
    sampleSpacingM: 7.5,                         // as in synthetic_routing_eval.js
    criteria: [
        { id: 'SV', label: 'Small vehicles (cars, motorcycles)', depth: 0.30, source: 'AIDR 2017 H1; Pregnolato et al. 2017' },
        { id: 'LV', label: 'Large vehicles; children and elderly on foot', depth: 0.50, source: 'AIDR 2017 H2' },
        { id: 'AD', label: 'Able-bodied adults on foot', depth: 1.20, source: 'AIDR 2017 H3' },
    ],
    depthScales: [0.5, 0.75, 1.0, 1.5, 2.0],   // 0.75 added after the first run (see header)
    scenarios: ['S1', 'S2', 'S3', 'S4'],
    an: { v0: 1.6, eta: 0.9 },
};

const ladder = (d, closure) => (d > closure ? Infinity : d > 0.20 ? 10 : d > 0.05 ? 2 : 1);
function anTime(km, d, closure) { // An et al. (2025), Eq. (6); 0.5*eta*v0 above 0.2 m up to the closure depth
    const { v0, eta } = CFG.an;
    if (d > closure) return Infinity;
    const v = d <= 0 ? v0 : d <= 0.2 ? eta * (v0 - 3.1 * d) : 0.5 * eta * v0;
    return (km * 1000) / v;
}
const RULES = {
    distance: { label: 'Distance-based Dijkstra', usesDepth: false, cost: (km) => km },
    proposed_050: { label: 'Proposed rule as deployed (closure 0.50 m)', usesDepth: true, cost: (km, d) => km * ladder(d, 0.50) },
    proposed_mode: { label: 'Proposed ladder, mode-matched closure', usesDepth: true, cost: (km, d, c) => km * ladder(d, c) },
    an_080: { label: 'Adapted An et al. as published (closure 0.80 m)', usesDepth: true, cost: (km, d) => anTime(km, d, 0.80) },
    an_mode: { label: 'Adapted An et al., mode-matched closure', usesDepth: true, cost: (km, d, c) => anTime(km, d, c) },
};
const ORIGINAL = { distance: 'M1_distance', proposed_050: 'M2_proposed', an_080: 'M3_an2025' };

// ───────── raster geometry, graph, sampling: identical to synthetic_routing_eval.js ─────────
const META = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'data', 'raster', 'dtm_bandung_wgs84.json'), 'utf8'));
const { rows: ROWS, cols: COLS } = META;
const BB = META.bounds;
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
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, d2r = Math.PI / 180;
    const dLat = (lat2 - lat1) * d2r, dLon = (lon2 - lon1) * d2r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function buildGraph() {
    const gj = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend', 'data', 'roads', 'bandung_roads_real.geojson'), 'utf8'));
    const nodes = []; const key2id = new Map();
    const nid = (lat, lng) => {
        const k = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (!key2id.has(k)) { key2id.set(k, nodes.length); nodes.push({ lat, lng }); }
        return key2id.get(k);
    };
    const undirected = [];
    for (const f of gj.features) {
        if (f.geometry.type !== 'LineString') continue;
        const c = f.geometry.coordinates;
        for (let i = 0; i < c.length - 1; i++) {
            const a = nid(c[i][1], c[i][0]), b = nid(c[i + 1][1], c[i + 1][0]);
            undirected.push({ a, b, km: haversineKm(c[i][1], c[i][0], c[i + 1][1], c[i + 1][0]) });
        }
    }
    return { nodes, undirected };
}
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
    return { all: Int32Array.from(all), mids: Int32Array.from(mids), dl: L / n };
}
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
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function main() {
    const t0 = Date.now();
    const design = JSON.parse(fs.readFileSync(path.join(OUT, 'design.json'), 'utf8'));
    const G = buildGraph(); const N = G.nodes.length;
    const keepEdges = [];
    for (const e of G.undirected) {
        const s = sampleSegment(G.nodes[e.a], G.nodes[e.b], e.km);
        if (s.all.some(ix => ix < 0)) continue;
        keepEdges.push({ ...e, s });
    }
    if (keepEdges.length * 2 !== design.graph.domainDirectedEdges) throw new Error('experimental graph differs from design.json');
    const adj = Array.from({ length: N }, () => []);
    keepEdges.forEach((e, i) => { adj[e.a].push({ to: e.b, km: e.km, ei: i }); adj[e.b].push({ to: e.a, km: e.km, ei: i }); });
    const origins = design.origins;
    for (const o of origins) if (G.nodes[o.node].lat !== o.lat || G.nodes[o.node].lng !== o.lng) throw new Error(`origin ${o.id} moved`);
    const elig = design.shelters.filter(s => s.eligible);
    const targetMap = new Map(elig.map(s => [s.node, s]));

    let depth = null;
    const edgeDepth = (s) => { const ix = s.all; let m = 0; for (let j = 0; j < ix.length; j++) { const d = depth[ix[j]]; if (d > m) m = d; } return m; };
    function route(o, rule, closure) {
        const R = RULES[rule];
        const dist = new Float64Array(N).fill(Infinity), prevE = new Int32Array(N).fill(-1), prevN = new Int32Array(N).fill(-1);
        const done = new Uint8Array(N); const h = new Heap(); dist[o.node] = 0; h.push(0, o.node); let target = -1;
        while (h.size) {
            const [du, u] = h.pop(); if (done[u]) continue; if (du > dist[u]) continue;
            if (targetMap.has(u)) { target = u; break; }
            done[u] = 1;
            for (const e of adj[u]) {
                if (done[e.to]) continue;
                const d = R.usesDepth ? edgeDepth(keepEdges[e.ei].s) : 0;
                const c = R.cost(e.km, d, closure); if (!isFinite(c)) continue;
                const alt = du + c;
                if (alt < dist[e.to]) { dist[e.to] = alt; prevE[e.to] = e.ei; prevN[e.to] = u; h.push(alt, e.to); }
            }
        }
        if (target < 0) return { found: false };
        const edges = []; for (let v = target; v !== o.node; v = prevN[v]) edges.push(prevE[v]);
        return { found: true, target, edges };
    }
    // Reference: shortest traversable distance from any eligible shelter, using only edges with d <= thr.
    function referenceLengths(thr) {
        const dist = new Float64Array(N).fill(Infinity); const h = new Heap();
        for (const s of elig) { dist[s.node] = 0; h.push(0, s.node); }
        const ok = keepEdges.map(e => edgeDepth(e.s) <= thr);
        while (h.size) {
            const [du, u] = h.pop(); if (du > dist[u]) continue;
            for (const e of adj[u]) { if (!ok[e.ei]) continue; const alt = du + e.km;
                if (alt < dist[e.to]) { dist[e.to] = alt; h.push(alt, e.to); } }
        }
        return dist;
    }
    function evaluate(r, thr) {
        let km = 0, E = 0, maxD = 0, over = 0;
        for (const ei of r.edges) { const e = keepEdges[ei]; km += e.km;
            for (const ix of e.s.mids) E += depth[ix] * e.s.dl;
            const de = edgeDepth(e.s); if (de > maxD) maxD = de; if (de > thr) over++; }
        return { km, E, maxD, traversable: over === 0 };
    }
    function rasterize(zones, k) { // synthetic_routing_eval.js rasterize() with every band depth multiplied by k
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
                for (const band of z.bands) if (d > band.from && d <= band.to) v = Math.max(v, band.depth * k);
                if (v > r[idx]) r[idx] = v;
            }
        }
        return r;
    }

    // archived routes of the original evaluation, for the k = 1 consistency check
    const runsTxt = fs.readFileSync(path.join(OUT, 'runs.csv'), 'utf8').trim().split('\n');
    const hdr = runsTxt[0].split(','); const archived = new Map();
    for (const line of runsTxt.slice(1)) { const f = line.split(','); const o = Object.fromEntries(hdr.map((h, i) => [h, f[i]]));
        archived.set(`${o.scenario}|${o.origin}|${o.method}`, o); }
    let checked = 0;

    const rows = [];
    for (const sid of CFG.scenarios) {
        const S = design.scenarios.find(x => x.id === sid);
        for (const k of CFG.depthScales) {
            depth = rasterize(S.zones, k);
            if (k === 1) {
                const arch = new Float32Array(fs.readFileSync(path.join(OUT, 'rasters', `${sid}.bin`)).buffer.slice(0));
                for (let i = 0; i < arch.length; i++) if (Math.fround(depth[i]) !== arch[i]) throw new Error(`${sid} raster differs from archive at cell ${i}`);
            }
            for (const C of CFG.criteria) {
                const ref = referenceLengths(C.depth);
                for (const o of origins) {
                    const refKm = ref[o.node]; const reachable = isFinite(refKm);
                    for (const rule of Object.keys(RULES)) {
                        const r = route(o, rule, C.depth);
                        const row = { criterion: C.id, criterion_depth_m: C.depth, scenario: sid, depth_scale: k, origin: o.id, rule,
                            ref_reachable: reachable, ref_length_km: reachable ? +refKm.toFixed(4) : '', returned: r.found };
                        if (r.found) {
                            const ev = evaluate(r, C.depth);
                            Object.assign(row, { shelter: targetMap.get(r.target).id, length_km: +ev.km.toFixed(4), exposure_m2: +ev.E.toFixed(3),
                                max_depth_m: +ev.maxD.toFixed(3), traversable: ev.traversable,
                                detour_pct: reachable ? +(100 * (ev.km - refKm) / refKm).toFixed(3) : '' });
                        } else row.traversable = false;
                        row.outcome = reachable ? (r.found ? (row.traversable ? 'correct_route' : 'unsafe_route') : 'false_refusal')
                                                : (r.found ? 'missed_isolation' : 'correct_isolation');
                        rows.push(row);
                        if (k === 1 && ORIGINAL[rule]) { // same route as the archived run (rule and raster are unchanged)
                            const a = archived.get(`${sid}|${o.id}|${ORIGINAL[rule]}`);
                            const same = (a.returned === 'true') === r.found &&
                                (!r.found || (+a.shelter === targetMap.get(r.target).id && Math.abs(+a.length_km - row.length_km) < 1e-3));
                            if (!same) throw new Error(`k=1 mismatch with runs.csv: ${sid} origin ${o.id} ${rule}`);
                            checked++;
                        }
                    }
                }
            }
        }
        console.log(`${sid} done (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }

    // ───────── summaries ─────────
    const ruleIds = Object.keys(RULES);
    const by = (f) => rows.filter(f);
    const perCriterion = [];
    const conditions = [];
    for (const C of CFG.criteria) {
        for (const rule of ruleIds) {
            const rr = by(r => r.criterion === C.id && r.rule === rule);
            const cnt = (o) => rr.filter(r => r.outcome === o).length;
            const correctRoutes = rr.filter(r => r.outcome === 'correct_route');
            perCriterion.push({ criterion: C.id, rule, cases: rr.length,
                correct: cnt('correct_route') + cnt('correct_isolation'), unsafe_route: cnt('unsafe_route'),
                false_refusal: cnt('false_refusal'), missed_isolation: cnt('missed_isolation'),
                mean_detour_pct: mean(correctRoutes.map(r => r.detour_pct)),
                detoured_routes: correctRoutes.filter(r => r.detour_pct > 1e-6).length,
                mean_exposure_m2: mean(rr.filter(r => r.returned).map(r => r.exposure_m2)) });
        }
        for (const sid of CFG.scenarios) for (const k of CFG.depthScales) {
            const res = ruleIds.map(rule => {
                const rr = by(r => r.criterion === C.id && r.scenario === sid && r.depth_scale === k && r.rule === rule);
                const correct = rr.filter(r => r.outcome === 'correct_route' || r.outcome === 'correct_isolation').length;
                return { rule, correct, unsafe: rr.filter(r => r.outcome === 'unsafe_route' || r.outcome === 'missed_isolation').length,
                    false_refusal: rr.filter(r => r.outcome === 'false_refusal').length,
                    mean_detour_pct: mean(rr.filter(r => r.outcome === 'correct_route').map(r => r.detour_pct)),
                    total_exposure_m2: +rr.filter(r => r.returned).reduce((a, r) => a + r.exposure_m2, 0).toFixed(1) };
            });
            const best = Math.max(...res.map(x => x.correct));
            res.forEach(x => { x.rank = 1 + res.filter(y => y.correct > x.correct).length; });
            conditions.push({ criterion: C.id, scenario: sid, depth_scale: k, best_correct: best, results: res });
        }
    }
    const firstPlace = {};
    for (const C of CFG.criteria) for (const rule of ruleIds)
        firstPlace[`${C.id}|${rule}`] = conditions.filter(c => c.criterion === C.id && c.results.find(x => x.rule === rule).rank === 1).length;
    const nCond = CFG.scenarios.length * CFG.depthScales.length;

    fs.writeFileSync(path.join(OUT, 'mode_robustness_summary.json'), JSON.stringify({ cfg: CFG,
        rules: Object.fromEntries(ruleIds.map(r => [r, RULES[r].label])), consistency_checks_k1: checked,
        perCriterion, firstPlace, conditions }, null, 1));
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    fs.writeFileSync(path.join(OUT, 'mode_robustness_runs.csv'),
        [cols.join(',')].concat(rows.map(r => cols.map(c => r[c] ?? '').join(','))).join('\n'));
    const md = ['# Rankings across mode-specific hazard and closure criteria', '',
        `Origins 40; scenarios ${CFG.scenarios.join(', ')}; depth scales ${CFG.depthScales.join(', ')}; ${nCond} conditions per criterion ` +
        `(${nCond * 40} origin cases). Consistency checks at k = 1 passed: ${checked}.`, '',
        '| Criterion | Rule | Correct | Unsafe route | False refusal | Missed isolation | Detoured routes | Mean detour (%) | Mean exposure (m²) | Ranked first (of ' + nCond + ') |',
        '|---|---|---|---|---|---|---|---|---|---|'];
    for (const p of perCriterion) md.push(`| ${p.criterion} (${CFG.criteria.find(c => c.id === p.criterion).depth} m) | ${p.rule} | ${p.correct}/${p.cases} | ` +
        `${p.unsafe_route} | ${p.false_refusal} | ${p.missed_isolation} | ${p.detoured_routes} | ${p.mean_detour_pct === null ? 'n/a' : p.mean_detour_pct.toFixed(2)} | ` +
        `${p.mean_exposure_m2 === null ? 'n/a' : p.mean_exposure_m2.toFixed(1)} | ${firstPlace[`${p.criterion}|${p.rule}`]} |`);
    md.push('', '## Correctly handled origins per condition (rank by correct count; ties share a rank)', '',
        '| Criterion | Scenario | k | ' + ruleIds.join(' | ') + ' |', '|---|---|---|' + ruleIds.map(() => '---').join('|') + '|');
    for (const c of conditions) md.push(`| ${c.criterion} | ${c.scenario} | ${c.depth_scale} | ` +
        c.results.map(x => `${x.correct} (${x.rank})`).join(' | ') + ' |');
    fs.writeFileSync(path.join(OUT, 'mode_robustness_summary.md'), md.join('\n') + '\n');
    console.log(`Finished in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${rows.length} runs; k = 1 consistency checks passed: ${checked}.`);
}

main();
