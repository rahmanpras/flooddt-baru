"""
RAKIT v2 - Train ML model with processed real Bandung rainfall data.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler
import joblib
import os
import json
from datetime import datetime

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

# Load processed real data
data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', 'data', 'rainfall',
                         'processed_rainfall_features.csv')
print(f"[ML] Loading processed real data from: {data_path}")
df = pd.read_csv(data_path)
print(f"[ML] Loaded {len(df)} records")
print(f"[ML] Columns: {list(df.columns)}")

# Select features and target
feature_cols = ['mean_rain_mm', 'median_rain_mm', 'n_stations', 'month',
                'is_wet_season', 'rain_3day_avg', 'rain_7day_avg', 'rain_cumulative_3day']
target_col = 'flood_depth_m'

X = df[feature_cols].fillna(0)
y = df[target_col]

print(f"[ML] Features: {feature_cols}")
print(f"[ML] Target stats: mean={y.mean():.4f}, max={y.max():.4f}, min={y.min():.4f}")

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train
print("\n[ML] Training GradientBoosting model on REAL Bandung rainfall data...")
model = GradientBoostingRegressor(
    n_estimators=300,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    random_state=42
)
model.fit(X_train_scaled, y_train)

# Evaluate
y_pred = model.predict(X_test_scaled)

metrics = {
    "r2_score": float(r2_score(y_test, y_pred)),
    "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
    "mae": float(mean_absolute_error(y_test, y_pred)),
    "trained_on": "real_bandung_2016_2021",
    "n_samples": len(df),
    "n_features": len(feature_cols),
    "feature_names": feature_cols,
    "timestamp": datetime.now().isoformat()
}

# Feature importance
importances = dict(zip(feature_cols, [float(x) for x in model.feature_importances_]))
metrics["feature_importance"] = dict(sorted(importances.items(), key=lambda x: x[1], reverse=True))

print(f"\n[ML] === Model Performance (Real Data) ===")
print(f"     R² Score:  {metrics['r2_score']:.4f}")
print(f"     RMSE:      {metrics['rmse']:.4f} m")
print(f"     MAE:       {metrics['mae']:.4f} m")
print(f"\n[ML] Feature Importance:")
for feat, imp in metrics["feature_importance"].items():
    bar = '#' * int(imp * 50)
    print(f"     {feat:25s} {imp:.4f} {bar}")

# Save
joblib.dump(model, os.path.join(MODEL_DIR, 'flood_predictor.pkl'))
joblib.dump(scaler, os.path.join(MODEL_DIR, 'scaler.pkl'))
with open(os.path.join(MODEL_DIR, 'training_metrics.json'), 'w') as f:
    json.dump(metrics, f, indent=2)

print(f"\n[ML] Model saved to {MODEL_DIR}")

# Test predictions with realistic Bandung scenarios
print("\n--- Prediction Tests (Real Model) ---")
scenarios = [
    {"mean_rain_mm": 5, "label": "Gerimis (5 mm)"},
    {"mean_rain_mm": 30, "label": "Hujan sedang (30 mm)"},
    {"mean_rain_mm": 80, "label": "Hujan lebat (80 mm)"},
    {"mean_rain_mm": 135, "label": "Hujan ekstrem (135 mm - max historis)"},
]

for s in scenarios:
    features = pd.DataFrame([{
        'mean_rain_mm': s['mean_rain_mm'],
        'median_rain_mm': s['mean_rain_mm'] * 0.7,
        'n_stations': 20,
        'month': 1,
        'is_wet_season': 1,
        'rain_3day_avg': s['mean_rain_mm'] * 0.8,
        'rain_7day_avg': s['mean_rain_mm'] * 0.6,
        'rain_cumulative_3day': s['mean_rain_mm'] * 2.4,
    }])
    features_scaled = scaler.transform(features)
    pred = max(0, model.predict(features_scaled)[0])
    
    if pred >= 1.0: risk = "CRITICAL"
    elif pred >= 0.5: risk = "DANGER"
    elif pred >= 0.3: risk = "WARNING"
    else: risk = "SAFE"
    
    print(f"\n  {s['label']}:")
    print(f"    Predicted flood depth: {pred:.3f} m")
    print(f"    Risk level: {risk}")
