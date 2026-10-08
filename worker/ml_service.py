"""
RAKIT v2 - ML Flask API Service
Serves flood predictions and OSM-based evacuation routing via REST API.
Runs on port 5000, called by the Node.js frontend server.
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from flood_predictor import FloodPredictor
from osm_roads import build_road_graph, find_shortest_path, get_flooded_nodes
import os
import json

app = Flask(__name__)
CORS(app)

# Initialize ML model
predictor = FloodPredictor()
road_graph = None

# Shelter locations (same as v1)
SHELTERS = [
    {"name": "Shelter Gedebage", "lat": -6.9432, "lng": 107.6890, "capacity": 500},
    {"name": "Shelter Arcamanik", "lat": -6.9200, "lng": 107.6670, "capacity": 350},
    {"name": "Shelter Kordon", "lat": -6.9150, "lng": 107.6100, "capacity": 400},
    {"name": "Shelter Bojonagara", "lat": -6.9000, "lng": 107.5850, "capacity": 600},
    {"name": "Shelter Cibeunying", "lat": -6.8950, "lng": 107.6300, "capacity": 300},
]

@app.route('/api/ml/status', methods=['GET'])
def ml_status():
    """Check ML model and road graph status."""
    model_loaded = predictor.model is not None
    graph_loaded = road_graph is not None
    
    metrics = {}
    metrics_path = os.path.join(os.path.dirname(__file__), 'models', 'training_metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            metrics = json.load(f)
    
    return jsonify({
        "model_loaded": model_loaded,
        "graph_loaded": graph_loaded,
        "graph_nodes": road_graph.number_of_nodes() if graph_loaded else 0,
        "graph_edges": road_graph.number_of_edges() if graph_loaded else 0,
        "metrics": metrics
    })

@app.route('/api/ml/train', methods=['POST'])
def train_model():
    """Train or retrain the ML model."""
    try:
        metrics = predictor.train(use_synthetic=True)
        return jsonify({"success": True, "metrics": metrics})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ml/predict', methods=['POST'])
def predict_flood():
    """Predict flood depth from rainfall parameters."""
    data = request.json
    
    try:
        result = predictor.predict(
            mean_rain_mm=float(data.get('rainfall_mm', 100)),
            rain_3day_avg=float(data.get('rain_3day_avg', 50)),
            rain_7day_avg=float(data.get('rain_7day_avg', 30)),
            is_wet_season=int(data.get('season', 1))
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ml/route', methods=['POST'])
def evacuation_route():
    """
    Calculate evacuation route using real OSM road data.
    
    Algorithm 1 Validated (Step 4 — Synchronization):
    ML prediction provides warning level only. Road pruning based on
    flood depth is handled by the Node.js backend (Step 6) after the
    hydraulic depth grid is available. This prevents the race condition
    of pruning the graph before hydraulic results are complete.
    """
    global road_graph
    
    if road_graph is None:
        try:
            road_graph = build_road_graph()
        except Exception as e:
            return jsonify({"error": f"Failed to load road graph: {str(e)}"}), 500
    
    data = request.json
    lat = float(data.get('lat'))
    lng = float(data.get('lng'))
    warning_level = data.get('warning_level', 'SAFE')
    
    # Find nearest shelter (simple Euclidean for now)
    import math
    best_shelter = None
    best_dist = float('inf')
    for s in SHELTERS:
        d = math.sqrt((lat - s['lat'])**2 + (lng - s['lng'])**2)
        if d < best_dist:
            best_dist = d
            best_shelter = s
    
    # Calculate route using real OSM roads
    # Note: Per Algorithm 1 validated, we do NOT prune nodes here.
    # Flood-aware edge weight modification happens in server.js Step 6
    # using the cached depth grid from the hydraulic simulation.
    result = find_shortest_path(
        road_graph, lat, lng,
        best_shelter['lat'], best_shelter['lng'],
        avoid_nodes=None  # No pruning — synchronization barrier respected
    )
    
    if 'error' in result:
        return jsonify(result), 400
    
    return jsonify({
        "routeGeometry": result["routeGeometry"],
        "targetShelter": best_shelter,
        "distance_km": result['distanceKm'],
        "warning_level": warning_level
    })

@app.route('/api/ml/load-roads', methods=['POST'])
def load_roads():
    """Load or build the real road network for Bandung."""
    global road_graph
    try:
        road_graph = build_road_graph()
        return jsonify({
            "success": True,
            "nodes": road_graph.number_of_nodes(),
            "edges": road_graph.number_of_edges()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ml/roads-geojson', methods=['GET'])
def get_roads_geojson():
    """Return the OSM roads as GeoJSON for frontend visualization."""
    geojson_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'backend', 'data', 'roads', 'bandung_roads_osm.geojson'
    )
    if os.path.exists(geojson_path):
        with open(geojson_path) as f:
            return jsonify(json.load(f))
    return jsonify({"error": "Roads GeoJSON not found. Load roads first."}), 404


if __name__ == '__main__':
    print("=== RAKIT v2: ML API Service ===")
    
    # Auto-train if no model exists
    if not predictor.load_model():
        print("[ML] No saved model found. Training with synthetic data...")
        predictor.train(use_synthetic=True)
    
    print(f"[ML] Starting Flask API on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)
