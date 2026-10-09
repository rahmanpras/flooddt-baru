# RAKIT — City Digital Twin for Adaptive Flood Evacuation (Bandung)

This repository contains the prototype and the complete executable configuration behind the manuscript

> A. Prasetyadi, A. S. Prihatmanto, R. Sutriadi, A. Hadiana, A. Yoganingrum, and R. Andrian,
> “City Digital Twin for Adaptive Flood Evacuation Based on Hydrological–Hydrodynamic Simulation”,
> submitted to the *International Journal of Intelligent Engineering and Systems* (IJIES), paper ID 20265129.

The state that corresponds to the manuscript is frozen at the release tag **`ijies-revision-2`**
(https://github.com/rahmanpras/flooddt-baru/releases/tag/ijies-revision-2). Later commits may change the code; use the
tag to reproduce the reported numbers. (`ijies-revision-1` is the state of the previous revision round, before the
mode-specific robustness analysis was added.)

The prototype couples SCS Curve Number runoff, a two-dimensional diffusion-wave inundation model, and a flood-aware
multi-shelter Dijkstra router, with a 2D (Leaflet.js) and 3D (CesiumJS) web interface. It is a research prototype for
offline scenario planning, not validated operational decision support (see Section 4.9 of the manuscript).

## Repository layout

| Path | Content |
|---|---|
| `frontend/` | Web client: Leaflet.js 2D map, CesiumJS 3D view, control panel (`index.html`, `app.js`, `styles.css`, `analytics.html`) |
| `backend/server.js` | Node.js/Express server: SCS-CN runoff, diffusion-wave hydrodynamics (`/api/simulation/hydraulics`), flood-aware routing (`/api/evacuation/route`), weather proxy, proxy to the worker; also serves `frontend/` |
| `backend/data/` | Input data (terrain, land cover, Curve Numbers, roads, rivers, boundaries, rainfall, validation map) |
| `backend/convert_dtm.py`, `backend/convert_cn.py` | Preprocessing of the terrain and Curve Number grids |
| `backend/validate_flood.py` | Spatial validation against the BPBD flood map (CSI, POD, FAR, accuracy) |
| `backend/tools/` | Diagnostic scripts used during development (raster inspection, map plots); not needed for any reported result |
| `worker/` | Python machine-learning service (Flask, port 5000): auxiliary Gradient Boosting early-warning module with data preparation, training script, and trained weights in `worker/models/` |
| `config/production_config.json` | Canonical production configuration (Table 18 of the manuscript) |
| `experiments/` | Controlled routing evaluation and its mode-specific robustness analysis, timing, functional routing tests, table and figure scripts; outputs in `experiments/results/` |

## Requirements

* Node.js 22 (tested with 22.18) — `cd backend && npm install`
* Python 3.12 — `pip install -r worker/requirements.txt -r experiments/requirements.txt`
  (on Windows the scripts were run from a virtual environment at `env/` in the repository root)

If GDAL/PROJ from another installation (for example PostGIS) is on the path, rasterio may fail with a `proj.db` version
error; the scripts therefore pass coordinate systems as proj strings.

The 3D view uses a Cesium ion access token in `frontend/app.js`; replace it with your own token. The live-weather panel
needs an OpenWeatherMap key in the environment variable `OWM_API_KEY` (not required for any reported result).

## Data and preparation

| File (under `backend/data/`) | Source | Use |
|---|---|---|
| `raster/DTMUTM.tif` | DEMNAS, Geospatial Information Agency (BIG), EPSG:32748 | Terrain |
| `raster/dtm_bandung_wgs84.bin/.json` | `convert_dtm.py` | Model terrain grid (820 × 853 cells, ≈16.8 m × 16.2 m) |
| `raster/lulckotabandung24.tif` | Land-cover map of Bandung (2024) | Curve Numbers and Manning roughness |
| `raster/cn_grid_bandung_wgs84.bin` | `convert_cn.py` | Curve Number grid on the model grid |
| `roads/bandung_roads_real.geojson` | OpenStreetMap | Road graph (49,921 nodes, 110,268 directed edges, built at the first routing request) |
| `geojson/` | BIG / local government | Rivers, subdistrict boundaries, land use, flood-hazard polygons |
| `rainfall/` | BMKG station records, 2016–2021 | Return-period analysis and ML features |
| `validation/PotensiBanjirBandung (1).tif` | BPBD Kota Bandung flood map | Spatial validation reference |

Regenerate the model grids from the source rasters:

```bash
python backend/convert_dtm.py          # resample DTMUTM.tif (cell average) onto the model grid
python backend/convert_cn.py --check   # confirm the Curve Number grid (writes it without --check)
```

The model grid covers 107.53–107.66° E and 6.86–6.98° S. Cells outside the DTM coverage take the nearest valid
elevation, and cells outside the land-cover map take CN 85.

**Data that are not redistributed.** The 3D building tiles (LOD 1–2, Bandung City Spatial Planning, Construction, and
Human Settlements Agency) are served as a Cesium ion asset and are not part of this repository; they are needed only
for the 3D view, not for any reported number. Users who obtain the original data from the agencies above should place
them at the paths listed in the table and rerun `convert_dtm.py` and `convert_cn.py`.

## Running the prototype

```bash
cd backend && npm install && node server.js    # http://localhost:3001 (serves the frontend)
python worker/ml_service.py                    # optional auxiliary ML service on port 5000
```

## Reproducing the reported results

Run the commands from the repository root. Start `node backend/server.js` (or `cd backend && node server.js`) for the
scripts marked *server*. All other scripts are standalone.

| Manuscript item | Command | Output |
|---|---|---|
| Table 6 (runoff) | `python experiments/runoff_table.py` | printed table |
| Table 7 and Section 4.3.1 (hydrodynamic runtime, 10 runs) — *server* | `bash experiments/hydro_timing.sh` | `experiments/results/hydro_timing_P137_rerun.csv` |
| Table 9 (functional routing tests) — *server* | `node experiments/functional_routing_tests.js` | `experiments/results/functional_routing_P137_geofix.json` |
| Tables 5, 11–13, binary-heap check (controlled routing evaluation) | `node experiments/synthetic_routing_eval.js`, then `python experiments/analyze_results.py` | `experiments/results/` (`design.json`, `runs.csv`, `checks.json`, `summary.md`, `rasters/`) |
| Table 14 (ranking under mode-specific hazard limits; needs the outputs of the previous row) | `node experiments/mode_criteria_robustness.js` | `experiments/results/mode_robustness_runs.csv`, `mode_robustness_summary.json`, `mode_robustness_summary.md` |
| Table 15 (spatial validation) — *server* | `python backend/validate_flood.py` | `backend/data/validation/results.json` |
| Table 16 (ML predictor) | `python worker/prepare_data.py`, then `python worker/train_real_data.py` | `worker/models/` |
| Fig. 1, Fig. 2 | `python experiments/plot_fig1.py`, `python experiments/plot_fig2.py` | `experiments/results/*.png` |

Notes:

* The archived outputs in `experiments/results/` and `backend/data/validation/results.json` are the files that
  produced the numbers in the manuscript. `hydro_timing_P137_geofix.csv` is the runtime series reported after the
  terrain correction (31.0 ± 1.0 s; measured on mains power without concurrent workload); `hydro_timing_P137.csv` is
  the series measured before the terrain correction, and `hydro_timing_P137_contaminated.csv` is an exploratory series
  recorded under concurrent load; neither is reported.
* The controlled routing evaluation fixes all design parameters in the `CFG` block of
  `experiments/synthetic_routing_eval.js`. Origins are chosen deterministically (stratified grid, farthest-point
  subset), so the run needs no random seed. `--quick` runs one timing repetition only.
* The ML model in `worker/models/` was trained by `worker/train_real_data.py` (Gradient Boosting, 300 estimators,
  maximum depth 5, learning rate 0.05, subsample 0.8, `random_state = 42`, 80/20 split). It is auxiliary and is not
  used by any routing result.
* The mode-specific robustness analysis takes depth limits from the flood hazard vulnerability classes of the
  Australian Institute for Disaster Resilience (Guideline 7-3, 2017): 0.30 m for small vehicles (cars; motorcycles
  assigned here), 0.50 m for large vehicles and for children and the elderly on foot, and 1.20 m for able-bodied adults
  on foot. It scales the depth bands of scenarios S1–S4 by 0.5, 0.75, 1, 1.5, and 2 (0.75 was added after a first run,
  as noted in the script header) and checks, at scale 1, that rasters and routes equal the archived main experiment.
  The deployed router still uses one closure depth (0.50 m) for every mode.
* The deployed routing endpoint uses a linear-scan Dijkstra; the binary-heap search used for the timing results of the
  controlled evaluation lives in `experiments/synthetic_routing_eval.js` and returns identical optimal costs.
* The deployed-endpoint latencies in Table 8 are single instrumented runs and are reported as indicative only.

## Known limitations

* Physical validation against the BPBD map is low (CSI 0.0547, POD 0.0700, FAR 0.7994); the model is not calibrated
  against matched flood events.
* The road graph does not represent bridges, so stream crossings can be blocked by water simulated in the valley
  beneath them (Table 9).
* Depth-penalty thresholds are configuration parameters, not calibrated hazard criteria.

## Contact

Abdurrakhman Prasetyadi and Ary Setijadi Prihatmanto, School of Electrical Engineering and Informatics,
Bandung Institute of Technology (ary.setijadi@itb.ac.id).
