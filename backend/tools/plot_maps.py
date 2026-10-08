import matplotlib.pyplot as plt
import rasterio
import json
import urllib.request
import rasterio.warp
from rasterio.transform import from_bounds
import numpy as np
from rasterio.crs import CRS

def main():
    # 1. Fetch simulation (use P=150)
    url = 'http://localhost:3001/api/simulation/hydraulics'
    data = json.dumps({'P': 150}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    print("Running simulation...")
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
    
    # 2. Read BPBD
    bpbd_path = 'data/validation/PotensiBanjirBandung (1).tif'
    with rasterio.open(bpbd_path) as bpbd:
        val_crs = bpbd.crs
        val_transform = bpbd.transform
        val_width = bpbd.width
        val_height = bpbd.height
        bpbd_data = bpbd.read(1)
        nodata = bpbd.nodata
    
    # 3. Reproject Simulation
    reproj_sim = np.zeros((val_height, val_width), dtype=np.float32)
    rasterio.warp.reproject(
        source=sim_array,
        destination=reproj_sim,
        src_transform=transform,
        src_crs=CRS.from_string('+proj=longlat +datum=WGS84 +no_defs'),
        dst_transform=val_transform,
        dst_crs=val_crs,
        resampling=rasterio.warp.Resampling.bilinear
    )
    
    # 4. Plot
    fig, axes = plt.subplots(1, 3, figsize=(15, 6))
    
    # Original Simulation array
    axes[0].imshow(sim_array, cmap='Blues', vmin=0, vmax=2)
    axes[0].set_title('Simulation (Raw Array)')
    
    # Reprojected Simulation
    axes[1].imshow(reproj_sim, cmap='Blues', vmin=0, vmax=2)
    axes[1].set_title('Simulation (Reprojected)')
    
    # BPBD
    bpbd_flood = np.where(bpbd_data != nodata, bpbd_data, 0)
    axes[2].imshow(bpbd_flood, cmap='Reds', vmin=0, vmax=2)
    axes[2].set_title('BPBD Observation')
    
    plt.tight_layout()
    plt.savefig('calibration.png')
    print("Saved calibration.png")

if __name__ == '__main__':
    main()
