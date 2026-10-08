// Functional tests of the flood-aware routing diagnostics (Table 9 of the manuscript).
// Requires the RAKIT server on localhost:3001.
//   node experiments/functional_routing_tests.js
// 1) runs the production hydrodynamic simulation (P = 137 mm, 141 iterations) to seed the depth cache,
// 2) builds the road graph with an untimed warm-up query,
// 3) routes three origins to Lapangan Gasibu through the deployed /api/evacuation/route endpoint.
const fs = require('fs');
const path = require('path');
const http = require('http');

function post(p, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost', port: 3001, path: p, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, res => {
            let out = '';
            res.on('data', c => out += c);
            res.on('end', () => resolve(JSON.parse(out)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

const SHELTER = { name: 'Lapangan Gasibu', lat: -6.8975, lng: 107.6185 };
const ORIGINS = [
    { label: 'Dago (elevated, northern Bandung)', lat: -6.8650, lng: 107.6170 },
    { label: 'Near the Citarum floodplain (southern Bandung)', lat: -6.9600, lng: 107.6000 },
    { label: 'Cicendo (city center)', lat: -6.9100, lng: 107.5950 },
];

async function main() {
    const sim = await post('/api/simulation/hydraulics', { P: 137 });
    console.log(`simulation: P=137 mm, steps=${sim.simInfo.timeSteps}, flooded cells=${sim.floodedCells}, max depth=${sim.maxDepth} m`);
    await post('/api/evacuation/route', { startLat: -6.90, startLng: 107.61, shelters: [SHELTER] });  // warm-up
    const results = [];
    for (const o of ORIGINS) {
        const t0 = process.hrtime.bigint();
        const r = await post('/api/evacuation/route', { startLat: o.lat, startLng: o.lng, shelters: [SHELTER] });
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        const row = { origin: o.label, lat: o.lat, lng: o.lng, query_ms: Math.round(ms) };
        if (r.routeGeometry) {
            Object.assign(row, r.routeGeometry.properties, { result: 'route' });
        } else {
            Object.assign(row, { result: 'no route', diagnostic: r.diagnostic });
        }
        results.push(row);
        console.log(JSON.stringify(row));
    }
    const out = path.join(__dirname, 'results', 'functional_routing_P137_geofix.json');
    fs.writeFileSync(out, JSON.stringify({ shelter: SHELTER, simulation: { P: 137, steps: sim.simInfo.timeSteps,
        floodedCells: sim.floodedCells, maxDepth: sim.maxDepth }, results }, null, 2));
    console.log('saved', out);
}

main().catch(e => { console.error(e); process.exit(1); });
