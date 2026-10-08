"""Basin-averaged SCS-CN runoff for the four return-period scenarios (Table 6 of the manuscript).

    env/Scripts/python.exe experiments/runoff_table.py
"""
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cn = np.fromfile(os.path.join(ROOT, 'backend', 'data', 'raster', 'cn_grid_bandung_wgs84.bin'), dtype=np.float32).astype(float)
cn[cn <= 0] = 85
print('scenario  P (mm)  mean Q (mm)  Q/P    cells with runoff')
for name, P in (('S1 10-yr', 120), ('S2 20-yr', 180), ('S3 50-yr', 240), ('S4 100-yr', 360)):
    S = 25400 / cn - 254
    Ia = 0.2 * S
    Q = np.where(P > Ia, (P - Ia) ** 2 / (P - Ia + S), 0.0)
    print(f'{name:9s} {P:6d}  {Q.mean():11.1f}  {Q.mean() / P:.3f}  {int((Q > 0).sum()):,}')
