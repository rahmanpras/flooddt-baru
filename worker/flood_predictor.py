"""
RAKIT v2 - Flood Prediction ML Model
Trains a Random Forest model on historical rainfall-flood data pairs.
Predicts flood inundation risk levels based on rainfall input.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler
import joblib
import os
import json
from datetime import datetime

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', 'data', 'rainfall')

class FloodPredictor:
    """ML-based flood depth predictor using historical rainfall-flood pairs."""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.model_path = os.path.join(MODEL_DIR, 'flood_predictor.pkl')
        self.scaler_path = os.path.join(MODEL_DIR, 'scaler.pkl')
        self.metrics_path = os.path.join(MODEL_DIR, 'training_metrics.json')
        self.threshold_warning = 0.3   # meters - issue warning
        self.threshold_danger = 0.5    # meters - trigger evacuation
        self.threshold_critical = 1.0  # meters - critical flooding
        
        os.makedirs(MODEL_DIR, exist_ok=True)
    
    def generate_synthetic_training_data(self, n_samples=2000):
        """
        Generate realistic synthetic training data based on Bandung's
        hydrological characteristics for model demonstration.
        Real data should be placed in backend/data/rainfall/.
        """
        np.random.seed(42)
        
        # Features: rainfall_mm, duration_hours, antecedent_moisture, elevation_m, imperviousness
        rainfall_mm = np.random.exponential(scale=40, size=n_samples) + 5
        duration_hours = np.random.uniform(1, 48, n_samples)
        antecedent_moisture = np.random.uniform(0.1, 1.0, n_samples)  # 0=dry, 1=saturated
        elevation_m = np.random.uniform(650, 800, n_samples)  # Bandung basin elevation range
        imperviousness = np.random.uniform(0.2, 0.95, n_samples)  # Urban land cover fraction
        slope_pct = np.random.uniform(0, 15, n_samples)
        
        # Calculate flood depth based on physics-inspired relationships
        # Higher rainfall, longer duration, wetter soil, lower elevation, more impervious = deeper flood
        intensity = rainfall_mm / duration_hours
        runoff_coeff = 0.3 + 0.5 * imperviousness + 0.2 * antecedent_moisture
        
        base_depth = (
            0.008 * rainfall_mm * runoff_coeff
            + 0.02 * intensity
            - 0.003 * (elevation_m - 650)
            - 0.015 * slope_pct
            + 0.1 * antecedent_moisture
        )
        
        # Add noise
        noise = np.random.normal(0, 0.05, n_samples)
        flood_depth_m = np.maximum(0, base_depth + noise)
        
        df = pd.DataFrame({
            'rainfall_mm': rainfall_mm,
            'duration_hours': duration_hours,
            'antecedent_moisture': antecedent_moisture,
            'elevation_m': elevation_m,
            'imperviousness': imperviousness,
            'slope_pct': slope_pct,
            'intensity_mm_hr': intensity,
            'flood_depth_m': flood_depth_m
        })
        
        return df
    
    def load_real_data(self, filepath=None):
        """
        Load real historical rainfall-flood data from CSV.
        Expected columns: rainfall_mm, duration_hours, flood_depth_m
        Optional columns: antecedent_moisture, elevation_m, imperviousness, slope_pct
        """
        if filepath is None:
            # Look for CSV files in the rainfall data directory
            csv_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
            if not csv_files:
                print("[ML] No real data found in backend/data/rainfall/. Using synthetic data.")
                return None
            filepath = os.path.join(DATA_DIR, csv_files[0])
        
        print(f"[ML] Loading real data from: {filepath}")
        df = pd.read_csv(filepath)
        print(f"[ML] Loaded {len(df)} records with columns: {list(df.columns)}")
        return df
    
    def train(self, data=None, use_synthetic=False):
        """Train the flood prediction model."""
        if data is None:
            real_data = self.load_real_data()
            if real_data is not None and not use_synthetic:
                data = real_data
            else:
                print("[ML] Generating synthetic training data for demonstration...")
                data = self.generate_synthetic_training_data()
                use_synthetic = True
        
        feature_cols = [c for c in data.columns if c != 'flood_depth_m']
        X = data[feature_cols]
        y = data['flood_depth_m']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train Random Forest
        print("[ML] Training Random Forest model...")
        self.model = GradientBoostingRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        
        metrics = {
            "r2_score": float(r2_score(y_test, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
            "mae": float(mean_absolute_error(y_test, y_pred)),
            "trained_on": "synthetic" if use_synthetic else "real",
            "n_samples": len(data),
            "n_features": len(feature_cols),
            "feature_names": feature_cols,
            "timestamp": datetime.now().isoformat()
        }
        
        # Feature importance
        importances = dict(zip(feature_cols, [float(x) for x in self.model.feature_importances_]))
        metrics["feature_importance"] = dict(sorted(importances.items(), key=lambda x: x[1], reverse=True))
        
        print(f"[ML] Model Performance:")
        print(f"     R² Score:  {metrics['r2_score']:.4f}")
        print(f"     RMSE:      {metrics['rmse']:.4f} m")
        print(f"     MAE:       {metrics['mae']:.4f} m")
        print(f"     Features:  {feature_cols}")
        
        # Save model
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        with open(self.metrics_path, 'w') as f:
            json.dump(metrics, f, indent=2)
        
        print(f"[ML] Model saved to {self.model_path}")
        return metrics
    
    def load_model(self):
        """Load a previously trained model."""
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            print("[ML] Model loaded successfully.")
            return True
        return False
    
    def predict(self, mean_rain_mm, rain_3day_avg, rain_7day_avg, is_wet_season):
        """
        Predict flood depth for given conditions.
        
        Returns:
            dict with predicted depth, risk level, and evacuation recommendation
        """
        if self.model is None:
            if not self.load_model():
                raise ValueError("No trained model found. Call train() first.")
        
        features = pd.DataFrame([{
            'mean_rain_mm': mean_rain_mm,
            'median_rain_mm': mean_rain_mm * 0.7,
            'n_stations': 20,
            'month': 1 if is_wet_season else 7,
            'is_wet_season': is_wet_season,
            'rain_3day_avg': rain_3day_avg,
            'rain_7day_avg': rain_7day_avg,
            'rain_cumulative_3day': rain_3day_avg * 3,
        }])
        
        features_scaled = self.scaler.transform(features)
        predicted_depth = float(max(0, self.model.predict(features_scaled)[0]))
        
        # Determine risk level
        if predicted_depth >= self.threshold_critical:
            risk_level = "CRITICAL"
            evacuate = True
            color = "#dc2626"
        elif predicted_depth >= self.threshold_danger:
            risk_level = "DANGER"
            evacuate = True
            color = "#f97316"
        elif predicted_depth >= self.threshold_warning:
            risk_level = "WARNING"
            evacuate = False
            color = "#facc15"
        else:
            risk_level = "SAFE"
            evacuate = False
            color = "#22c55e"
        
        return {
            "predicted_depth_m": round(predicted_depth, 3),
            "risk_level": risk_level,
            "evacuate": evacuate,
            "color": color,
            "input": {
                "mean_rain_mm": mean_rain_mm,
                "rain_3day_avg": rain_3day_avg,
                "rain_7day_avg": rain_7day_avg
            }
        }


if __name__ == '__main__':
    print("=== RAKIT v2: Flood Prediction ML Module ===\n")
    
    predictor = FloodPredictor()
    
    # Train
    metrics = predictor.train(use_synthetic=True)
    
    # Test predictions
    print("\n--- Prediction Tests ---")
    scenarios = [
        {"rainfall_mm": 50, "duration_hours": 6, "label": "Light rain (50mm/6hr)"},
        {"rainfall_mm": 100, "duration_hours": 4, "label": "Moderate rain (100mm/4hr)"},
        {"rainfall_mm": 150, "duration_hours": 3, "label": "Heavy rain (150mm/3hr)"},
        {"rainfall_mm": 250, "duration_hours": 2, "label": "Extreme rain (250mm/2hr)"},
    ]
    
    for s in scenarios:
        result = predictor.predict(s["rainfall_mm"], s["duration_hours"])
        print(f"\n{s['label']}:")
        print(f"  Predicted depth: {result['predicted_depth_m']:.3f} m")
        print(f"  Risk level: {result['risk_level']}")
        print(f"  Evacuate: {'YES' if result['evacuate'] else 'No'}")
