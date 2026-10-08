#!/usr/bin/env bash
# Repeated end-to-end timing of the production hydrodynamic run (P = 137 mm).
# Requires the RAKIT server on localhost:3001. Each run is one POST /api/simulation/hydraulics.
OUT="$(dirname "$0")/results/hydro_timing_P137_rerun.csv"   # archived series: hydro_timing_P137_geofix.csv
echo "run,http_code,time_total_s,size_bytes" > "$OUT"
for i in $(seq 1 10); do
  r=$(curl -s -m 600 -o /dev/null -X POST http://localhost:3001/api/simulation/hydraulics \
      -H "Content-Type: application/json" -d '{"P":137}' -w "%{http_code},%{time_total},%{size_download}")
  echo "$i,$r" >> "$OUT"
done
echo DONE > "$OUT.done"
