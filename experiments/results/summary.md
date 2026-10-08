## Table A. Results per scenario and method (median [IQR] over returned routes; counts over all 40 origins)

| Scenario | Method | n | Route length (km) | Cumulative exposure E (m²) | Max depth (m) | Inundated length (m) | Route returned | No route (diagnostic) | Reaches shelter under evaluation rule (d ≤ 0.3 m) | Reference reachable | Query time (ms) | E mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S0 | Distance-based Dijkstra | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 0.8 [0.5–1.2] | 0.0 |
| S0 | Proposed flood-aware | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 1.7 [1.1–3.5] | 0.0 |
| S0 | Adapted An et al. [18] | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 2.2 [1.1–3.6] | 0.0 |
| S1 | Distance-based Dijkstra | 40 | 3.44 [2.22–4.43] | 83.8 [0.0–99.8] | 0.30 [0.00–0.30] | 389 [0–490] | 40 | 0 | 40/40 (100%) | 40 | 0.8 [0.6–1.3] | 70.8 |
| S1 | Proposed flood-aware | 40 | 3.66 [2.28–4.84] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 2.6 [1.2–5.4] | 1.7 |
| S1 | Adapted An et al. [18] | 40 | 3.59 [2.23–4.44] | 0.0 [0.0–14.0] | 0.00 [0.00–0.10] | 0 [0–140] | 40 | 0 | 40/40 (100%) | 40 | 2.2 [1.2–4.3] | 16.8 |
| S2 | Distance-based Dijkstra | 40 | 3.44 [2.22–4.43] | 184.8 [0.0–221.6] | 0.60 [0.00–0.60] | 389 [0–490] | 40 | 0 | 18/40 (45%) | 40 | 1.0 [0.6–1.2] | 155.7 |
| S2 | Proposed flood-aware | 40 | 3.66 [2.28–4.84] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 2.8 [1.4–5.0] | 0.0 |
| S2 | Adapted An et al. [18] | 40 | 3.59 [2.23–4.44] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 33/40 (82%) | 40 | 2.4 [1.3–4.8] | 36.8 |
| S3 | Distance-based Dijkstra | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–183.2] | 0.00 [0.00–0.60] | 0 [0–305] | 40 | 0 | 26/40 (65%) | 40 | 0.8 [0.6–1.5] | 75.1 |
| S3 | Proposed flood-aware | 40 | 4.08 [2.25–5.65] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 3.5 [1.4–9.5] | 0.0 |
| S3 | Adapted An et al. [18] | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–183.2] | 0.00 [0.00–0.60] | 0 [0–305] | 40 | 0 | 26/40 (65%) | 40 | 2.7 [1.4–4.1] | 75.1 |
| S4 | Distance-based Dijkstra | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 33/40 (82%) | 34 | 0.7 [0.4–1.4] | 29.0 |
| S4 | Proposed flood-aware | 40 | 3.44 [2.20–4.42] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 34 | 6 | 34/40 (85%) | 34 | 1.5 [0.7–2.9] | 0.0 |
| S4 | Adapted An et al. [18] | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 33/40 (82%) | 34 | 2.0 [1.2–3.4] | 29.1 |
| S2b | Distance-based Dijkstra | 40 | 3.44 [2.22–4.43] | 251.5 [0.0–299.5] | 0.90 [0.00–0.90] | 389 [0–490] | 40 | 0 | 18/40 (45%) | 40 | 0.6 [0.4–1.2] | 212.4 |
| S2b | Proposed flood-aware | 40 | 3.66 [2.28–4.84] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 2.4 [0.9–4.7] | 0.0 |
| S2b | Adapted An et al. [18] | 40 | 3.66 [2.28–4.84] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 40/40 (100%) | 40 | 2.3 [0.7–5.2] | 5.2 |
| S4b | Distance-based Dijkstra | 40 | 3.44 [2.22–4.43] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 40 | 0 | 33/40 (82%) | 34 | 0.7 [0.4–1.0] | 43.4 |
| S4b | Proposed flood-aware | 40 | 3.44 [2.20–4.42] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 34 | 6 | 34/40 (85%) | 34 | 1.1 [0.6–2.6] | 0.0 |
| S4b | Adapted An et al. [18] | 40 | 3.44 [2.20–4.42] | 0.0 [0.0–0.0] | 0.00 [0.00–0.00] | 0 [0–0] | 34 | 6 | 34/40 (85%) | 34 | 0.8 [0.4–2.0] | 0.0 |


