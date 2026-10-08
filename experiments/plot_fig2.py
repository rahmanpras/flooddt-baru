"""Fig. 2 of the manuscript, drawn at printed size with 10-pt Times New Roman lettering (data from the RAKIT experiment design)."""
import json, math, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Ellipse
from matplotlib.lines import Line2D

RAKIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
design = json.load(open(os.path.join(RAKIT, 'experiments', 'results', 'design.json')))
B = design['raster']['bounds']
lat0 = (B['north'] + B['south']) / 2
MX, MY = 111320 * math.cos(math.radians(lat0)), 110574

plt.rcParams.update({'font.family': 'Times New Roman', 'font.size': 10, 'mathtext.fontset': 'stix'})
FS = 10
roads = json.load(open(os.path.join(RAKIT, 'backend', 'data', 'roads', 'bandung_roads_real.geojson'), encoding='utf-8'))
segs = []
for f in roads['features']:
    if f['geometry']['type'] != 'LineString':
        continue
    c = [p[:2] for p in f['geometry']['coordinates']]
    if all(B['west'] <= x <= B['east'] and B['south'] <= y <= B['north'] for x, y in c):
        segs.append(c)

CM = 1 / 2.54
fig = plt.figure(figsize=(17.0 * CM, 12.2 * CM), dpi=600)
ax = fig.add_axes([0.095, 0.085, 0.60, 0.90])
ax.add_collection(LineCollection(segs, colors='#b9bec7', linewidths=0.25, zorder=1))


def circle(lat, lng, r_m, **kw):
    return Ellipse((lng, lat), 2 * r_m / MX, 2 * r_m / MY, **kw)


sc = {s['id']: s for s in design['scenarios']}
for z in sc['S1']['zones']:
    ax.add_patch(circle(z['lat'], z['lng'], 200, facecolor='#9ecae1', edgecolor='none', alpha=0.85, zorder=2))
    ax.add_patch(circle(z['lat'], z['lng'], 120, facecolor='#2171b5', edgecolor='none', alpha=0.9, zorder=3))
    dx, dy, ha = {'C6': (-0.0004, 0.0036, 'center'), 'C7': (0.0022, 0, 'left')}.get(z['id'], (-0.0022, 0, 'right'))
    ax.text(z['lng'] + dx, z['lat'] + dy, z['id'], color='#08306b', fontsize=FS, ha=ha, va='center', zorder=6,
            weight='bold')
for z in sc['S3']['zones']:
    ax.add_patch(circle(z['lat'], z['lng'], 300, facecolor='#e6550d', edgecolor='none', alpha=0.55, zorder=2))
for z in sc['S4']['zones']:
    ax.add_patch(circle(z['lat'], z['lng'], 320, facecolor='#756bb1', edgecolor='none', alpha=0.6, zorder=2))
    ax.add_patch(circle(z['lat'], z['lng'], 120, facecolor='white', edgecolor='none', alpha=1.0, zorder=2.5))

iso = set(design['isolatedOrigins'])
for o in design['origins']:
    ax.plot(o['lng'], o['lat'], 'o', ms=3.2, mfc='#222222' if o['id'] not in iso else '#756bb1', mec='white',
            mew=0.4, zorder=5)
    ax.text(o['lng'] + 0.0010, o['lat'] + 0.0007, str(o['id']), fontsize=FS, zorder=6)
for s in design['shelters']:
    if s['eligible']:
        ax.plot(s['lng'], s['lat'], '*', ms=10, mfc='#31a354', mec='black', mew=0.4, zorder=6)
        dx, dy, ha = {9: (-0.0016, 0.0010, 'right')}.get(s['id'], (0.0014, -0.0030, 'left'))
        ax.text(s['lng'] + dx, s['lat'] + dy, f"H{s['id']}", fontsize=FS, color='#1b5e20', weight='bold',
                ha=ha, zorder=7)

ax.set_xlim(B['west'], B['east'])
ax.set_ylim(B['south'], B['north'])
ax.set_aspect(MY / MX)
ax.set_xlabel('Longitude (°E)', fontsize=FS)
ax.set_ylabel('Latitude (°)', fontsize=FS)
ax.tick_params(labelsize=FS)
ax.set_xticks([107.54, 107.58, 107.62, 107.66])
ax.set_yticks([-6.86, -6.90, -6.94, -6.98])
x0, y0 = B['east'] - 0.03, B['south'] + 0.006
ax.plot([x0, x0 + 2000 / MX], [y0, y0], color='black', lw=1.5)
ax.text(x0 + 1000 / MX, y0 + 0.0022, '2 km', ha='center', fontsize=FS)
ax.annotate('N', xy=(B['east'] - 0.007, B['north'] - 0.004), xytext=(B['east'] - 0.007, B['north'] - 0.016),
            arrowprops=dict(arrowstyle='->', lw=1), ha='center', fontsize=FS)

leg = [Line2D([], [], color='#b9bec7', lw=1.2, label='Road network\n(experimental domain)'),
       Line2D([], [], marker='o', ls='', mfc='#2171b5', mec='none', ms=8, label='S1/S2 corridor zone\ncore (0.30/0.60 m)'),
       Line2D([], [], marker='o', ls='', mfc='#9ecae1', mec='none', ms=8, label='S1/S2 corridor zone\nmargin (0.10/0.30 m)'),
       Line2D([], [], marker='o', ls='', mfc='#e6550d', alpha=0.55, mec='none', ms=8, label='S3 shelter-access\nzone (0.60 m)'),
       Line2D([], [], marker='o', ls='', mfc='#756bb1', alpha=0.6, mec='none', ms=8, label='S4 isolation ring\n(0.60 m)'),
       Line2D([], [], marker='o', ls='', mfc='#222222', mec='white', ms=5, label='Evacuation origin\n(number = origin ID)'),
       Line2D([], [], marker='*', ls='', mfc='#31a354', mec='black', ms=10, label='Eligible shelter\n(H = shelter ID)')]
fig.legend(handles=leg, loc='center left', bbox_to_anchor=(0.705, 0.53), fontsize=FS, frameon=False,
           labelspacing=1.0, handlelength=1.6)
out = os.path.join(RAKIT, 'experiments', 'results', 'fig2_scenarios_10pt.png')
fig.savefig(out, dpi=600)
print('saved', out)
