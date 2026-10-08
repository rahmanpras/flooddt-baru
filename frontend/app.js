// ============== DEPLOYMENT CONFIG ==============
// Set to '' for local development (same-origin), or full backend URL for production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''  // Local development: use relative paths
    : 'https://flood-dt-api.smartsystem.id';  // Production: full backend URL

// Modal Logic
function closeModal() {
    document.getElementById('welcome-modal').style.display = 'none';
}

// Right Panel Collapsible Sections
function togglePanelSection(bodyId) {
    const body = document.getElementById(bodyId);
    const arrow = document.getElementById(bodyId + '-arrow');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (arrow) arrow.classList.remove('collapsed');
    } else {
        body.style.display = 'none';
        if (arrow) arrow.classList.add('collapsed');
    }
}

// Accordion Logic
document.querySelectorAll('.accordion-header').forEach(button => {
    button.addEventListener('click', () => {
        const accordionContent = button.nextElementSibling;
        button.classList.toggle('active');
        if (button.classList.contains('active')) {
            accordionContent.classList.add('active');
            button.parentElement.classList.add('active');
        } else {
            accordionContent.classList.remove('active');
            button.parentElement.classList.remove('active');
        }
    });
});

// Base Map Setup
const map = L.map('map', {
    center: [-6.9147, 107.6098], // Bandung
    zoom: 13,
    zoomControl: true, // we can place it on bottom right or leave default top left
});

// Use CartoDB Positron for light theme similar to screenshots
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors © CARTO'
}).addTo(map);

// Global State
let floodLayerGroup = L.layerGroup().addTo(map);
let routeLayerGroup = L.layerGroup().addTo(map);
let shelterLayerGroup = L.layerGroup().addTo(map);
let currentRunoff = 0;

// Cesium Global State
let is3DMode = false;
let viewer = null;
let cesiumFloodLayer = null;
let cesiumCustomLayers = {};

// Mock Shelters for Bandung
const shelters = [
    { id: 1, name: "Stadion GBLA (Gedebage)", lat: -6.9570, lng: 107.7120, capacity: 38000, current: 0 },
    { id: 2, name: "SOR Arcamanik", lat: -6.9150, lng: 107.6710, capacity: 5000, current: 0 },
    { id: 3, name: "Kantor Kecamatan Buahbatu (Kordon)", lat: -6.9410, lng: 107.6580, capacity: 2000, current: 0 },
    { id: 4, name: "SMAN 15 Bandung (Bojonagara)", lat: -6.8940, lng: 107.5960, capacity: 3000, current: 0 },
    { id: 5, name: "SMKN 3 Bandung (Karees)", lat: -6.9240, lng: 107.6360, capacity: 2500, current: 0 },
    { id: 6, name: "UIN Sunan Gunung Djati (Ujungberung)", lat: -6.9300, lng: 107.7180, capacity: 6000, current: 0 },
    { id: 7, name: "Monumen BLA (Tegalega)", lat: -6.9360, lng: 107.6030, capacity: 8000, current: 0 },
    { id: 8, name: "Pusdai (Cibeunying)", lat: -6.9010, lng: 107.6220, capacity: 4000, current: 0 },
    { id: 9, name: "ITB Sabuga (SWK)", lat: -6.8863, lng: 107.6087, capacity: 8000, current: 0 }
];

function logTerminal(message) {
    const term = document.getElementById('terminal-box');
    const time = new Date().toLocaleTimeString();
    term.innerHTML += `<div class="log-line">[${time}] ${message}</div>`;
    term.scrollTop = term.scrollHeight;
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Open the first accordion by default
    document.querySelector('.accordion-header').click();
    
    // Draw Shelters
    shelters.forEach(s => {
        // Draw an orange circle for points of interest like in the 3rd screenshot
        L.circleMarker([s.lat, s.lng], {
            radius: 6,
            fillColor: '#ff9800',
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(shelterLayerGroup).bindPopup(`<b>${s.name}</b><br>Capacity: ${s.capacity}`);
        
        document.getElementById('shelter-list').innerHTML += `
            <div class="shelter-item">
                <b>${s.name}</b><br>
                0 / ${s.capacity} Evacuees
        `;
    });
    
    // Build kecamatan grid buttons
    buildKecamatanGrid();
    
    // Automatically start in 3D Mode
    setTimeout(() => {
        if (!is3DMode) toggle3DMode();
    }, 500);
});

// ============================================================
// KECAMATAN PICKER FUNCTIONS
// ============================================================

const KECAMATAN_LIST = [
    "Andir","Antapani","Arcamanik","Astana Anyar","Babakan Ciparay",
    "Bandung Kidul","Bandung Kulon","Bandung Wetan","Batununggal",
    "Bojongloa Kaler","Bojongloa Kidul","Buahbatu","Cibeunying Kaler",
    "Cibeunying Kidul","Cibiru","Cicendo","Cidadap","Cinambo","Coblong",
    "Gedebage","Kiaracondong","Lengkong","Mandalajati","Panyileukan",
    "Rancasari","Regol","Sukajadi","Sukasari","Sumur Bandung","Ujungberung"
];

let kecamatanGeoJSON = null;
let cesiumKecamatanHighlight = null;

function buildKecamatanGrid() {
    const grid = document.getElementById('kecamatan-grid');
    if (!grid) return;
    grid.innerHTML = '';
    KECAMATAN_LIST.forEach(name => {
        const btn = document.createElement('button');
        btn.textContent = name;
        btn.onclick = () => selectKecamatan(name);
        btn.style.cssText = `
            padding: 9px 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            color: #1e293b;
            font-size: 0.78rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
            text-align: center;
            font-family: 'Roboto', sans-serif;
        `;
        btn.onmouseover = () => {
            btn.style.background = '#1E2D4A';
            btn.style.borderColor = '#1E2D4A';
            btn.style.color = '#ffffff';
        };
        btn.onmouseout = () => {
            btn.style.background = '#f8fafc';
            btn.style.borderColor = '#e2e8f0';
            btn.style.color = '#1e293b';
        };
        grid.appendChild(btn);
    });
}

function showKecamatanPicker() {
    document.getElementById('kecamatan-modal').style.display = 'flex';
}

async function selectKecamatan(name) {
    // Tutup modal
    document.getElementById('kecamatan-modal').style.display = 'none';

    // Update label
    const label = document.getElementById('kecamatan-label');
    if (name === '__ALL__') {
        label.style.display = 'none';
    } else {
        label.textContent = name;
        label.style.display = 'block';
    }

    // Pastikan mode 3D aktif
    if (!is3DMode) {
        toggle3DMode();
        await new Promise(r => setTimeout(r, 1200));
    }

    // Muat GeoJSON jika belum
    if (!kecamatanGeoJSON) {
        try {
            const res = await fetch('/data/geojson/4326_BatasKecamatan.geojson');
            kecamatanGeoJSON = await res.json();
            logTerminal('District boundary data loaded successfully.');
        } catch (e) {
            logTerminal('Failed to load district boundaries: ' + e.message);
            return;
        }
    }

    if (!viewer) return;

    // Hapus highlight sebelumnya
    if (cesiumKecamatanHighlight) {
        viewer.dataSources.remove(cesiumKecamatanHighlight);
        cesiumKecamatanHighlight = null;
    }

    if (name === '__ALL__') {
        // Tampilkan seluruh kota
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(107.6098, -6.9147, 18000),
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-55.0),
                roll: 0.0
            },
            duration: 2.5
        });
        logTerminal('View: All of Bandung City');
        return;
    }

    // Cari feature kecamatan yang dipilih
    const feature = kecamatanGeoJSON.features.find(
        f => f.properties.WADMKC && f.properties.WADMKC.toLowerCase() === name.toLowerCase()
    );

    if (!feature) {
        logTerminal(`District "${name}" not found in data.`);
        return;
    }

    // Hitung bounding box kecamatan
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    const extractCoords = (coords) => {
        if (typeof coords[0] === 'number') {
            minLng = Math.min(minLng, coords[0]); maxLng = Math.max(maxLng, coords[0]);
            minLat = Math.min(minLat, coords[1]); maxLat = Math.max(maxLat, coords[1]);
        } else {
            coords.forEach(extractCoords);
        }
    };
    extractCoords(feature.geometry.coordinates);

    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const spanLng = maxLng - minLng;
    const spanLat = maxLat - minLat;
    const altitudeM = Math.max(spanLng, spanLat) * 111000 * 1.8; // Estimasi ketinggian dari ukuran area

    // Sorot kecamatan terpilih
    const ds = new Cesium.CustomDataSource('kecamatanHighlight');
    ds.entities.add({
        polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(
                (() => {
                    const flat = [];
                    const ring = feature.geometry.type === 'Polygon'
                        ? feature.geometry.coordinates[0]
                        : feature.geometry.coordinates[0][0]; // MultiPolygon
                    ring.forEach(c => { flat.push(c[0], c[1]); });
                    return flat;
                })()
            ),
            material: Cesium.Color.fromCssColorString('#facc15').withAlpha(0.18),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#facc15').withAlpha(0.9),
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            classificationType: Cesium.ClassificationType.BOTH
        }
    });
    viewer.dataSources.add(ds);
    cesiumKecamatanHighlight = ds;

    // Terbang ke kecamatan
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, Math.max(altitudeM, 2500)),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-50.0),
            roll: 0.0
        },
        duration: 2.0
    });

    logTerminal(`View: District ${name} | Area span: ${(spanLng * 111 * spanLat * 111).toFixed(2)} km²`);
}



