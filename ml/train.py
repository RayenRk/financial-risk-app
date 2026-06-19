"""
FinXG — Production Model Training
Trains XGBoost on the clean full dataset and saves to models/
Run from ml/ folder: python train.py
"""

import json, os, warnings
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics         import f1_score, roc_auc_score, classification_report
from sklearn.preprocessing   import LabelEncoder
from sklearn.utils           import resample
import shap
import joblib
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

MODEL_DIR    = "models"
RANDOM_STATE = 42
os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [
    "gross_margin", "operating_margin", "net_margin", "fcf_margin",
    "roe", "roa", "debt_to_equity", "current_ratio",
    "interest_coverage", "asset_turnover", "revenue_growth_yoy",
]
TARGET_COL = "risk_label"

# ── Load & clean data ──────────────────────────────────────────────
print("Loading data...")
df = pd.read_parquet("../data/training_features.parquet")
print(f"   Shape  : {df.shape}")
print(f"   Labels : {df[TARGET_COL].value_counts().to_dict()}")

# Apply same cleaning as retrain_clean.py
df["interest_coverage"]  = df["interest_coverage"].clip(-20, 20)
df["debt_to_equity"]     = df["debt_to_equity"].clip(0, df["debt_to_equity"].quantile(0.99))

for col in FEATURE_COLS:
    df[col] = df.groupby("ticker")[col].transform(lambda x: x.fillna(x.median()))
    df[col] = df.groupby("sector")[col].transform(lambda x: x.fillna(x.median()))
    df[col] = df[col].fillna(df[col].median())

# Balance classes
df_low  = df[df[TARGET_COL] == "low_risk"]
df_med  = df[df[TARGET_COL] == "medium_risk"]
df_high = df[df[TARGET_COL] == "high_risk"]
target  = max(len(df_med), len(df_high))

df_low_d  = resample(df_low,  replace=False, n_samples=min(len(df_low),  target*2), random_state=RANDOM_STATE)
df_med_u  = resample(df_med,  replace=True,  n_samples=target,                      random_state=RANDOM_STATE)
df_high_u = resample(df_high, replace=True,  n_samples=target,                      random_state=RANDOM_STATE)

df_bal = pd.concat([df_low_d, df_med_u, df_high_u]).sample(frac=1, random_state=RANDOM_STATE).reset_index(drop=True)
print(f"\n   Balanced: {df_bal[TARGET_COL].value_counts().to_dict()}")

le = LabelEncoder()
X  = df_bal[FEATURE_COLS].values.astype(np.float32)
y  = le.fit_transform(df_bal[TARGET_COL])

# ── Cross-validation ───────────────────────────────────────────────
print("\nCross-validating...")
model = XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=2,
    use_label_encoder=False,
    eval_metric="mlogloss",
    random_state=RANDOM_STATE,
    verbosity=0,
)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
f1_scores = cross_val_score(model, X, y, cv=cv, scoring="f1_weighted", n_jobs=-1)
print(f"   CV F1: {f1_scores.mean():.4f} ± {f1_scores.std():.4f}")

# ── Train final model on full balanced data ────────────────────────
print("\nTraining final model...")
model.fit(X, y)

y_pred  = model.predict(X)
y_proba = model.predict_proba(X)
f1      = f1_score(y, y_pred, average="weighted")
auc     = roc_auc_score(y, y_proba, multi_class="ovr", average="weighted")

print(f"   F1  : {f1:.4f}")
print(f"   AUC : {auc:.4f}")
print(classification_report(y, y_pred, target_names=le.classes_))

# ── Compute SHAP values ────────────────────────────────────────────
print("Computing SHAP values...")
explainer   = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X)

if isinstance(shap_values, list):
    mean_abs = np.mean([np.abs(sv) for sv in shap_values], axis=0)
elif shap_values.ndim == 3:
    mean_abs = np.abs(shap_values).mean(axis=2)
else:
    mean_abs = np.abs(shap_values)

shap_df = pd.DataFrame({
    "feature":       FEATURE_COLS,
    "mean_abs_shap": mean_abs.mean(axis=0).tolist(),
}).sort_values("mean_abs_shap", ascending=False)

print("\nTop features by SHAP importance:")
print(shap_df.to_string(index=False))

# ── Save everything ────────────────────────────────────────────────
print("\nSaving model...")

# Model bundle
bundle = {"model": model, "label_encoder": le}
joblib.dump(bundle, os.path.join(MODEL_DIR, "risk_model.pkl"))

# SHAP parquet
shap_df.to_parquet(os.path.join(MODEL_DIR, "shap_values.parquet"), index=False)

# Metadata
meta = {
    "model_type":  "XGBClassifier",
    "feature_cols": FEATURE_COLS,
    "classes":      le.classes_.tolist(),
    "trained_at":   datetime.now().isoformat(),
    "training_samples": int(X.shape[0]),
    "metrics": {
        "weighted_f1":  round(float(f1_scores.mean()), 4),
        "weighted_auc": round(float(auc), 4),
        "test_rows":    int(X.shape[0]),
        "cv_f1_std":    round(float(f1_scores.std()), 4),
    },
}
with open(os.path.join(MODEL_DIR, "model_meta.json"), "w") as f:
    json.dump(meta, f, indent=2)

print(f"\n✅ Model saved to {MODEL_DIR}/")
print(f"   risk_model.pkl")
print(f"   shap_values.parquet")
print(f"   model_meta.json")
print(f"\n   CV F1  : {f1_scores.mean():.4f} ± {f1_scores.std():.4f}")
print(f"   AUC    : {auc:.4f}")
print(f"   Samples: {X.shape[0]}")
print(f"\nRestart FastAPI to load the new model:")
print(f"   uvicorn main:app --reload --port 8001")