## Table B. Paired differences (proposed minus comparator), origins where both returned a route

| Scenario | Comparison | Paired n | Δ length (km) | Δ length (%) | Δ exposure (m²) | Mean Δ exposure (m²) | Origins with lower E | Origins with longer route | Wilcoxon p (length) | non-zero pairs L | Wilcoxon p (exposure) | non-zero pairs E | Different shelter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S0 | Proposed − Distance-based Dijkstra | 40 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 0.0 | 0 | 0 | n/a | 0 | n/a | 0 | 0 |
| S0 | Proposed − Adapted An et al. [18] | 40 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 0.0 | 0 | 0 | n/a | 0 | n/a | 0 | 0 |
| S1 | Proposed − Distance-based Dijkstra | 40 | 0.14 [0.00–0.43] | 3.7 [0.0–12.6] | -74.5 [-99.8–0.0] | -69.1 | 24 | 24 | 1.8e-05 | 24 | 1.8e-05 | 24 | 6 |
| S1 | Proposed − Adapted An et al. [18] | 40 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | -15.1 | 8 | 8 | 0.0078 | 8 | 0.0078 | 8 | 5 |
| S2 | Proposed − Distance-based Dijkstra | 40 | 0.17 [0.00–0.50] | 4.7 [0.0–16.7] | -184.8 [-221.6–0.0] | -155.7 | 25 | 25 | 6e-08 | 25 | 1.2e-05 | 25 | 6 |
| S2 | Proposed − Adapted An et al. [18] | 40 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | -36.8 | 9 | 9 | 0.0039 | 9 | 0.0039 | 9 | 5 |
| S3 | Proposed − Distance-based Dijkstra | 40 | 0.00 [0.00–2.13] | 0.0 [0.0–33.3] | 0.0 [-183.2–0.0] | -75.1 | 14 | 14 | 0.00012 | 14 | 0.00075 | 14 | 14 |
| S3 | Proposed − Adapted An et al. [18] | 40 | 0.00 [0.00–2.13] | 0.0 [0.0–33.3] | 0.0 [-183.2–0.0] | -75.1 | 14 | 14 | 0.00012 | 14 | 0.00075 | 14 | 14 |
| S4 | Proposed − Distance-based Dijkstra | 34 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | -5.8 | 1 | 1 | n/a | 1 | n/a | 1 | 0 |
| S4 | Proposed − Adapted An et al. [18] | 34 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | -5.8 | 1 | 1 | n/a | 1 | n/a | 1 | 0 |
| S2b | Proposed − Distance-based Dijkstra | 40 | 0.17 [0.00–0.50] | 4.7 [0.0–16.7] | -251.5 [-299.5–0.0] | -212.4 | 25 | 25 | 6e-08 | 25 | 1.2e-05 | 25 | 6 |
| S2b | Proposed − Adapted An et al. [18] | 40 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | -5.2 | 4 | 4 | n/a | 4 | n/a | 4 | 0 |
| S4b | Proposed − Distance-based Dijkstra | 34 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | -8.7 | 1 | 1 | n/a | 1 | n/a | 1 | 0 |
| S4b | Proposed − Adapted An et al. [18] | 34 | 0.00 [0.00–0.00] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 0.0 | 0 | 0 | n/a | 0 | n/a | 0 | 0 |


## Table C. Outcome classes against reference reachability (common rule d ≤ 0.3 m)