async function uploadDEM() {
    const fileInput = document.getElementById('dem-file');
    if (!fileInput.files.length) {
        alert("Please select a DEM file first.");
        return;
    }
    const file = fileInput.files[0];
    logTerminal(`Uploading DEM data: ${file.name}...`);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(API_BASE + '/api/upload/dem', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        logTerminal(`DEM parsed. Terrain model generated.`);
        alert("DEM File Loaded Successfully!");
    } catch (err) {
        logTerminal(`Error uploading DEM: ${err.message}`);
    }
}

async function uploadRainfall() {
    const fileInput = document.getElementById('rainfall-file');
    if (!fileInput.files.length) {
        alert("Please select a Rainfall CSV file first.");
        return;
    }
    const file = fileInput.files[0];
    logTerminal(`Uploading Rainfall data: ${file.name}...`);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(API_BASE + '/api/upload/rainfall', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        logTerminal(`Rainfall data loaded. Extracted P = ${result.P} mm...`);
        // Enable inputs
        document.getElementById('input-rainfall').disabled = false;
        const btn = document.getElementById('run-hydro-btn');
        btn.disabled = false;
        btn.style.opacity = 1;
        
        // Set the rainfall input based on the extracted value
        document.getElementById('input-rainfall').value = result.P;
        logTerminal(`Hydrology parameters extracted and ready.`);
    } catch (err) {
        logTerminal(`Error uploading Rainfall: ${err.message}`);
    }
}

let currentRainfall = 0;

async function runRunoffSimulation() {
    const P = document.getElementById('input-rainfall').value;
    
    logTerminal(`Running Spatial SCS-CN Hydrology: P=${P}mm`);
    
    try {
        currentRainfall = parseFloat(P);
        document.getElementById('val-runoff').innerText = "Spatial (Variable)";
        
        // Auto trigger flood risk to 10yr if it's currently none
        const select = document.getElementById('flood-risk-select');
        if (select.value === 'none') {
            select.value = '10yr';
        }
        generateFloodGrid();
        
    } catch (err) {
        logTerminal(`Error: ${err.message}`);
    }
}

// Global variable to store the generated PNG data URL
let currentPngOverlayUrl = null;
let currentFloodBounds = null;
let currentFloodData = null; // Data grid lengkap untuk volume 3D
let imageOverlayLayer = null;

