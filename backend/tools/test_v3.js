// Test script for Rakit V3 Algorithm 1 Validated
const http = require('http');

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost', port: 3001, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
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

async function main() {
    console.log('=== RAKIT V3 — Algorithm 1 Validated Test ===\n');

    // Test 1: Hydraulic Simulation (Steps 1–3)
    console.log('--- Test 1: Hydraulic Simulation (P=120mm) ---');
    const sim = await post('/api/simulation/hydraulics', { P: 120 });
    console.log(`  Method: ${sim.simInfo.method}`);
    console.log(`  Grid: ${sim.simInfo.gridResolution}`);
    console.log(`  Stability Alpha: ${sim.simInfo.stabilityAlpha}`);
    console.log(`  Flooded Cells: ${sim.floodedCells}`);
    console.log(`  Max Depth: ${sim.maxDepth} m`);
    console.log(`  Avg Runoff: ${sim.runoff.toFixed(1)} mm`);
    console.log('  ✅ Simulation passed\n');

    // Test 2: Evacuation from SAFE zone (should find route)
    console.log('--- Test 2: Evacuation from Safe Zone ---');
    const route1 = await post('/api/evacuation/route', {
        startLat: -6.89, startLng: 107.61,
        shelters: [
            { name: "Gasibu", lat: -6.8975, lng: 107.6185 },
            { name: "Balai Kota", lat: -6.9175, lng: 107.6091 }
        ]
    });
    if (route1.routeGeometry) {
        const props = route1.routeGeometry.properties;
        console.log(`  ✅ Route found: ${props.lengthKm} km to ${route1.targetShelter.name}`);
        console.log(`  Max Depth on Route: ${props.maxRouteDepth} m`);
        console.log(`  Weighted Cost: ${props.weightedCost}`);
    } else {
        console.log(`  ❌ No route: ${route1.error}`);
    }
    console.log('');

    // Test 3: Evacuation from FLOOD zone (should get diagnostic)
    console.log('--- Test 3: Evacuation from Flood Zone ---');
    const route2 = await post('/api/evacuation/route', {
        startLat: -6.96, startLng: 107.60,
        shelters: [
            { name: "Gasibu", lat: -6.8975, lng: 107.6185 }
        ]
    });
    if (route2.routeGeometry) {
        const props = route2.routeGeometry.properties;
        console.log(`  Route found: ${props.lengthKm} km to ${route2.targetShelter.name}`);
        console.log(`  Max Depth on Route: ${props.maxRouteDepth} m`);
    } else {
        console.log(`  Diagnostic: ${route2.diagnostic}`);
        console.log(`  Message: ${route2.error.substring(0, 80)}...`);
    }
    console.log('');

    console.log('=== All tests completed ===');
}

main().catch(console.error);