| Scenario | Method | Reachable origins: traversable route | Reachable origins: non-traversable route | Reachable origins: no route (over-blocking) | Isolated origins: correctly reported no route | Isolated origins: route through blocked edges | Correct classification |
|---|---|---|---|---|---|---|---|
| S0 | Distance-based Dijkstra | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S0 | Proposed flood-aware | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S0 | Adapted An et al. [18] | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S1 | Distance-based Dijkstra | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S1 | Proposed flood-aware | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S1 | Adapted An et al. [18] | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S2 | Distance-based Dijkstra | 18/40 | 22 | 0 | 0/0 | 0 | 18/40 |
| S2 | Proposed flood-aware | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S2 | Adapted An et al. [18] | 33/40 | 7 | 0 | 0/0 | 0 | 33/40 |
| S3 | Distance-based Dijkstra | 26/40 | 14 | 0 | 0/0 | 0 | 26/40 |
| S3 | Proposed flood-aware | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S3 | Adapted An et al. [18] | 26/40 | 14 | 0 | 0/0 | 0 | 26/40 |
| S4 | Distance-based Dijkstra | 33/34 | 1 | 0 | 0/6 | 6 | 33/40 |
| S4 | Proposed flood-aware | 34/34 | 0 | 0 | 6/6 | 0 | 40/40 |
| S4 | Adapted An et al. [18] | 33/34 | 1 | 0 | 0/6 | 6 | 33/40 |
| S2b | Distance-based Dijkstra | 18/40 | 22 | 0 | 0/0 | 0 | 18/40 |
| S2b | Proposed flood-aware | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S2b | Adapted An et al. [18] | 40/40 | 0 | 0 | 0/0 | 0 | 40/40 |
| S4b | Distance-based Dijkstra | 33/34 | 1 | 0 | 0/6 | 6 | 33/40 |
| S4b | Proposed flood-aware | 34/34 | 0 | 0 | 6/6 | 0 | 40/40 |
| S4b | Adapted An et al. [18] | 34/34 | 0 | 0 | 6/6 | 0 | 40/40 |


## Table D. Traversable routes / reference-reachable origins under alternative evaluation thresholds

| Scenario | Method | traversable @ 0.2 m | over-blocked @ 0.2 m | traversable @ 0.3 m | over-blocked @ 0.3 m | traversable @ 0.8 m | over-blocked @ 0.8 m |
|---|---|---|---|---|---|---|---|
| S0 | Distance-based Dijkstra | 40/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S0 | Proposed flood-aware | 40/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S0 | Adapted An et al. [18] | 40/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S1 | Distance-based Dijkstra | 18/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S1 | Proposed flood-aware | 40/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S1 | Adapted An et al. [18] | 34/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S2 | Distance-based Dijkstra | 15/40 | 0 | 18/40 | 0 | 40/40 | 0 |
| S2 | Proposed flood-aware | 40/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S2 | Adapted An et al. [18] | 31/40 | 0 | 33/40 | 0 | 40/40 | 0 |
| S3 | Distance-based Dijkstra | 26/40 | 0 | 26/40 | 0 | 40/40 | 0 |
| S3 | Proposed flood-aware | 40/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S3 | Adapted An et al. [18] | 26/40 | 0 | 26/40 | 0 | 40/40 | 0 |
| S4 | Distance-based Dijkstra | 33/34 | 0 | 33/34 | 0 | 40/40 | 0 |
| S4 | Proposed flood-aware | 34/34 | 0 | 34/34 | 0 | 34/40 | 6 |
| S4 | Adapted An et al. [18] | 33/34 | 0 | 33/34 | 0 | 40/40 | 0 |
| S2b | Distance-based Dijkstra | 15/40 | 0 | 18/40 | 0 | 18/40 | 0 |
| S2b | Proposed flood-aware | 40/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S2b | Adapted An et al. [18] | 36/40 | 0 | 40/40 | 0 | 40/40 | 0 |
| S4b | Distance-based Dijkstra | 33/34 | 0 | 33/34 | 0 | 33/34 | 0 |
| S4b | Proposed flood-aware | 34/34 | 0 | 34/34 | 0 | 34/34 | 0 |
| S4b | Adapted An et al. [18] | 34/34 | 0 | 34/34 | 0 | 34/34 | 0 |