async function generateFloodGrid() {
    const riskLevel = document.getElementById('flood-risk-select').value;
    
    // Clear old layers
    if (imageOverlayLayer) {
        map.removeLayer(imageOverlayLayer);
        imageOverlayLayer = null;
    }
    if (viewer && cesiumFloodLayer) {
        viewer.imageryLayers.remove(cesiumFloodLayer);
        cesiumFloodLayer = null;
    }
    
    if (riskLevel === 'none' || currentRainfall == 0) {
        document.getElementById('dmg-prop').innerText = "0";
        document.getElementById('dmg-struct').innerText = "0";
        document.getElementById('dmg-content').innerText = "0";
        document.getElementById('val-area').innerText = "0";
        document.getElementById('btn-download-png').style.display = 'none';
        return;
    }
    
    logTerminal(`Generating raster flood map for risk: ${riskLevel}...`);
    
    try {
        // If higher return period is selected, boost P (precipitation)
        let simulatedP = parseFloat(currentRainfall);
        if (riskLevel === '20yr') simulatedP *= 1.5;
        else if (riskLevel === '50yr') simulatedP *= 2.0;
        else if (riskLevel === '100yr') simulatedP *= 3.0;

        const response = await fetch(API_BASE + '/api/simulation/hydraulics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ P: simulatedP })
        });
        const data = await response.json();
        
        if (data.error) {
            logTerminal(`Server Error: ${data.error}`);
            alert(`Simulation Failed: ${data.error}`);
            return;
        }
        
        logTerminal(`Simulation: ${data.simInfo ? data.simInfo.method : 'Hydraulic'} | Grid: ${data.cols}x${data.rows} | Flooded cells: ${data.floodedCells} | Max depth: ${data.maxDepth || 'N/A'}m`);
        
        const bounds = data.bounds;
        let areaCount = data.floodedCells;
        
        // Update global runoff for Analytics Page
        currentRunoff = data.runoff || 0;
        
        // Calculate damage proportional to actual flooded area and depth
        const bW = (bounds[1][1] - bounds[0][1]) * 111;  // width in km
        const bH = (bounds[1][0] - bounds[0][0]) * 111;  // height in km
        const cellAreaHa = (bW / data.cols) * (bH / data.rows) * 100; // hectares per cell
        const areaHa = parseFloat((areaCount * cellAreaHa).toFixed(1));
        const propCount = Math.floor(areaHa * 12);  // ~12 properties per hectare in urban Bandung
        const structDmg = Math.floor(propCount * 28500);  // avg structural damage per property
        const contDmg = Math.floor(propCount * 15200);    // avg content damage per property
        
        document.getElementById('dmg-prop').innerText = propCount.toLocaleString();
        document.getElementById('dmg-struct').innerText = structDmg.toLocaleString();
        document.getElementById('dmg-content').innerText = contDmg.toLocaleString();
        document.getElementById('val-area').innerText = areaHa;
        
        // Save to localStorage for Analytics Page
        const simStats = {
            rainfall: document.getElementById('input-rainfall').value,
            runoff: currentRunoff,
            propCount: propCount,
            structDmg: structDmg,
            contDmg: contDmg,
            areaHa: areaHa
        };
        localStorage.setItem('floodSimStats', JSON.stringify(simStats));
        
        // ============================================================
        // HEC-RAS Style Smooth Flood Depth Rendering
        // Uses native canvas bilinear smoothing to prevent edge-bleeding
        // ============================================================
        
        const grid = data.grid;
        const maxDepth = data.maxDepth || 3.0;
        
        // Color ramp matching HEC-RAS reference image
        // Solid blues: light cyan → medium blue → dark navy
        // Higher opacity than before to create distinct visible flood polygons
        function depthToColor(depth, maxD) {
            const t = Math.min(depth / maxD, 1.0);
            // Interpolate between color stops — all with high opacity
            const stops = [
                { t: 0.00, r: 59,  g: 130, b: 246, a: 0.70 },  // Shallow: blue-500
                { t: 0.25, r: 37,  g: 99,  b: 235, a: 0.80 },  // blue-600
                { t: 0.50, r: 29,  g: 78,  b: 216, a: 0.85 },  // blue-700
                { t: 0.75, r: 30,  g: 64,  b: 175, a: 0.90 },  // blue-800
                { t: 1.00, r: 30,  g: 58,  b: 138, a: 0.95 },  // Deep: blue-900 (very dark blue)
            ];
            
            // Find the two stops to interpolate between
            let lo = stops[0], hi = stops[stops.length - 1];
            for (let i = 0; i < stops.length - 1; i++) {
                if (t >= stops[i].t && t <= stops[i + 1].t) {
                    lo = stops[i];
                    hi = stops[i + 1];
                    break;
                }
            }
            
            const range = hi.t - lo.t || 1;
            const s = (t - lo.t) / range;
            
            return {
                r: Math.round(lo.r + (hi.r - lo.r) * s),
                g: Math.round(lo.g + (hi.g - lo.g) * s),
                b: Math.round(lo.b + (hi.b - lo.b) * s),
                a: lo.a + (hi.a - lo.a) * s
            };
        }
        
        // Step 1: Draw exact simulation pixels
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = data.cols;
        rawCanvas.height = data.rows;
        const rawCtx = rawCanvas.getContext('2d');
        
        for (let r = 0; r < data.rows; r++) {
            for (let c = 0; c < data.cols; c++) {
                const cell = grid[r][c];
                if (cell.h > 0) {
                    const color = depthToColor(cell.h, maxDepth);
                    rawCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
                    rawCtx.fillRect(c, r, 1, 1);
                }
            }
        }
        
        // Step 2: Upscale using native bilinear interpolation (cleaner than CSS blur)
        // Dynamically calculate scale to prevent massive memory usage on high-res grids
        const maxCanvasDim = 2000;
        const scale = Math.max(1, Math.min(6, Math.floor(maxCanvasDim / Math.max(data.cols, data.rows))));
        
        const smoothCanvas = document.createElement('canvas');
        smoothCanvas.width = data.cols * scale;
        smoothCanvas.height = data.rows * scale;
        const smoothCtx = smoothCanvas.getContext('2d');
        
        smoothCtx.imageSmoothingEnabled = true;
        smoothCtx.imageSmoothingQuality = 'high';
        smoothCtx.drawImage(rawCanvas, 0, 0, smoothCanvas.width, smoothCanvas.height);
        
        currentPngOverlayUrl = smoothCanvas.toDataURL('image/png');
        currentFloodBounds = bounds;
        currentFloodData = data;
        
        imageOverlayLayer = L.imageOverlay(currentPngOverlayUrl, bounds, {
            opacity: 0.9,
            interactive: false
        }).addTo(map);
        
        syncFloodTo3D();
        
        document.getElementById('btn-download-png').style.display = 'block';
        logTerminal(`Flood depth map rendered (${data.cols}x${data.rows} → ${smoothCanvas.width}x${smoothCanvas.height} smoothed).`);
        
    } catch (err) {
        logTerminal(`Error: ${err.message}`);
    }
}

async function syncFloodTo3D() {
    if (!viewer || !currentPngOverlayUrl || !currentFloodBounds) return;
    
    if (cesiumFloodLayer) {
        viewer.imageryLayers.remove(cesiumFloodLayer);
        cesiumFloodLayer = null;
    }
    // Bersihkan objek polygon kotak (volumetric) sebelumnya jika ada
    if (window.cesiumFloodVolumes) {
        viewer.dataSources.remove(window.cesiumFloodVolumes);
        window.cesiumFloodVolumes = null;
    }
    
    try {
        logTerminal("Rendering flood overlay to 3D (HEC-RAS style)...");
        const provider = await Cesium.SingleTileImageryProvider.fromUrl(currentPngOverlayUrl, {
            rectangle: Cesium.Rectangle.fromDegrees(
                currentFloodBounds[0][1], currentFloodBounds[0][0], 
                currentFloodBounds[1][1], currentFloodBounds[1][0]
            )
        });
        cesiumFloodLayer = viewer.imageryLayers.addImageryProvider(provider);
        // Atur opasitas tinggi agar warna layer jelas dan menempel pada kontur terrain
        cesiumFloodLayer.alpha = 0.85; 
        
        logTerminal(`Flood overlay draped successfully.`);
    } catch (e) {
        console.error('Failed to sync flood to 3D:', e);
    }
}

