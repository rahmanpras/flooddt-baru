"""
RAKIT v2 - Road Network Routing
Builds a routable graph from the real GeoJSON road network.
"""
import geopandas as gpd
import networkx as nx
import json
import os
import pickle
import math
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', 'data', 'roads')
GEOJSON_PATH = os.path.join(DATA_DIR, 'bandung_roads_real.geojson')
CACHE_PATH = os.path.join(DATA_DIR, 'bandung_road_graph_nx.gpickle')

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # radius of earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def build_road_graph():
    """Build a NetworkX graph from the GeoJSON file directly."""
    if os.path.exists(CACHE_PATH):
        print(f"[Routing] Loading cached road graph from {CACHE_PATH}")
        return pickle.load(open(CACHE_PATH, 'rb'))
        
    print(f"[Routing] Building road graph from {GEOJSON_PATH}...")
    if not os.path.exists(GEOJSON_PATH):
        raise FileNotFoundError(f"Road data not found at {GEOJSON_PATH}")
        
    gdf = gpd.read_file(GEOJSON_PATH)
    G = nx.Graph() # using undirected for simplicity since it's a generic road network
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        if geom is None:
            continue
            
        if geom.geom_type == 'LineString':
            lines = [geom]
        elif geom.geom_type == 'MultiLineString':
            lines = list(geom.geoms)
        else:
            continue
            
        for line in lines:
            coords = list(line.coords)
            for i in range(len(coords) - 1):
                lon1, lat1 = coords[i][:2]
                lon2, lat2 = coords[i+1][:2]
                
                # Round coordinates slightly to handle precision issues (ensure nodes connect)
                p1 = (round(lon1, 6), round(lat1, 6))
                p2 = (round(lon2, 6), round(lat2, 6))
                
                dist = haversine_distance(lat1, lon1, lat2, lon2)
                
                if not G.has_node(p1):
                    G.add_node(p1, x=p1[0], y=p1[1])
                if not G.has_node(p2):
                    G.add_node(p2, x=p2[0], y=p2[1])
                    
                G.add_edge(p1, p2, weight=dist)

    print(f"[Routing] Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    os.makedirs(DATA_DIR, exist_ok=True)
    pickle.dump(G, open(CACHE_PATH, 'wb'))
    print(f"[Routing] Graph cached to {CACHE_PATH}")
    
    return G

flooded_nodes_cache = None

def get_flooded_nodes(G):
    """Calculate and cache which road nodes intersect with the flood hazard polygons."""
    global flooded_nodes_cache
    if flooded_nodes_cache is not None:
        return flooded_nodes_cache
        
    print("[Routing] Calculating flooded nodes (Spatial Indexing)...")
    flood_geojson_path = os.path.join(DATA_DIR, '..', 'geojson', '4326_PotensiBanjir.geojson')
    
    if not os.path.exists(flood_geojson_path):
        print(f"[Routing] Warning: Flood data not found at {flood_geojson_path}. Adaptive routing disabled.")
        flooded_nodes_cache = set()
        return flooded_nodes_cache
        
    with open(flood_geojson_path, 'r') as f:
        flood_data = json.load(f)
        
    polygons = []
    for feat in flood_data.get('features', []):
        try:
            geom = shape(feat['geometry'])
            polygons.append(geom)
        except Exception:
            pass
            
    if not polygons:
        flooded_nodes_cache = set()
        return flooded_nodes_cache
        
    tree = STRtree(polygons)
    flooded_nodes = set()
    
    for node in G.nodes():
        pt = Point(node[0], node[1])
        # If the point intersects any polygon bounding box, check exact intersection
        # Wait, STRtree.query returns indices of intersecting geometries
        matches = tree.query(pt)
        if len(matches) > 0:
            # Check exact intersection
            for match_idx in matches:
                if polygons[match_idx].contains(pt):
                    flooded_nodes.add(node)
                    break
                    
    print(f"[Routing] Found {len(flooded_nodes)} flooded road nodes.")
    flooded_nodes_cache = flooded_nodes
    return flooded_nodes_cache

def nearest_node(G, lng, lat, avoid_nodes=None):
    """Find the nearest node in the graph to the given coordinates."""
    min_dist = float('inf')
    nearest = None
    for node in G.nodes():
        if avoid_nodes and node in avoid_nodes:
            continue
        node_lng, node_lat = node
        dist = (node_lng - lng)**2 + (node_lat - lat)**2 # Simple squared distance for nearest
        if dist < min_dist:
            min_dist = dist
            nearest = node
    return nearest

def find_shortest_path(G, orig_lat, orig_lng, dest_lat, dest_lng, avoid_nodes=None):
    """
    Find the shortest path between two coordinates on the road network.
    """
    orig_node = nearest_node(G, orig_lng, orig_lat)
    dest_node = nearest_node(G, dest_lng, dest_lat, avoid_nodes=avoid_nodes)
    
    if orig_node is None or dest_node is None:
        return {"error": "Could not find nearby road network nodes."}
        
    try:
        routing_graph = G
        if avoid_nodes:
            # Create a subgraph view without the flooded nodes
            safe_nodes = set(G.nodes()) - avoid_nodes
            routing_graph = G.subgraph(safe_nodes)
            
            # Make sure origin is in routing_graph, otherwise routing fails immediately
            if orig_node not in routing_graph:
                orig_node = nearest_node(routing_graph, orig_lng, orig_lat)
            if dest_node not in routing_graph:
                dest_node = nearest_node(routing_graph, dest_lng, dest_lat)
                
            if orig_node is None or dest_node is None:
                return {"error": "Origin or destination is entirely surrounded by floods."}
                
        path = nx.shortest_path(routing_graph, orig_node, dest_node, weight='weight')
        distance = nx.shortest_path_length(routing_graph, orig_node, dest_node, weight='weight')
        
        # Build coordinates
        coords = []
        for node in path:
            coords.append([node[0], node[1]]) # [lng, lat]
            
        # Return GeoJSON format
        route_geojson = {
            "type": "Feature",
            "properties": {
                "type": "EvacuationRoute",
                "lengthKm": distance / 1000.0,
                "adaptive": bool(avoid_nodes)
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        }
        
        return {
            "routeGeometry": route_geojson,
            "distanceKm": distance / 1000.0,
            "nodesCount": len(path)
        }
    except nx.NetworkXNoPath:
        return {"error": "No route found. The destination might be blocked by floods."}
    except Exception as e:
        return {"error": str(e)}

if __name__ == '__main__':
    G = build_road_graph()
