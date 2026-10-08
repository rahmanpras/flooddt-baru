"""Map of the synthetic inundation scenarios, origins and eligible shelters.

    env/Scripts/python.exe experiments/plot_scenarios.py   ->  experiments/results/fig_scenarios.png
"""
import json
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Circle, Wedge
from matplotlib.lines import Line2D

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
design = json.load(open(os.path.join(HERE, 'results', 'design.json')))
B = design['raster']['bounds']
lat0 = (B['north'] + B['south']) / 2
import math
MX, MY = 111320 * math.cos(math.radians(lat0)), 110574

roads = json.load(open(os.path.join(ROOT, 'backend', 'data', 'roads', 'bandung_roads_real.geojson'), encoding='utf-8'))
segs = []
for f in roads['features']:
    if f['geometry']['type'] != 'LineString':
        continue
    c = [p[:2] for p in f['geometry']['coordinates']]
    if all(B['west'] <= x <= B['east'] and B['south'] <= y <= B['north'] for x, y in c):
        segs.append(c)

fig, ax = plt.subplots(figsize=(7.2, 6.4), dpi=300)
ax.add_collection(LineCollection(segs, colors='#b9bec7', linewidths=0.25, zorder=1))


def circle(lat, lng, r_m, **kw):
    # draw in degrees with an ellipse-equivalent radius (x and y scaled separately)
    from matplotlib.patches import Ellipse
    return Ellipse((lng, lat), 2 * r_m / MX, 2 * r_m / MY, **kw)


sc = {s['id']: s for s in design['scenarios']}
for z in sc['S1']['zones']:
    ax.add_patch(circle(z['lat'], z['lng'], 200, facecolor='#9ecae1', edgecolor='none', alpha=0.85, zorder=2))
    ax.add_patch(circle(z['lat'], z['lng'], 120, facecolor='#2171b5', edgecolor='none', alpha=0.9, zorder=3))
    ax.text(z['lng'], z['lat'], z['id'], color='white', fontsize=5, ha='center', va='center', zorder=6, weight='bold')
for z in sc['S3']['zones']:
    ax.add_patch(circle(z['lat'], z['lng'], 300, facecolor='#e6550d', edgecolor='none', alpha=0.55, zorder=2))
for z in sc['S4']['zones']:
    ax.add_patch(circle(z['lat'], z['lng'], 320, facecolor='#756bb1', edgecolor='none', alpha=0.6, zorder=2))
    ax.add_patch(circle(z['lat'], z['lng'], 120, facecolor='white', edgecolor='none', alpha=1.0, zorder=2.5))

iso = set(design['isolatedOrigins'])
for o in design['origins']:
    ax.plot(o['lng'], o['lat'], 'o', ms=3.2, mfc='#222222' if o['id'] not in iso else '#756bb1', mec='white', mew=0.4, zorder=5)
    ax.text(o['lng'] + 0.0012, o['lat'] + 0.0008, str(o['id']), fontsize=4.5, zorder=6)
for s in design['shelters']:
    if s['eligible']:
        ax.plot(s['lng'], s['lat'], '*', ms=9, mfc='#31a354', mec='black', mew=0.4, zorder=6)
        ax.text(s['lng'] + 0.0015, s['lat'] - 0.0022, f"H{s['id']}", fontsize=5.5, color='#1b5e20', weight='bold', zorder=7)

ax.set_xlim(B['west'], B['east'])
ax.set_ylim(B['south'], B['north'])
ax.set_aspect(MY / MX)
ax.set_xlabel('Longitude (°E)', fontsize=7)
ax.set_ylabel('Latitude (°)', fontsize=7)
ax.tick_params(labelsize=6)
leg = [Line2D([], [], color='#b9bec7', lw=1, label='Road network (experimental domain)'),
       Line2D([], [], marker='o', ls='', mfc='#2171b5', mec='none', ms=7, label='S1/S2 corridor zone core (0.30 / 0.60 m)'),
       Line2D([], [], marker='o', ls='', mfc='#9ecae1', mec='none', ms=7, label='S1/S2 corridor zone margin (0.10 / 0.30 m)'),
       Line2D([], [], marker='o', ls='', mfc='#e6550d', alpha=0.55, mec='none', ms=7, label='S3 shelter-access zone (0.60 m)'),
       Line2D([], [], marker='o', ls='', mfc='#756bb1', alpha=0.6, mec='none', ms=7, label='S4 isolation ring (0.60 m)'),
       Line2D([], [], marker='o', ls='', mfc='#222222', mec='white', ms=4, label='Evacuation origin'),
       Line2D([], [], marker='*', ls='', mfc='#31a354', mec='black', ms=8, label='Eligible shelter')]
ax.legend(handles=leg, loc='lower left', fontsize=5.2, framealpha=0.92)
# scale bar (2 km)
x0, y0 = B['east'] - 0.03, B['south'] + 0.006
ax.plot([x0, x0 + 2000 / MX], [y0, y0], color='black', lw=1.5)
ax.text(x0 + 1000 / MX, y0 + 0.0015, '2 km', ha='center', fontsize=6)
ax.annotate('N', xy=(B['east'] - 0.006, B['north'] - 0.004), xytext=(B['east'] - 0.006, B['north'] - 0.013),
            arrowprops=dict(arrowstyle='->', lw=1), ha='center', fontsize=7)
fig.tight_layout()
fig.savefig(os.path.join(HERE, 'results', 'fig_scenarios.png'))
print('saved')