function downloadOverlayPNG() {
    if (!currentPngOverlayUrl) return;
    const a = document.createElement('a');
    a.href = currentPngOverlayUrl;
    a.download = `flood_inundation_raster.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    logTerminal('PNG Overlay downloaded.');
}

// Evacuation Routing Logic (Algorithm 1 Validated — Steps 6–8)
async function requestEvacuationRoute(lat, lng) {
    routeLayerGroup.clearLayers();
    // Add start marker on 2D
    L.circleMarker([lat, lng], { radius: 6, fillColor: '#10b981', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(routeLayerGroup);
    
    // Collect shelter locations for multi-target Dijkstra
    const shelterList = [];
    shelterLayerGroup.eachLayer(layer => {
        if (layer.getLatLng) {
            const ll = layer.getLatLng();
            const name = (layer.options && layer.options.title) || (layer.getPopup && layer.getPopup() ? 'Shelter' : 'Shelter');
            shelterList.push({ lat: ll.lat, lng: ll.lng, name: name });
        }
    });
    
    // Fallback: use default shelters if none on map
    if (shelterList.length === 0) {
        shelterList.push(
            { name: "Gasibu", lat: -6.8975, lng: 107.6185 },
            { name: "Balai Kota", lat: -6.9175, lng: 107.6091 },
            { name: "Tegalega", lat: -6.9330, lng: 107.5970 },
            { name: "Sarana Olahraga", lat: -6.8850, lng: 107.6040 }
        );
    }
    
    try {
        // Step 7: Call single-source multi-target Dijkstra on Node.js backend
        const response = await fetch(API_BASE + '/api/evacuation/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startLat: lat, startLng: lng, shelters: shelterList })
        });
        const result = await response.json();
        
        if (result.error) {
            // Step 8b: Diagnostic no-route response
            logTerminal(`⚠️ ${result.error}`);
            
            if (result.diagnostic === 'FLOOD_ISOLATION') {
                alert(`🚨 Flood-Induced Isolation\n\n${result.error}`);
            } else if (result.diagnostic === 'NETWORK_DISCONNECTION') {
                alert(`⚠️ Network Issue\n\n${result.error}`);
            } else {
                alert(`Evacuation Routing Failed: ${result.error}`);
            }
            return;
        }

        // Step 8a: Draw route on 2D Leaflet
        L.geoJSON(result.routeGeometry, {
            style: {
                color: '#10b981', // Emerald green
                weight: 5,
                opacity: 0.9,
                lineCap: 'round'
            }
        }).addTo(routeLayerGroup);

        // Add Shelter Marker and Popup at destination
        if (result.targetShelter) {
            const shelterIcon = L.divIcon({
                html: '<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
                className: '',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            const shelterMarker = L.marker([result.targetShelter.lat, result.targetShelter.lng], { icon: shelterIcon }).addTo(routeLayerGroup);
            
            const popupContent = `
                <div style="font-family: sans-serif; text-align: center;">
                    <h4 style="margin: 0 0 5px 0; color: #1e293b;">Evacuation Shelter</h4>
                    <b style="color: #ef4444; font-size: 14px;">${result.targetShelter.name}</b>
                    <p style="margin: 5px 0 0 0; font-size: 11px; color: #64748b;">
                        Lat: ${result.targetShelter.lat.toFixed(5)}<br>
                        Lng: ${result.targetShelter.lng.toFixed(5)}
                    </p>
                </div>
            `;
            shelterMarker.bindPopup(popupContent, { autoClose: false, closeOnClick: false }).openPopup();
        }
        
        const props = result.routeGeometry.properties;
        logTerminal(`✅ Route found: ${props.lengthKm} km to ${result.targetShelter.name} | Max depth on route: ${props.maxRouteDepth}m | Weighted cost: ${props.weightedCost}`);

        // Draw on 3D Cesium if active
        if (typeof viewer !== 'undefined' && viewer) {
            if (window.cesiumEvacRoute) viewer.entities.remove(window.cesiumEvacRoute);
            if (window.cesiumEvacStart) viewer.entities.remove(window.cesiumEvacStart);
            
            // Add start point
            window.cesiumEvacStart = viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(lng, lat, 750), 
                point: { pixelSize: 12, color: Cesium.Color.SPRINGGREEN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 }
            });

            // Parse coordinates from GeoJSON
            if (result.routeGeometry && result.routeGeometry.geometry.coordinates) {
                const flatCoords = [];
                for (const coord of result.routeGeometry.geometry.coordinates) {
                    flatCoords.push(coord[0]);
                    flatCoords.push(coord[1]);
                }
                
                window.cesiumEvacRoute = viewer.entities.add({
                    polyline: {
                        positions: Cesium.Cartesian3.fromDegreesArray(flatCoords),
                        width: 8.0,
                        material: Cesium.Color.SPRINGGREEN.withAlpha(0.9),
                        clampToGround: true,
                        classificationType: Cesium.ClassificationType.BOTH
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        logTerminal(`Error routing: ${err.message}`);
    }
}

// Map Click Evacuation Routing (2D)
map.on('click', function(e) {
    requestEvacuationRoute(e.latlng.lat, e.latlng.lng);
});

// Custom Layers Management
const customLayers = {
    gfidas: null,
    lulc: null,
    batas: null,
    sungai: null,
    potensi: null
};

async function toggleCustomLayer(layerId, isChecked) {
    if (!isChecked) {
        if (customLayers[layerId]) {
            map.removeLayer(customLayers[layerId]);
            customLayers[layerId] = null;
        }
        if (viewer && cesiumCustomLayers[layerId]) {
            if (layerId === 'gfidas' || layerId === 'lulc') {
                viewer.imageryLayers.remove(cesiumCustomLayers[layerId]);
            } else {
                viewer.dataSources.remove(cesiumCustomLayers[layerId]);
            }
            cesiumCustomLayers[layerId] = null;
        }
        return;
    }

    logTerminal(`Loading custom layer: ${layerId}...`);
    
    // Add Proj4 definition for Bandung UTM 48S if not exists
    if (typeof proj4 !== 'undefined' && !proj4.defs('EPSG:32748')) {
        proj4.defs("EPSG:32748", "+proj=utm +zone=48 +south +datum=WGS84 +units=m +no_defs");
    }

    // Helper to recursively reproject coordinates from EPSG:32748 to EPSG:4326
    const transformCoord = (coord) => {
        if (typeof coord[0] === 'number') {
            // Check if it's already in WGS84 bounds roughly (longitude -180 to 180)
            if (Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90) return coord;
            return proj4("EPSG:32748", "EPSG:4326", coord);
        }
        return coord.map(transformCoord);
    };

    const reprojectGeoJSON = (geojson) => {
        if (geojson.type === 'FeatureCollection') {
            geojson.features.forEach(f => {
                if (f.geometry && f.geometry.coordinates) {
                    f.geometry.coordinates = transformCoord(f.geometry.coordinates);
                }
            });
        } else if (geojson.type === 'Feature') {
            if (geojson.geometry && geojson.geometry.coordinates) {
                geojson.geometry.coordinates = transformCoord(geojson.geometry.coordinates);
            }
        }
        return geojson;
    };

    try {
        if (layerId === 'gfidas') {
            const baseName = 'GFIDAS_Kota Bandung (1).tif';
            
            // Fetch bounds JSON
            const boundsRes = await fetch(`${API_BASE}/${baseName}_bounds.json`);
            const bbox = await boundsRes.json();
            
            // Reproject bounding box from EPSG:32748 to WGS84
            const sw = proj4("EPSG:32748", "EPSG:4326", [bbox.left, bbox.bottom]);
            const ne = proj4("EPSG:32748", "EPSG:4326", [bbox.right, bbox.top]);
            const latLngBounds = [[sw[1], sw[0]], [ne[1], ne[0]]];
            
            // Setup 2D Layer
            if (!customLayers[layerId]) {
                const layer = L.imageOverlay(`${API_BASE}/${baseName}.png`, latLngBounds, { opacity: 0.8 });
                customLayers[layerId] = layer;
                layer.addTo(map);
                if (!is3DMode) map.fitBounds(latLngBounds);
            }
            
            // Setup 3D Layer
            if (viewer && !cesiumCustomLayers[layerId]) {
                try {
                    const provider = await Cesium.SingleTileImageryProvider.fromUrl(`${API_BASE}/${baseName}.png`, {
                        rectangle: Cesium.Rectangle.fromDegrees(sw[0], sw[1], ne[0], ne[1])
                    });
                    const cesiumLayer = viewer.imageryLayers.addImageryProvider(provider);
                    cesiumLayer.alpha = 0.8;
                    cesiumCustomLayers[layerId] = cesiumLayer;
                } catch (e) {
                    logTerminal(`3D raster layer error: ${e.message}`);
                }
            }
            
        } else if (layerId === 'batas' || layerId === 'sungai' || layerId === 'potensi' || layerId === 'lulc') {
            let styleOpt = {};
            let geojson = null;
            
            if (layerId === 'batas') {
                styleOpt = { color: '#ef4444', weight: 2, fillOpacity: 0.1 };
                const response = await fetch(API_BASE + '/data/geojson/BatasKecamatan.zip');
                const buffer = await response.arrayBuffer();
                geojson = await shp(buffer);
            } else if (layerId === 'lulc') {
                const response = await fetch(API_BASE + '/data/geojson/Landuse_KotaBandung (1).geojson');
                geojson = await response.json();
                styleOpt = function(feature) {
                    const gc = feature.properties.gridcode;
                    // 1: Badan Air, 2: Hutan, 3: Sawah, 4: Permukiman, 5: Kebun, 6: Lahan Kosong
                    const colors = { 1: '#3b82f6', 2: '#166534', 3: '#84cc16', 4: '#ef4444', 5: '#bef264', 6: '#fbbf24' };
                    return { color: colors[gc] || '#aaaaaa', weight: 0.5, fillOpacity: 0.6 };
                };
            } else {
                let fileName = layerId === 'sungai' ? 'Sungai_KotaBandung.geojson' : 'PotensiBanjir.geojson';
                styleOpt = layerId === 'sungai' ? { color: '#3b82f6', weight: 2 } : { color: '#f59e0b', weight: 0, fillOpacity: 0.5 };
                const response = await fetch(`${API_BASE}/data/geojson/${fileName}`);
                geojson = await response.json();
            }

            // Reproject on the fly
            geojson = reprojectGeoJSON(geojson);
                
            // Setup 2D Layer
            if (!customLayers[layerId]) {
                const layer = L.geoJSON(geojson, { style: styleOpt });
                customLayers[layerId] = layer;
                layer.addTo(map);
                if (!is3DMode) map.fitBounds(layer.getBounds());
            }
            
            // Setup 3D Layer
            if (viewer && !cesiumCustomLayers[layerId]) {
                try {
                    const dataSource = await Cesium.GeoJsonDataSource.load(geojson, {
                        stroke: layerId === 'batas' ? Cesium.Color.RED : (layerId === 'sungai' ? Cesium.Color.BLUE : Cesium.Color.ORANGE),
                        fill: layerId === 'batas' ? Cesium.Color.RED.withAlpha(0.1) : Cesium.Color.ORANGE.withAlpha(0.5),
                        strokeWidth: 3,
                        clampToGround: true
                    });
                    viewer.dataSources.add(dataSource);
                    cesiumCustomLayers[layerId] = dataSource;
                } catch (e) {
                    logTerminal(`3D vector layer error: ${e.message}`);
                }
            }
        }
        
        // Re-enable zoom after layer operations
        if (viewer) {
            viewer.scene.screenSpaceCameraController.enableZoom = true;
            viewer.scene.screenSpaceCameraController.enableRotate = true;
            viewer.scene.screenSpaceCameraController.enableTilt = true;
            viewer.resize();
        }
        
        logTerminal(`Layer ${layerId} loaded successfully.`);
    } catch (err) {
        logTerminal(`Error loading ${layerId}: ${err.message}`);
        console.error(err);
    }
}

let cesiumHandler = null;

function setupCesiumPicking() {
    if (!cesiumHandler && viewer) {
        cesiumHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        cesiumHandler.setInputAction(function (movement) {
            const pick = viewer.scene.pick(movement.position);
            const popup = document.getElementById('metadata-popup');
            const content = document.getElementById('metadata-content');
            
            // If clicking on a Shelter point or 3D Tileset feature
            if (Cesium.defined(pick)) {
                if (isShelterEvalMode || isWellMode) {
                    // Get coordinates
                    let cartesian = viewer.scene.pickPosition(movement.position);
                    if (!cartesian) {
                        const ray = viewer.camera.getPickRay(movement.position);
                        cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                    }
                    if (!cartesian) return;
                    
                    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                    const lng = Cesium.Math.toDegrees(cartographic.longitude);
                    const lat = Cesium.Math.toDegrees(cartographic.latitude);
                    
                    let depth = 0;
                    if (currentFloodData && currentFloodData.grid && currentFloodBounds) {
                        const south = currentFloodBounds[0][0];
                        const west = currentFloodBounds[0][1];
                        const north = currentFloodBounds[1][0];
                        const east = currentFloodBounds[1][1];
                        if (lat >= south && lat <= north && lng >= west && lng <= east) {
                            const row = Math.floor(((north - lat) / (north - south)) * currentFloodData.rows);
                            const col = Math.floor(((lng - west) / (east - west)) * currentFloodData.cols);
                            if (row >= 0 && row < currentFloodData.rows && col >= 0 && col < currentFloodData.cols) {
                                depth = currentFloodData.grid[row * currentFloodData.cols + col];
                            }
                        }
                    }

                    let isSuitable = false;
                    
                    if (isShelterEvalMode) {
                        isSuitable = depth < 0.3;
                        if (isSuitable) {
                            addCustomShelter(movement.position, pick);
                        } else {
                            alert(`Bangunan ini tidak aman untuk dijadikan shelter (Kedalaman Banjir: ${depth.toFixed(2)}m).`);
                        }
                    } else if (isWellMode) {
                        const heightStr = pick.getProperty ? (pick.getProperty('height') || pick.getProperty('Height') || pick.getProperty('tinggi') || '0') : '0';
                        const height = parseFloat(heightStr);
                        isSuitable = height < 2; // e.g., open space or low building
                        if (isSuitable) {
                            addCustomWell(movement.position, pick);
                        } else {
                            alert('Lokasi ini tidak cocok untuk sumur retensi (bukan area terbuka/rendah).');
                        }
                    }
                    return; // Stop further processing if in mode
                }

                if (pick.id && pick.id.properties && pick.id.properties.isShelter) {
                    const name = pick.id.properties.name.getValue();
                    const capacity = pick.id.properties.capacity.getValue();
                    
                    let html = '<table style="width:100%; border-collapse:collapse; margin-top:5px;">';
                    html += `<tr><td style="padding:4px 8px 4px 0; font-weight:bold; vertical-align:top; border-bottom:1px solid #1E2D4A;">Shelter Name</td><td style="padding:4px 0; border-bottom:1px solid #1E2D4A; word-break:break-word;">${name}</td></tr>`;
                    html += `<tr><td style="padding:4px 8px 4px 0; font-weight:bold; vertical-align:top; border-bottom:1px solid #1E2D4A;">Capacity</td><td style="padding:4px 0; border-bottom:1px solid #1E2D4A; word-break:break-word;">${capacity} Evacuees</td></tr>`;
                    html += '</table>';
                    
                    document.getElementById('metadata-popup').querySelector('h4').innerText = 'Public Shelter Info';
                    content.innerHTML = html;
                    popup.style.display = 'block';
                    popup.style.left = (movement.position.x + 15) + 'px';
                    popup.style.top = (movement.position.y + 15) + 'px';
                } else if (pick.getPropertyIds) {
                    const propertyIds = pick.getPropertyIds();
                    document.getElementById('metadata-popup').querySelector('h4').innerText = 'Building Metadata';
                    let html = '<table style="width:100%; border-collapse:collapse; margin-top:5px;">';
                    let hasData = false;
                    propertyIds.forEach(id => {
                        const val = pick.getProperty(id);
                        if(val !== null && val !== undefined && val !== '') {
                            html += `<tr><td style="padding:4px 8px 4px 0; font-weight:bold; vertical-align:top; border-bottom:1px solid #1E2D4A;">${id}</td><td style="padding:4px 0; border-bottom:1px solid #1E2D4A; word-break:break-word;">${val}</td></tr>`;
                            hasData = true;
                        }
                    });
                    html += '</table>';
                    
                    if (hasData) {
                        content.innerHTML = html;
                        popup.style.display = 'block';
                        popup.style.left = (movement.position.x + 15) + 'px';
                        popup.style.top = (movement.position.y + 15) + 'px';
                    } else {
                        popup.style.display = 'none';
                    }
                } else {
                    popup.style.display = 'none';
                }
            } else {
                popup.style.display = 'none';
                
                if (isShelterEvalMode || isWellMode) return; // Do nothing if clicking empty ground in mode

                // If not clicking a building, trigger evacuation routing from 3D ground!
                const ray = viewer.camera.getPickRay(movement.position);
                const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                if (cartesian) {
                    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                    const lng = Cesium.Math.toDegrees(cartographic.longitude);
                    const lat = Cesium.Math.toDegrees(cartographic.latitude);
                    
                    // Call the routing logic
                    requestEvacuationRoute(lat, lng);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        cesiumHandler.setInputAction(function (movement) {
            if (!isShelterEvalMode && !isWellMode) {
                if (highlightedFeature) {
                    highlightedFeature.color = originalColor || Cesium.Color.WHITE;
                    highlightedFeature = null;
                }
                return;
            }
            
            const pick = viewer.scene.pick(movement.endPosition);
            if (Cesium.defined(pick) && pick.getPropertyIds) {
                let cartesian = viewer.scene.pickPosition(movement.endPosition);
                if (!cartesian) {
                    const ray = viewer.camera.getPickRay(movement.endPosition);
                    cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                }
                
                let isSuitable = false;
                
                if (isShelterEvalMode) {
                    let depth = 0;
                    if (cartesian && currentFloodData && currentFloodData.grid && currentFloodBounds) {
                        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                        const lng = Cesium.Math.toDegrees(cartographic.longitude);
                        const lat = Cesium.Math.toDegrees(cartographic.latitude);
                        const south = currentFloodBounds[0][0], west = currentFloodBounds[0][1];
                        const north = currentFloodBounds[1][0], east = currentFloodBounds[1][1];
                        if (lat >= south && lat <= north && lng >= west && lng <= east) {
                            const row = Math.floor(((north - lat) / (north - south)) * currentFloodData.rows);
                            const col = Math.floor(((lng - west) / (east - west)) * currentFloodData.cols);
                            if (row >= 0 && row < currentFloodData.rows && col >= 0 && col < currentFloodData.cols) {
                                depth = currentFloodData.grid[row * currentFloodData.cols + col];
                            }
                        }
                    }
                    isSuitable = depth < 0.3;
                }
                
                if (isWellMode) {
                    const heightStr = pick.getProperty('height') || pick.getProperty('Height') || pick.getProperty('tinggi') || '0';
                    const height = parseFloat(heightStr);
                    isSuitable = height < 2; 
                }
                
                if (highlightedFeature && highlightedFeature !== pick) {
                    highlightedFeature.color = originalColor || Cesium.Color.WHITE;
                }
                
                if (highlightedFeature !== pick) {
                    originalColor = pick.color ? pick.color.clone() : Cesium.Color.WHITE;
                    highlightedFeature = pick;
                    pick.color = isSuitable ? Cesium.Color.GREEN.withAlpha(0.6) : Cesium.Color.RED.withAlpha(0.6);
                }
            } else {
                if (highlightedFeature) {
                    highlightedFeature.color = originalColor || Cesium.Color.WHITE;
                    highlightedFeature = null;
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }
}

// ---------------- 3D ENVIRONMENT ----------------
function updateSunlight(hoursStr) {
    const hours = parseFloat(hoursStr);
    
    // Update label text
    const label = document.getElementById('sunlight-label');
    if (label) {
        let h = Math.floor(hours);
        let m = Math.floor((hours - h) * 60);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        label.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    }

    if (!viewer) return;

    // Set Cesium clock
    // Base date (e.g. today or some specific date)
    const date = new Date();
    date.setUTCHours(hours - 7, Math.floor((hours % 1) * 60), 0, 0); // Bandung is UTC+7
    
    const julianDate = Cesium.JulianDate.fromDate(date);
    viewer.clock.currentTime = julianDate;
    
    // Ensure globe lighting is on
    viewer.scene.globe.enableLighting = true;
    viewer.scene.light = new Cesium.SunLight();
}

// ---------------- CESIUM 3D INTEGRATION ----------------

let isUIHidden = false;
function toggleUI() {
    isUIHidden = !isUIHidden;
    const btn = document.getElementById('btn-toggle-ui');
    const displayStyle = isUIHidden ? 'none' : '';
    
    const sidebarLeft = document.querySelector('.sidebar-left');
    const panelRight = document.querySelector('.panel-right');
    const floatingToolbar = document.getElementById('floating-toolbar-left');
    const btnRakit = document.getElementById('btn-rakit-text');
    
    if (sidebarLeft) sidebarLeft.style.display = displayStyle;
    if (panelRight) panelRight.style.display = displayStyle;
    
    if (isUIHidden) {
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><polyline points="11 16 15 12 11 8"></polyline></svg>';
        btn.setAttribute('data-tooltip', 'Show UI');
        btn.style.background = '#65a30d'; // green
        
        if (floatingToolbar) floatingToolbar.style.left = '15px';
        if (btnRakit) btnRakit.style.display = 'flex';
    } else {
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><polyline points="15 16 11 12 15 8"></polyline></svg>';
        btn.setAttribute('data-tooltip', 'Hide UI');
        btn.style.background = '#64748b'; // slate
        
        if (floatingToolbar) floatingToolbar.style.left = '320px';
        if (btnRakit) btnRakit.style.display = 'none';
    }
}

async function toggle3DMode() {
    is3DMode = !is3DMode;
    const btn = document.getElementById('btn-toggle-3d');
    const mapDiv = document.getElementById('map');
    const cesiumDiv = document.getElementById('cesiumContainer');
    
    if (is3DMode) {
        btn.innerHTML = '<i class="ph ph-map-trifold"></i>';
        btn.setAttribute('data-tooltip', 'View in 2D');
        btn.style.background = '#ef4444'; // Red for returning to 2D
        mapDiv.style.display = 'none';
        cesiumDiv.style.display = 'block';
        
        document.getElementById('btn-shelter-eval').style.display = 'flex';
        document.getElementById('btn-well-recommend').style.display = 'flex';

        // Force Cesium to recalculate container size for proper zoom/interaction
        setTimeout(() => {
            if (viewer) viewer.resize();
        }, 100);

        if (!viewer) {
            initCesium();
        } else {
            // If already initialized, just sync current state
            syncFloodTo3D();
        }
    } else {
        btn.innerHTML = '<i class="ph ph-cube"></i>';
        btn.setAttribute('data-tooltip', 'View in 3D');
        btn.style.background = '#3b82f6';
        mapDiv.style.display = 'block';
        cesiumDiv.style.display = 'none';
        
        document.getElementById('btn-shelter-eval').style.display = 'none';
        document.getElementById('btn-well-recommend').style.display = 'none';
        isShelterEvalMode = false;
        isWellMode = false;
        document.getElementById('btn-shelter-eval').style.background = '#16a34a';
        document.getElementById('btn-well-recommend').style.background = '#0369a1';
        
        if (imageOverlayLayer) map.fitBounds(currentFloodBounds);
    }
}

async function initCesium() {
    logTerminal('Initializing Cesium 3D Globe...');
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMTE4NmU3Zi1lNTZiLTQ5ZWMtODE2NC04Mzc4NGEyNzg4ZjkiLCJpZCI6MzYzMjYxLCJpYXQiOjE3NjM5NzA2MzZ9.tNWEzpcqUk_30lqJ7MpMOgjEXr6FoSwySddemUibUS8';
    
    // Load World Terrain to prevent floating buildings (Bandung is ~700m above sea level)
    let terrainProvider;
    try {
        terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
    } catch (e) {
        logTerminal('Terrain failed, using flat ellipsoid.');
        terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }

    // Custom Nominatim Geocoder for Indonesian place names
    class NominatimGeocoder {
        get autoComplete() { return true; }
        
        async geocode(input) {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input + ', Bandung, Indonesia')}&limit=5&addressdetails=1`;
            try {
                const response = await fetch(url, {
                    headers: { 'Accept-Language': 'id,en' }
                });
                const results = await response.json();
                return results.map(r => {
                    const west = parseFloat(r.boundingbox[2]);
                    const south = parseFloat(r.boundingbox[0]);
                    const east = parseFloat(r.boundingbox[3]);
                    const north = parseFloat(r.boundingbox[1]);
                    return {
                        displayName: r.display_name,
                        destination: Cesium.Rectangle.fromDegrees(west, south, east, north)
                    };
                });
            } catch (e) {
                console.error('Geocoding error:', e);
                return [];
            }
        }
    }

    // Create viewer with Nominatim geocoder for location search
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: terrainProvider,
        animation: false,
        timeline: false,
        navigationHelpButton: false,
        baseLayerPicker: true,
        homeButton: true,
        sceneModePicker: false,
        fullscreenButton: false,
        geocoder: new NominatimGeocoder(),
        infoBox: false,
        selectionIndicator: false,
        shadows: true // Mengaktifkan bayangan matahari
    });
    
    // Scene configuration
    viewer.scene.screenSpaceCameraController.enableInputs = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;
    viewer.scene.screenSpaceCameraController.enableLook = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.enableLighting = true; // Mengaktifkan efek cahaya matahari (siang/malam)
    
    // Camera will automatically fly to the loaded tileset later
    
    // Fly to Gedung Sate (Bandung area)
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(107.61873739258844, -6.902858684813618, 2000),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-45.0),
        },
        duration: 3
    });
    logTerminal('Flying to Gedung Sate, Bandung...');
    
    // Add OSM 3D Buildings
    try {
        const buildingTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingTileset);
        logTerminal('✓ OSM 3D Buildings loaded.');
    } catch (e) {
        logTerminal(`✗ OSM Buildings failed: ${e.message}`);
        console.error('[Cesium] OSM Buildings error:', e);
    }
    
    syncFloodTo3D();
    
    for (const id of ['gfidas', 'lulc', 'batas', 'sungai', 'potensi']) {
        const cb = document.querySelector(`input[onchange="toggleCustomLayer('${id}', this.checked)"]`);
        if (cb && cb.checked) await toggleCustomLayer(id, true);
    }
    
    viewer.resize();
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    setupCesiumPicking();
    drawShelters3D();
    logTerminal('Cesium 3D ready.');
}

