"""
RAKIT v2 - Data Preparation Script
Processes real rainfall CSV and road shapefile into ML-ready formats.
"""
import pandas as pd
import os
import json
import sys

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', 'data')

def process_rainfall_data():
    """
    Load and process the real Bandung rainfall CSV data (2016-2021).
    Creates ML-ready features from daily rainfall records.
    """
    rainfall_dir = os.path.join(DATA_DIR, 'rainfall')
    
    # Load the 5-year daily summary
    csv_path = os.path.join(rainfall_dir, 'bandung_rainfall_city_daily_summary_2016_2021.csv')
    if not os.path.exists(csv_path):
        print(f"[Data] File not found: {csv_path}")
        return None
    
    df = pd.read_csv(csv_path, parse_dates=['date'])
    print(f"[Data] Loaded rainfall data: {len(df)} records from {df['date'].min()} to {df['date'].max()}")
    print(f"[Data] Columns: {list(df.columns)}")
    print(f"[Data] Mean rainfall: {df['mean_rain_mm'].mean():.2f} mm/day")
    print(f"[Data] Max rainfall: {df['mean_rain_mm'].max():.2f} mm/day")
    
    # Feature engineering for ML
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month
    df['day_of_year'] = df['date'].dt.dayofyear
    df['is_wet_season'] = df['month'].isin([10, 11, 12, 1, 2, 3]).astype(int)
    
    # Rolling features (antecedent moisture proxy)
    df['rain_3day_avg'] = df['mean_rain_mm'].rolling(window=3, min_periods=1).mean()
    df['rain_7day_avg'] = df['mean_rain_mm'].rolling(window=7, min_periods=1).mean()
    df['rain_cumulative_3day'] = df['mean_rain_mm'].rolling(window=3, min_periods=1).sum()
    
    # Simulate flood depth target based on SCS-CN relationship
    # This creates a realistic flood depth target using the rainfall data
    CN = 80  # Average curve number for urban Bandung
    S = (25400 / CN) - 254  # Maximum retention
    Ia = 0.2 * S  # Initial abstraction
    
    P = df['mean_rain_mm'].values
    antecedent = df['rain_3day_avg'].values
    
    # SCS-CN runoff
    Q = np.where(P > Ia, ((P - Ia)**2) / (P - Ia + S), 0)
    
    # Convert runoff to approximate flood depth (simplified)
    # Account for urban drainage capacity (~10mm/hr) and antecedent moisture
    drainage_capacity = 10.0  # mm
    effective_runoff = np.maximum(0, Q - drainage_capacity)
    moisture_factor = 1 + 0.5 * (antecedent / antecedent.max())
    
    flood_depth_m = effective_runoff * moisture_factor * 0.005  # Scale to meters
    flood_depth_m = np.maximum(0, flood_depth_m + np.random.normal(0, 0.02, len(flood_depth_m)))
    
    df['flood_depth_m'] = flood_depth_m
    
    # Save processed data
    output_path = os.path.join(rainfall_dir, 'processed_rainfall_features.csv')
    df.to_csv(output_path, index=False)
    print(f"\n[Data] Processed features saved to: {output_path}")
    print(f"[Data] Feature columns: {[c for c in df.columns if c != 'date']}")
    print(f"[Data] Flood depth stats:")
    print(f"       Mean: {df['flood_depth_m'].mean():.4f} m")
    print(f"       Max:  {df['flood_depth_m'].max():.4f} m")
    print(f"       Days with flooding (>0.1m): {(df['flood_depth_m'] > 0.1).sum()}")
    
    return df

def process_road_shapefile():
    """
    Load and convert the real Bandung road shapefile to GeoJSON.
    """
    import geopandas as gpd
    
    roads_dir = os.path.join(DATA_DIR, 'roads')
    shp_path = os.path.join(roads_dir, 'JALAN_LN_25K.shp')
    
    if not os.path.exists(shp_path):
        print(f"[Data] Shapefile not found: {shp_path}")
        return None
    
    print(f"[Data] Loading shapefile: {shp_path}")
    os.environ['SHAPE_RESTORE_SHX'] = 'YES'
    gdf = gpd.read_file(shp_path)
    
    print(f"[Data] Road network loaded: {len(gdf)} segments")
    print(f"[Data] Columns: {list(gdf.columns)}")
    print(f"[Data] CRS: {gdf.crs}")
    print(f"[Data] Bounds: {gdf.total_bounds}")
    
    # Reproject to WGS84 if needed
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f"[Data] Reprojecting from {gdf.crs} to EPSG:4326 (WGS84)...")
        gdf = gdf.to_crs(epsg=4326)
    
    # Export as GeoJSON for the web frontend
    geojson_path = os.path.join(roads_dir, 'bandung_roads_real.geojson')
    gdf.to_file(geojson_path, driver='GeoJSON')
    print(f"[Data] Roads exported to: {geojson_path}")
    print(f"[Data] File size: {os.path.getsize(geojson_path) / 1024:.1f} KB")
    
    # Print sample attributes
    print(f"\n[Data] Sample road attributes:")
    print(gdf.head(3).to_string())
    
    return gdf


import numpy as np

if __name__ == '__main__':
    print("=== RAKIT v2: Data Preparation ===\n")
    
    print("--- Processing Rainfall Data ---")
    rainfall_df = process_rainfall_data()
    
    print("\n--- Processing Road Shapefile ---")
    road_gdf = process_road_shapefile()
    
    print("\n=== Data Preparation Complete ===")
