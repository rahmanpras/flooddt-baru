import json
import os
import sys
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

def generate_cn_grid():
    # Bounds matching server.js
    bounds = {
        "south": -6.980, "north": -6.860,
        "west": 107.530, "east": 107.660
    }
    cols = 260
    rows = 240
    
    cellW = (bounds["east"] - bounds["west"]) / cols
    cellH = (bounds["north"] - bounds["south"]) / rows
    
    lulc_path = os.path.join(os.path.dirname(__file__), 'data', 'geojson', 'Landuse_KotaBandung (1).geojson')
    out_path = os.path.join(os.path.dirname(__file__), 'data', 'cn_grid_cache.json')
    
    if not os.path.exists(lulc_path):
        print(f"File not found: {lulc_path}")
        return
        
    with open(lulc_path, 'r', encoding='utf-8') as f:
        lulc_data = json.load(f)
        
    CN_MAPPING = {
        "1": 92, # Permukiman Kepadatan Tinggi (High density) -> CN 92
        "2": 85, # Permukiman Kepadatan Sedang (Med density) -> CN 85
        "3": 78, # Permukiman Kepadatan Rendah (Low density) -> CN 78
        "4": 98, # Industri / Komersial -> CN 98
        "5": 65, # RTH / Taman -> CN 65
        "6": 100 # Badan Air -> CN 100
    }
    
    # Load polygons
    polygons = []
    cns = []
    for feat in lulc_data.get('features', []):
        gridcode = str(feat['properties'].get('gridcode', '2'))
        cn = CN_MAPPING.get(gridcode, 85)
        geom = shape(feat['geometry'])
        polygons.append(geom)
        cns.append(cn)
        
    # Build spatial index
    tree = STRtree(polygons)
    
    # Generate points
    points = []
    # Note: r=0 is North, r=rows-1 is South
    for r in range(rows):
        lat = bounds["north"] - (r * cellH)
        for c in range(cols):
            lng = bounds["west"] + (c * cellW)
            points.append(Point(lng, lat))
            
    # Query spatial index
    # We query for all points
    print(f"Querying {len(points)} points...")
    cn_grid = [85] * (rows * cols)
    
    # STRtree query is very fast. We can query point by point, or use query()
    for i, pt in enumerate(points):
        # find polygons intersecting this point
        indices = tree.query(pt)
        for idx in indices:
            if polygons[idx].contains(pt):
                cn_grid[i] = cns[idx]
                break
                
    # Save output
    with open(out_path, 'w') as f:
        json.dump(cn_grid, f)
        
    print(f"Successfully generated CN grid cache at {out_path}")

if __name__ == '__main__':
    generate_cn_grid()