// ============== ML PREDICTION MODULE ==============
let realRoadLayer = null;

async function checkMLStatus() {
    try {
        const res = await fetch(API_BASE + '/api/ml/status');
        const data = await res.json();
        const indicator = document.getElementById('ml-status-indicator');
        if (data.model_loaded) {
            indicator.innerHTML = '✅ ML Service: Connected | Model loaded';
            indicator.style.background = '#064e3b';
            indicator.style.color = '#6ee7b7';
        } else if (data.error) {
            indicator.innerHTML = '❌ ML Service: Offline';
            indicator.style.background = '#7f1d1d';
            indicator.style.color = '#fca5a5';
        }
    } catch (e) {
        const indicator = document.getElementById('ml-status-indicator');
        indicator.innerHTML = '❌ ML Service: Offline - Start Python service first';
        indicator.style.background = '#7f1d1d';
        indicator.style.color = '#fca5a5';
    }
}

async function runMLPrediction() {
    const rainfall = parseFloat(document.getElementById('ml-rainfall').value);
    const rain3day = parseFloat(document.getElementById('ml-rain3day').value);
    const rain7day = parseFloat(document.getElementById('ml-rain7day').value);
    const season = parseInt(document.getElementById('ml-season').value);
    
    logTerminal(`[ML] Predicting flood risk for ${rainfall} mm rainfall...`);
    
    try {
        const res = await fetch(API_BASE + '/api/ml/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rainfall_mm: rainfall,
                rain_3day_avg: rain3day,
                rain_7day_avg: rain7day,
                season: season
            })
        });
        
        const result = await res.json();
        
        if (result.error) {
            logTerminal(`[ML] Error: ${result.error}`);
            alert('ML Service error: ' + result.error);
            return;
        }
        
        // Display result
        const resultDiv = document.getElementById('ml-result');
        const riskDiv = document.getElementById('ml-risk-level');
        const depthDiv = document.getElementById('ml-depth');
        const adviceDiv = document.getElementById('ml-advice');
        
        resultDiv.style.display = 'block';
        resultDiv.style.background = result.color + '22';
        resultDiv.style.border = `1px solid ${result.color}`;
        
        const riskIcons = { SAFE: '✅', WARNING: '⚠️', DANGER: '🔶', CRITICAL: '🚨' };
        window.currentFloodRisk = result.risk_level;
        riskDiv.innerHTML = `${riskIcons[result.risk_level] || ''} ${result.risk_level}`;
        riskDiv.style.color = result.color;
        
        depthDiv.innerHTML = `Predicted Depth: <strong>${result.predicted_depth_m.toFixed(3)} m</strong>`;
        depthDiv.style.color = 'white';
        
        if (result.evacuate) {
            adviceDiv.innerHTML = '⚡ EVACUATION RECOMMENDED - Activate emergency routes immediately';
            adviceDiv.style.color = result.color;
        } else {
            adviceDiv.innerHTML = 'Conditions within safe limits. Continue monitoring.';
        }
        
        // Auto-show flood zones if risk is high
        if (result.risk_level === 'WARNING' || result.risk_level === 'CRITICAL' || result.risk_level === 'DANGER') {
            const cb = document.querySelector(`input[onchange="toggleCustomLayer('potensi', this.checked)"]`);
            if (cb && !cb.checked) {
                cb.checked = true;
                toggleCustomLayer('potensi', true);
            }
        } else {
            const cb = document.querySelector(`input[onchange="toggleCustomLayer('potensi', this.checked)"]`);
            if (cb && cb.checked) {
                cb.checked = false;
                toggleCustomLayer('potensi', false);
            }
        }
        
        logTerminal(`[ML] Prediction: ${result.predicted_depth_m.toFixed(3)}m depth | Risk: ${result.risk_level} | Evacuate: ${result.evacuate ? 'YES' : 'No'}`);
        
    } catch (e) {
        logTerminal(`[ML] Connection error: ${e.message}. Is the ML service running?`);
        alert('Cannot connect to ML service. Please start it with:\nenv\\Scripts\\python.exe ml\\ml_service.py');
    }
}

