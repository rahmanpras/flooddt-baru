"""Resample DTMUTM.tif onto the model grid used by the CN grid, roads, rivers, and validation.

The model grid is 853 columns x 820 rows in EPSG:4326 covering
107.53-107.66 E and 6.86-6.98 S (the bounds stored in dtm_bandung_wgs84.json, which the CN grid,
getFloodDepthAt, validate_flood.py, and the experiments already use).

    python backend/convert_dtm.py
writes data/raster/dtm_bandung_wgs84.bin (float32, row 0 = north) and updates dtm_bandung_wgs84.json.
Cells outside the DTM coverage (outside the city boundary) take the value of the nearest valid cell.
"""
import json
import os

import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
from pyproj import Geod
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
RASTER = os.path.join(HERE, 'data', 'raster')
SRC = os.path.join(RASTER, 'DTMUTM.tif')
OUT_BIN = os.path.join(RASTER, 'dtm_bandung_wgs84.bin')
OUT_JSON = os.path.join(RASTER, 'dtm_bandung_wgs84.json')

ROWS, COLS = 820, 853
WGS84 = '+proj=longlat +datum=WGS84 +no_defs'  # proj string avoids the conflicting PostGIS proj.db
WEST, EAST, SOUTH, NORTH = 107.53, 107.66, -6.98, -6.86


def main():
    dst = np.full((ROWS, COLS), np.nan, dtype=np.float32)
    dst_transform = from_bounds(WEST, SOUTH, EAST, NORTH, COLS, ROWS)
    with rasterio.open(SRC) as src:
        reproject(source=rasterio.band(src, 1), destination=dst,
                  src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
                  dst_transform=dst_transform, dst_crs=WGS84, dst_nodata=np.nan,
                  resampling=Resampling.average)
    valid = np.isfinite(dst)
    covered = float(valid.mean())
    # fill cells outside the DTM coverage with the nearest valid elevation
    idx = ndimage.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    dst = dst[tuple(idx)].astype(np.float32)
    dst.tofile(OUT_BIN)

    geod = Geod(ellps='WGS84')
    lat_c = (NORTH + SOUTH) / 2
    dx = (EAST - WEST) / COLS
    dy = (NORTH - SOUTH) / ROWS
    dx_m = geod.inv(WEST, lat_c, WEST + dx, lat_c)[2]
    dy_m = geod.inv((WEST + EAST) / 2, lat_c, (WEST + EAST) / 2, lat_c - dy)[2]
    meta = {
        'rows': ROWS, 'cols': COLS,
        'bounds': {'west': WEST, 'east': EAST, 'south': SOUTH, 'north': NORTH},
        'dx': dx, 'dy': dy, 'dx_m': dx_m, 'dy_m': dy_m,
        'elevation_min': float(dst.min()), 'elevation_max': float(dst.max()),
        'elevation_mean': float(dst.mean()),
        'source': 'DTMUTM.tif', 'target_crs': 'EPSG:4326', 'dtype': 'float32',
        'resampling': 'average; cells outside DTM coverage filled with nearest valid value',
        'dtm_coverage_fraction': covered,
    }
    json.dump(meta, open(OUT_JSON, 'w'), indent=2)
    print(json.dumps(meta, indent=2))


if __name__ == '__main__':
    main()
