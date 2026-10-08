import os
import json
import urllib.request
import rasterio
import rasterio.warp
from rasterio.transform import from_bounds
import numpy as np
from rasterio.crs import CRS

def main():
    url = 'http://localhost:3001/api/simulation/hydraulics'
    data = json.dumps({'P': 150}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    print("Running simulation (P=150mm)...")
    with urllib.request.urlopen(req) as res:
        sim_result = json.loads(res.read().decode('utf-8'))
        
    bounds = sim_result['bounds']
    south, west = bounds[0]
    north, east = bounds[1]
    rows = sim_result['rows']
    cols = sim_result['cols']
    grid_data = sim_result['grid']
    
    sim_array = np.zeros((rows, cols), dtype=np.float32)
    for r in range(rows):
        for c in range(cols):
            sim_array[r, c] = grid_data[r][c]['h']
            
    transform = from_bounds(west, south, east, north, cols, rows)
    
    val_path = 'data/validation/PotensiBanjirBandung (1).tif'
    with rasterio.open(val_path) as val_src:
        val_crs = val_src.crs
        val_transform = val_src.transform
        val_width = val_src.width
        val_height = val_src.height
        val_data = val_src.read(1)
        val_nodata = val_src.nodata
        
    depth_threshold = 0.1
    val_valid_mask = (val_data != val_nodata)
    val_flood = (val_data > 0) & val_valid_mask
    
    def check_csi(arr, name):
        reproj_sim = np.zeros((val_height, val_width), dtype=np.float32)
        rasterio.warp.reproject(
            source=arr,
            destination=reproj_sim,
            src_transform=transform,
            src_crs=CRS.from_string('+proj=longlat +datum=WGS84 +no_defs'),
            dst_transform=val_transform,
            dst_crs=val_crs,
            resampling=rasterio.warp.Resampling.nearest
        )
        sim_flood = (reproj_sim > depth_threshold)
        a_hit = np.sum(val_flood & sim_flood)
        b_false_alarm = np.sum(~val_flood & sim_flood & val_valid_mask)
        c_miss = np.sum(val_flood & ~sim_flood)
        csi = a_hit / (a_hit + b_false_alarm + c_miss) if (a_hit + b_false_alarm + c_miss) > 0 else 0
        print(f"[{name}] Hits: {a_hit}, FA: {b_false_alarm}, Miss: {c_miss} -> CSI: {csi:.4f}")

    check_csi(sim_array, "Original")
    check_csi(np.flipud(sim_array), "Flipped UD")
    check_csi(np.fliplr(sim_array), "Flipped LR")
    check_csi(np.flipud(np.fliplr(sim_array)), "Flipped Both")

if __name__ == "__main__":
    main()
