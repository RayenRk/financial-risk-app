"""
FinXG — Diagnostic script
Run from ml/ folder: python diagnose.py
Checks the saved model bundle and raw predict_proba output.
"""

import joblib
import numpy as np
import json

MODEL_PATH = "models/risk_model.pkl"
META_PATH  = "models/model_meta.json"

print("=" * 60)
print("1. LOADING BUNDLE")
print("=" * 60)
bundle = joblib.load(MODEL_PATH)
print(f"   Bundle keys     : {list(bundle.keys())}")
print(f"   Model type      : {type(bundle['model']).__name__}")
print(f"   Label encoder   : {type(bundle['label_encoder']).__name__}")
print(f"   Classes         : {bundle['label_encoder'].classes_}")
print(f"   Features        : {bundle['features']}")

model        = bundle["model"]
le           = bundle["label_encoder"]
feature_cols = bundle["features"]

print("\n" + "=" * 60)
print("2. LOADING META")
print("=" * 60)
with open(META_PATH) as f:
    meta = json.load(f)
print(f"   model_type      : {meta.get('model_type')}")
print(f"   metrics         : {meta.get('metrics')}")
print(f"   trained_at      : {meta.get('trained_at')}")

print("\n" + "=" * 60)
print("3. RAW predict_proba ON SYNTHETIC INPUTS")
print("=" * 60)

# Three test cases: clearly low, clearly high, borderline medium
test_cases = {
    "healthy company (should be low_risk)": [
        0.60,   # gross_margin
        0.25,   # operating_margin
        0.18,   # net_margin
        0.15,   # fcf_margin
        0.20,   # roe
        0.10,   # roa
        0.30,   # debt_to_equity
        2.50,   # current_ratio
        15.0,   # interest_coverage
        0.80,   # asset_turnover
        0.12,   # revenue_growth_yoy
    ],
    "distressed company (should be high_risk)": [
        0.05,   # gross_margin
       -0.10,   # operating_margin
       -0.20,   # net_margin
       -0.15,   # fcf_margin
       -0.05,   # roe
       -0.03,   # roa
        3.50,   # debt_to_equity
        0.60,   # current_ratio
        0.80,   # interest_coverage
        0.40,   # asset_turnover
       -0.15,   # revenue_growth_yoy
    ],
    "borderline company (should be medium_risk)": [
        0.30,   # gross_margin
        0.05,   # operating_margin
        0.02,   # net_margin
        0.03,   # fcf_margin
        0.06,   # roe
        0.03,   # roa
        1.80,   # debt_to_equity
        1.10,   # current_ratio
        2.00,   # interest_coverage
        0.60,   # asset_turnover
       -0.05,   # revenue_growth_yoy
    ],
}

for name, values in test_cases.items():
    X      = np.array([values], dtype=np.float32)
    pred   = model.predict(X)[0]
    proba  = model.predict_proba(X)[0]
    label  = le.inverse_transform([pred])[0]
    print(f"\n   [{name}]")
    print(f"   Predicted label : {label}")
    print(f"   Raw probabilities:")
    for cls, p in zip(le.classes_, proba):
        bar = "█" * int(p * 30)
        print(f"      {cls:<15} {p:.6f}  {bar}")
    print(f"   confidence (max): {proba.max():.6f}  →  displayed as {round(float(proba.max()), 4) * 100:.2f}%")

print("\n" + "=" * 60)
print("4. DIAGNOSIS")
print("=" * 60)

# Run all test cases and check if any proba is exactly 1.0
all_max = []
for name, values in test_cases.items():
    X     = np.array([values], dtype=np.float32)
    proba = model.predict_proba(X)[0]
    all_max.append(proba.max())

if all(p == 1.0 for p in all_max):
    print("   ❌ All probabilities are exactly 1.0 — model is overfit or wrong file loaded")
elif all(p > 0.99 for p in all_max):
    print("   ⚠️  Probabilities are very high (>99%) but not exactly 1.0")
    print("      This is a display rounding issue — confidence is real but extreme")
    print("      Fix: display more decimal places, or apply probability calibration")
else:
    print("   ✅ Probabilities vary normally — model is working correctly")
    print("      The 100% display is a frontend rounding issue (round to 4 decimals then × 100)")
    print("      Fix: display as percentage with more precision in the frontend")

print("\n   Max probabilities across test cases:")
for (name, _), p in zip(test_cases.items(), all_max):
    print(f"      {p:.8f}  [{name}]")
