import os
import json
import urllib.request
import rasterio
import rasterio.warp
from rasterio.transform import from_bounds
import numpy as np
from rasterio.crs import CRS

HERE = os.path.dirname(os.path.abspath(__file__))

def main():
    # 1. Trigger Simulation
    # canonical validation settings (P = 137 mm, 0.1 m threshold) from ../config/production_config.json
    cfg_path = os.path.join(os.path.dirname(HERE), 'config', 'production_config.json')
    cfg = json.load(open(cfg_path))['validation'] if os.path.exists(cfg_path) else {'rainfall_mm': 137, 'depth_threshold_m': 0.1}
    P = cfg['rainfall_mm']
    url = 'http://localhost:3001/api/simulation/hydraulics'
    data = json.dumps({'P': P}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    print(f"Running simulation (P={P}mm)...")
    with urllib.request.urlopen(req) as res:
        sim_result = json.loads(res.read().decode('utf-8'))
        
    print("Simulation done. Flooded cells:", sim_result['floodedCells'])
    
    # 2. Convert Simulation Result to Numpy Array
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
    
    # 3. Read Validation Data
    val_path = os.path.join(HERE, 'data', 'validation', 'PotensiBanjirBandung (1).tif')
    with rasterio.open(val_path) as val_src:
        val_meta = val_src.meta.copy()
        val_crs = val_src.crs
        val_transform = val_src.transform
        val_width = val_src.width
        val_height = val_src.height
        val_data = val_src.read(1)
        val_nodata = val_src.nodata
        
    # 4. Reproject Simulation Data to match Validation Data
    reproj_sim = np.zeros((val_height, val_width), dtype=np.float32)
    
    rasterio.warp.reproject(
        source=sim_array,
        destination=reproj_sim,
        src_transform=transform,
        src_crs=CRS.from_string('+proj=longlat +datum=WGS84 +no_defs'), # Fallback string to avoid EPSG DB conflict
        dst_transform=val_transform,
        dst_crs=val_crs,
        resampling=rasterio.warp.Resampling.bilinear
    )
    
    # 5. Calculate Metrics
    depth_threshold = cfg['depth_threshold_m']  # meters
    
    val_valid_mask = (val_data != val_nodata)
    val_flood = (val_data > depth_threshold) & val_valid_mask
    
    sim_flood = (reproj_sim > depth_threshold)
    
    a_hit = np.sum(val_flood & sim_flood)
    b_false_alarm = np.sum(~val_flood & sim_flood & val_valid_mask)
    c_miss = np.sum(val_flood & ~sim_flood)
    d_correct_neg = np.sum(~val_flood & ~sim_flood & val_valid_mask)
    
    csi = a_hit / (a_hit + b_false_alarm + c_miss) if (a_hit + b_false_alarm + c_miss) > 0 else 0
    pod = a_hit / (a_hit + c_miss) if (a_hit + c_miss) > 0 else 0
    far = b_false_alarm / (a_hit + b_false_alarm) if (a_hit + b_false_alarm) > 0 else 0
    accuracy = (a_hit + d_correct_neg) / np.sum(val_valid_mask)
    
    print("\n=== Validation Results ===")
    print(f"Hits (A): {a_hit}")
    print(f"False Alarms (B): {b_false_alarm}")
    print(f"Misses (C): {c_miss}")
    print(f"Correct Negatives (D): {d_correct_neg}")
    print(f"--------------------------")
    print(f"CSI (F-Statistic): {csi:.4f} (Target > 0.50)")
    print(f"Probability of Detection (Hit Rate): {pod:.4f}")
    print(f"False Alarm Ratio (FAR): {far:.4f}")
    print(f"Overall Accuracy: {accuracy:.4f}")

    out_results = {
        'CSI': csi,
        'POD': pod,
        'FAR': far,
        'Accuracy': accuracy
    }
    with open(os.path.join(HERE, 'data', 'validation', 'results.json'), 'w') as f:
        json.dump(out_results, f)

if __name__ == "__main__":
    main()
