"""Fig. 1 (CDT framework) redrawn at printed size with 10-pt Times New Roman lettering."""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

plt.rcParams.update({'font.family': 'Times New Roman', 'font.size': 10})
CM = 1 / 2.54
WID, HEI = 17.0, 10.4
fig = plt.figure(figsize=(WID * CM, HEI * CM), dpi=600)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, WID)
ax.set_ylim(0, HEI)
ax.axis('off')

levels = [  # top to bottom
    ('Smart System Level 4  |  Digital Twin Layer', '#1b7f79', '#ddf0ee', 'Human–Content\nInteraction Level 3',
     ['3D city model and\ninundation overlay\n(CesiumJS)', 'Evacuation route\nand shelter display', 'Control panel and\nscenario dashboard']),
    ('Smart System Level 3  |  Flood and Evacuation Model Layer', '#a8790a', '#fbf1dc', 'Human–Content\nInteraction Level 2',
     ['Hydrology engine\n(SCS-CN runoff)', 'Flood simulation\n(2D diffusion wave)', 'Flood-aware Dijkstra\nevacuation routing']),
    ('Smart System Level 2  |  Information System Layer', '#5b4b9b', '#e6e3f3', 'Human–Content\nInteraction Level 1',
     ['SQLite spatial and\nrainfall database', 'Node.js and Express\nREST API services', '2D operational web\nmap (Leaflet.js)']),
    ('Smart System Level 1  |  Instrumentation Layer', '#b83227', '#fbe3df', 'Human–Content\nInteraction Level 0',
     ['Rainfall data from\nOpenWeatherMap and\nBMKG records', 'Terrain, land cover,\nrivers, roads, shelters', 'Data validation and\ningestion pipeline']),
]
LEFT_W = 13.2          # width of smart-system bands
GAP_X = 0.25
RIGHT_X = LEFT_W + GAP_X
RIGHT_W = WID - RIGHT_X - 0.05
band_h = 2.25
gap_y = 0.42
head_h = 0.55
y = HEI - 0.05
centers = []
for title, dark, light, hci, boxes in levels:
    y0 = y - band_h
    ax.add_patch(FancyBboxPatch((0.05, y0), LEFT_W - 0.05, band_h, boxstyle='round,pad=0,rounding_size=0.12',
                                fc=light, ec=dark, lw=1.0))
    ax.add_patch(FancyBboxPatch((0.05, y - head_h), LEFT_W - 0.05, head_h, boxstyle='round,pad=0,rounding_size=0.12',
                                fc=dark, ec=dark, lw=1.0))
    ax.text(LEFT_W / 2, y - head_h / 2, title, ha='center', va='center', color='white', weight='bold', fontsize=10)
    bw = (LEFT_W - 0.05 - 4 * 0.22) / 3
    by0 = y0 + 0.15
    bh = band_h - head_h - 0.30
    for k, txt in enumerate(boxes):
        bx = 0.05 + 0.22 + k * (bw + 0.22)
        ax.add_patch(FancyBboxPatch((bx, by0), bw, bh, boxstyle='round,pad=0,rounding_size=0.08', fc='white',
                                    ec=dark, lw=0.8))
        ax.text(bx + bw / 2, by0 + bh / 2, txt, ha='center', va='center', fontsize=10, linespacing=1.15)
    ax.add_patch(FancyBboxPatch((RIGHT_X, y0), RIGHT_W, band_h, boxstyle='round,pad=0,rounding_size=0.12', fc=dark,
                                ec=dark, lw=1.0))
    ax.text(RIGHT_X + RIGHT_W / 2, y0 + band_h / 2, hci, ha='center', va='center', color='white', weight='bold',
            fontsize=10, linespacing=1.25)
    centers.append((y0, y))
    y = y0 - gap_y

for (lo_y0, lo_y1), (hi_y0, hi_y1) in zip(centers[1:], centers[:-1]):
    for xc in (LEFT_W / 2, RIGHT_X + RIGHT_W / 2):
        ax.add_patch(FancyArrowPatch((xc, lo_y1 + 0.02), (xc, hi_y0 - 0.02), arrowstyle='-|>', mutation_scale=13,
                                     lw=1.6, color='#444444'))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'results', 'fig1_framework_10pt.png')
fig.savefig(out, dpi=600)
print('saved', out, 'bottom y', y + gap_y)