## Shelter selection counts (returned routes)

| scenario | method | 3.0 | 4.0 | 5.0 | 7.0 | 8.0 | 9.0 |
|---|---|---|---|---|---|---|---|
| S0 | M1_distance | 5 | 9 | 2 | 14 | 7 | 3 |
| S0 | M2_proposed | 5 | 9 | 2 | 14 | 7 | 3 |
| S0 | M3_an2025 | 5 | 9 | 2 | 14 | 7 | 3 |
| S1 | M1_distance | 5 | 9 | 2 | 14 | 7 | 3 |
| S1 | M2_proposed | 0 | 9 | 8 | 14 | 6 | 3 |
| S1 | M3_an2025 | 5 | 9 | 3 | 14 | 6 | 3 |
| S2 | M1_distance | 5 | 9 | 2 | 14 | 7 | 3 |
| S2 | M2_proposed | 0 | 9 | 8 | 14 | 6 | 3 |
| S2 | M3_an2025 | 5 | 9 | 3 | 14 | 6 | 3 |
| S2b | M1_distance | 5 | 9 | 2 | 14 | 7 | 3 |
| S2b | M2_proposed | 0 | 9 | 8 | 14 | 6 | 3 |
| S2b | M3_an2025 | 0 | 9 | 8 | 14 | 6 | 3 |
| S3 | M1_distance | 5 | 9 | 2 | 14 | 7 | 3 |
| S3 | M2_proposed | 6 | 18 | 6 | 0 | 7 | 3 |
| S3 | M3_an2025 | 5 | 9 | 2 | 14 | 7 | 3 |
| S4 | M1_distance | 5 | 9 | 2 | 14 | 7 | 3 |
| S4 | M2_proposed | 4 | 9 | 2 | 12 | 6 | 1 |
| S4 | M3_an2025 | 5 | 9 | 2 | 14 | 7 | 3 |
| S4b | M1_distance | 5 | 9 | 2 | 14 | 7 | 3 |
| S4b | M2_proposed | 4 | 9 | 2 | 12 | 6 | 1 |
| S4b | M3_an2025 | 4 | 9 | 2 | 12 | 6 | 1 |


## Origins assigned to a different shelter than in S0

| Scenario | Distance-based Dijkstra | Proposed flood-aware | Adapted An et al. [18] |
|---|---|---|---|
| S1 | 0 | 6 | 1 |
| S2 | 0 | 6 | 1 |
| S3 | 0 | 14 | 0 |
| S4 | 0 | 0 | 0 |
| S2b | 0 | 6 | 6 |
| S4b | 0 | 0 | 0 |


## Verification

```
{
 "S0_equivalence": {
  "max_abs_len_diff_M2_M1_km": 0.0,
  "max_abs_len_diff_M3_M1_km": 0.0
 },
 "verify": {
  "n": 200,
  "equal": 200,
  "linear_ms_median": 255.64999999999998,
  "linear_ms_iqr": [
   132.925,
   414.625
  ],
  "heap_ms_median": 2.2375,
  "heap_ms_iqr": [
   1.056,
   4.69475
  ]
 },
 "samplingCheck": {
  "routes": 280,
  "same_found": 280,
  "same_shelter": 280,
  "cost_differs": 0,
  "edges": [
   {
    "id": "S0",
    "wetEdges": 0,
    "diffEdges": 0
   },
   {
    "id": "S1",
    "wetEdges": 321,
    "diffEdges": 1
   },
   {
    "id": "S2",
    "wetEdges": 321,
    "diffEdges": 1
   },
   {
    "id": "S3",
    "wetEdges": 66,
    "diffEdges": 0
   },
   {
    "id": "S4",
    "wetEdges": 624,
    "diffEdges": 4
   },
   {
    "id": "S2b",
    "wetEdges": 321,
    "diffEdges": 1
   },
   {
    "id": "S4b",
    "wetEdges": 624,
    "diffEdges": 4
   }
  ]
 }
}
```