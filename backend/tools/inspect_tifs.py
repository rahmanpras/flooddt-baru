import rasterio
import numpy as np

def inspect_tifs():
    dem_path = 'data/raster/DTMUTM.tif'
    bpbd_path = 'data/validation/PotensiBanjirBandung (1).tif'
    
    with rasterio.open(dem_path) as dem:
        print(f"--- DEM ---")
        print(f"Bounds: {dem.bounds}")
        print(f"CRS: {dem.crs}")
        print(f"Shape: {dem.width}x{dem.height}")
        
    with rasterio.open(bpbd_path) as bpbd:
        print(f"\n--- BPBD ---")
        print(f"Bounds: {bpbd.bounds}")
        print(f"CRS: {bpbd.crs}")
        print(f"Shape: {bpbd.width}x{bpbd.height}")
        
        data = bpbd.read(1)
        nodata = bpbd.nodata
        valid = data[data != nodata] if nodata is not None else data
        
        print(f"NoData Value: {nodata}")
        print(f"Min: {np.nanmin(valid)}, Max: {np.nanmax(valid)}")
        unique_vals, counts = np.unique(valid, return_counts=True)
        print(f"Unique values (up to 20): {list(zip(unique_vals[:20], counts[:20]))}")

if __name__ == '__main__':
    inspect_tifs()
