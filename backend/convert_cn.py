"""Rasterize the land-cover map onto the model grid as SCS Curve Numbers.

    python backend/convert_cn.py [--check]
writes data/raster/cn_grid_bandung_wgs84.bin (float32, 820 rows x 853 columns, row 0 = north) on the grid defined in
data/raster/dtm_bandung_wgs84.json (107.53-107.66 E, 6.86-6.98 S). Each cell takes the land-cover class at its centre
from data/raster/lulckotabandung24.tif; classes without a mapping, no-data cells, and cells outside the map get CN 85.
This reproduces the CN grid used for every result in the manuscript (verify with --check).
"""
import json
import os
import sys

import numpy as np
import rasterio

HERE = os.path.dirname(os.path.abspath(__file__))
RASTER = os.path.join(HERE, 'data', 'raster')
LULC = os.path.join(RASTER, 'lulckotabandung24.tif')
OUT = os.path.join(RASTER, 'cn_grid_bandung_wgs84.bin')

# land-cover class value in lulckotabandung24.tif -> Curve Number
CN_BY_CLASS = {1: 100, 2: 60, 3: 80, 5: 70}
CN_DEFAULT = 85


def build():
    meta = json.load(open(os.path.join(RASTER, 'dtm_bandung_wgs84.json')))
    rows, cols, b = meta['rows'], meta['cols'], meta['bounds']
    rr, cc = np.meshgrid(np.arange(rows), np.arange(cols), indexing='ij')
    lon = b['west'] + (cc + 0.5) * (b['east'] - b['west']) / cols
    lat = b['north'] - (rr + 0.5) * (b['north'] - b['south']) / rows
    cn = np.full(rows * cols, CN_DEFAULT, dtype=np.float32)
    with rasterio.open(LULC) as src:
        lu = src.read(1)
        r, c = rasterio.transform.rowcol(src.transform, lon.ravel(), lat.ravel())
        r, c = np.asarray(r), np.asarray(c)
        inside = (r >= 0) & (r < src.height) & (c >= 0) & (c < src.width)
        cls = np.full(r.shape, -1)
        cls[inside] = lu[r[inside], c[inside]]
    for k, v in CN_BY_CLASS.items():
        cn[cls == k] = v
    return cn.reshape(rows, cols)


if __name__ == '__main__':
    grid = build()
    if '--check' in sys.argv:
        ref = np.fromfile(OUT, dtype=np.float32).reshape(grid.shape)
        same = float(np.mean(ref == grid))
        print('cells identical to %s: %.4f%%' % (os.path.basename(OUT), 100 * same))
        sys.exit(0 if same == 1.0 else 1)
    grid.tofile(OUT)
    print('wrote', OUT, grid.shape, 'CN values:', sorted(set(np.unique(grid).tolist())))