async function loadRealRoads() {
    const statusDiv = document.getElementById('road-status');
    statusDiv.innerHTML = '⏳ Loading 14,749 road segments...';
    logTerminal('[Roads] Loading real Bandung road network...');
    
    try {
        const res = await fetch(API_BASE + '/api/roads/real');
        const geojson = await res.json();
        
        if (geojson.error) {
            statusDiv.innerHTML = '❌ ' + geojson.error;
            return;
        }
        
        // Remove old road layer if exists
        if (realRoadLayer) {
            map.removeLayer(realRoadLayer);
        }
        
        realRoadLayer = L.geoJSON(geojson, {
            style: {
                color: '#60a5fa',
                weight: 1.5,
                opacity: 0.6
            }
        }).addTo(map);
        
        const featureCount = geojson.features ? geojson.features.length : 0;
        statusDiv.innerHTML = `✅ ${featureCount.toLocaleString()} road segments loaded`;
        logTerminal(`[Roads] ${featureCount} real road segments loaded successfully.`);
        
    } catch (e) {
        statusDiv.innerHTML = '❌ Error loading roads';
        logTerminal(`[Roads] Error: ${e.message}`);
    }
}

// ============== SHELTERS & SEARCH IN 3D ==============

function drawShelters3D() {
    if (!viewer) return;
    shelters.forEach(s => {
        viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(s.lng, s.lat, 0),
            point: {
                pixelSize: 14,
                color: Cesium.Color.fromCssColorString('#ff9800'),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY // Always visible through buildings
            },
            properties: {
                isShelter: true,
                name: s.name,
                capacity: s.capacity
            }
        });
    });
}

async function searchLocation3D(query) {
    if (!query) return;
    if (!viewer) {
        alert("Harap tunggu hingga peta 3D termuat.");
        return;
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Bandung, Indonesia')}&limit=1`;
    try {
        logTerminal(`Searching for: ${query}...`);
        const res = await fetch(url, { headers: { 'Accept-Language': 'id,en' } });
        const data = await res.json();
        if (data.length > 0) {
            const r = data[0];
            const west = parseFloat(r.boundingbox[2]);
            const south = parseFloat(r.boundingbox[0]);
            const east = parseFloat(r.boundingbox[3]);
            const north = parseFloat(r.boundingbox[1]);
            viewer.camera.flyTo({
                destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
                duration: 2
            });
            logTerminal(`📍 Found: ${r.display_name}`);
        } else {
            alert("Lokasi tidak ditemukan.");
            logTerminal(`✗ Search failed: Location not found.`);
        }
    } catch (e) {
        console.error(e);
        alert("Terjadi kesalahan saat mencari lokasi.");
    }
}

// ============== OPENWEATHERMAP REAL-TIME WEATHER ==============
let liveWeatherData = null;

async function fetchLiveWeather() {
    const widget = document.getElementById('weather-widget');
    const btnUseLive = document.getElementById('btn-use-live-rain');
    
    widget.innerHTML = '<p style="color: #64748b; font-size: 12px;">⏳ Fetching weather data...</p>';
    
    try {
        const res = await fetch(API_BASE + '/api/weather/realtime');
        const data = await res.json();
        
        if (data.error) {
            widget.innerHTML = `
                <div style="text-align: left;">
                    <p style="color: #ef4444; font-size: 12px;">⚠ ${data.error}</p>
                    <p style="color: #64748b; font-size: 11px; margin-top: 5px;">${data.help || 'Check server configuration.'}</p>
                </div>
            `;
            btnUseLive.style.display = 'none';
            return;
        }
        
        liveWeatherData = data;
        
        const weatherIcon = `https://openweathermap.org/img/wn/${data.weather.icon}@2x.png`;
        const rainText = data.rain.last1h > 0 
            ? `<span style="color: #60a5fa; font-weight: 600;">${data.rain.last1h} mm/h</span>` 
            : '<span style="color: #94a3b8;">0 mm (no rain)</span>';
        
        widget.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
                <img src="${weatherIcon}" alt="${data.weather.description}" style="width: 50px; height: 50px; filter: drop-shadow(0 0 4px rgba(96,165,250,0.4));">
                <div>
                    <p style="font-size: 14px; font-weight: 600; color: #fff; text-transform: capitalize; margin-bottom: 2px;">${data.weather.description}</p>
                    <p style="font-size: 11px; color: #94a3b8;">${data.localTime}</p>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; text-align: left;">
                <div style="background: rgba(30,45,74,0.7); padding: 6px 8px; border-radius: 4px;">
                    <p style="font-size: 10px; color: #64748b;">🌡 Temp</p>
                    <p style="font-size: 13px; color: #fff; font-weight: 600;">${data.temperature.current}°C</p>
                </div>
                <div style="background: rgba(30,45,74,0.7); padding: 6px 8px; border-radius: 4px;">
                    <p style="font-size: 10px; color: #64748b;">💧 Humidity</p>
                    <p style="font-size: 13px; color: #fff; font-weight: 600;">${data.temperature.humidity}%</p>
                </div>
                <div style="background: rgba(30,45,74,0.7); padding: 6px 8px; border-radius: 4px;">
                    <p style="font-size: 10px; color: #64748b;">🌧 Rainfall (1h)</p>
                    <p style="font-size: 13px;">${rainText}</p>
                </div>
                <div style="background: rgba(30,45,74,0.7); padding: 6px 8px; border-radius: 4px;">
                    <p style="font-size: 10px; color: #64748b;">💨 Wind</p>
                    <p style="font-size: 13px; color: #fff; font-weight: 600;">${data.wind.speed} m/s</p>
                </div>
            </div>
        `;
        
        // Show "Use Live Rainfall" button
        btnUseLive.style.display = 'block';
        if (data.rain.last1h > 0) {
            btnUseLive.textContent = `⬇ Use Live Rainfall: ${data.rain.last1h} mm`;
            btnUseLive.style.background = '#facc15';
        } else {
            btnUseLive.textContent = '☀ No Rain — Use 0 mm';
            btnUseLive.style.background = '#475569';
            btnUseLive.style.color = '#fff';
        }
        
        logTerminal(`[Weather] Live data: ${data.weather.description}, ${data.temperature.current}°C, Rain: ${data.rain.last1h}mm/h`);
        
    } catch (err) {
        widget.innerHTML = `
            <div style="text-align: left;">
                <p style="color: #ef4444; font-size: 12px;">❌ Connection failed</p>
                <p style="color: #64748b; font-size: 11px; margin-top: 5px;">${err.message}</p>
            </div>
        `;
        btnUseLive.style.display = 'none';
        logTerminal(`[Weather] Error: ${err.message}`);
    }
}

function useLiveRainfall() {
    if (!liveWeatherData) {
        alert('Weather data is not available yet. Please click Refresh first.');
        return;
    }
    const rainfall = liveWeatherData.rain.last1h;
    const inputRainfall = document.getElementById('input-rainfall');
    inputRainfall.value = rainfall;
    inputRainfall.disabled = false;
    
    logTerminal(`[Weather] ✓ Live rainfall applied: P = ${rainfall} mm`);
    
    // Visual feedback
    inputRainfall.style.transition = 'box-shadow 0.3s ease';
    inputRainfall.style.boxShadow = '0 0 8px rgba(250, 204, 21, 0.8)';
    setTimeout(() => { inputRainfall.style.boxShadow = 'none'; }, 2000);
}

// Auto-fetch weather on page load
setTimeout(fetchLiveWeather, 1500);

// Auto-refresh weather every 10 minutes
setInterval(fetchLiveWeather, 10 * 60 * 1000);

// Check ML status on page load
setTimeout(checkMLStatus, 2000);
let isShelterEvalMode = false;
let isWellMode = false;
let highlightedFeature = null;
let originalColor = null;

function toggleShelterEvalMode() {
    isShelterEvalMode = !isShelterEvalMode;
    const btn = document.getElementById('btn-shelter-eval');
    if (isShelterEvalMode) {
        isWellMode = false;
        document.getElementById('btn-well-recommend').style.background = '#0369a1';
        btn.style.background = '#f59e0b'; // warning/active color
        alert('Mode Evaluasi Shelter AKTIF. Arahkan kursor ke bangunan (Hijau = cocok, Merah = kurang cocok) dan klik untuk memilih.');
    } else {
        btn.style.background = '#16a34a';
    }
}

function toggleWellMode() {
    isWellMode = !isWellMode;
    const btn = document.getElementById('btn-well-recommend');
    if (isWellMode) {
        isShelterEvalMode = false;
        document.getElementById('btn-shelter-eval').style.background = '#16a34a';
        btn.style.background = '#f59e0b';
        alert('Mode Sumur Retensi AKTIF. Arahkan kursor ke area (Hijau = rendah/cocok) dan klik untuk merekomendasikan sumur.');
    } else {
        btn.style.background = '#0369a1';
    }
}

function addCustomShelter(position, pick) {
    const ray = viewer.camera.getPickRay(position);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) return;
    
    viewer.entities.add({
        position: cartesian,
        billboard: {
            image: 'https://cdn-icons-png.flaticon.com/512/1043/1043414.png',
            width: 32,
            height: 32,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        properties: {
            isShelter: true,
            name: 'Shelter Tambahan',
            capacity: 500
        }
    });
    logTerminal('Shelter alternatif berhasil ditambahkan.');
}

function addCustomWell(position, pick) {
    const ray = viewer.camera.getPickRay(position);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) return;
    
    viewer.entities.add({
        position: cartesian,
        billboard: {
            image: 'https://cdn-icons-png.flaticon.com/512/820/820793.png',
            width: 32,
            height: 32,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        properties: {
            isWell: true,
            name: 'Sumur Retensi'
        }
    });
    logTerminal('Sumur retensi berhasil direncanakan di lokasi ini.');
}

// Ensure initCesium clears highlightedFeature if necessary
