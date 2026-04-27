"""
Financial Risk Detection — FastAPI Backend
==========================================
Serves EPAM financial data and risk predictions to the React dashboard.

Endpoints:
    GET  /                        health check
    GET  /company                 company metadata
    GET  /dashboard               full dashboard data (all quarters)
    GET  /latest                  latest quarter risk summary
    GET  /quarters                all quarters as list
    GET  /quarters/{date}         single quarter by date (YYYY-MM-DD)
    GET  /predict                 run model on latest EPAM data live
    POST /predict/custom          run model on custom financial inputs
    GET  /shap                    global feature importance
    GET  /metrics                 model performance metrics

Run:
    uvicorn main:app --reload --port 8000

Requirements:
    pip install fastapi uvicorn joblib pandas pyarrow numpy
"""

import json
import os
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR        = "data"
MODEL_DIR       = "models"
EPAM_DATA_PATH  = os.path.join(DATA_DIR, "epam_data.json")
EPAM_LATEST_PATH= os.path.join(DATA_DIR, "epam_latest.json")
MODEL_PATH      = os.path.join(MODEL_DIR, "risk_model.pkl")
META_PATH       = os.path.join(MODEL_DIR, "model_meta.json")
SHAP_PATH       = os.path.join(MODEL_DIR, "shap_values.parquet")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Financial Risk Detection API",
    description = "Serves EPAM financial data and ML risk predictions",
    version     = "1.0.0",
)

# Allow React dev server (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins   = ["http://localhost:3000", "http://localhost:5173"],
    allow_methods   = ["*"],
    allow_headers   = ["*"],
)

# ── Load all assets at startup ─────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global epam_data, epam_latest, model, le, meta, feature_cols, shap_df

    # EPAM dashboard data
    with open(EPAM_DATA_PATH) as f:
        epam_data = json.load(f)
    with open(EPAM_LATEST_PATH) as f:
        epam_latest = json.load(f)

    # Model bundle
    bundle       = joblib.load(MODEL_PATH)
    model        = bundle["model"]
    le           = bundle["label_encoder"]

    # Metadata
    with open(META_PATH) as f:
        meta = json.load(f)
    feature_cols = meta["feature_cols"]

    # SHAP global importance
    shap_df = pd.read_parquet(SHAP_PATH)

    print("✅ All assets loaded")
    print(f"   Company     : {epam_data['company']['name']}")
    print(f"   Quarters    : {len(epam_data['quarters'])}")
    print(f"   Model F1    : {meta['metrics']['weighted_f1']}")
    print(f"   Model AUC   : {meta['metrics']['weighted_auc']}")


# ── Pydantic models ────────────────────────────────────────────────────────────
class CustomPredictInput(BaseModel):
    """Input for /predict/custom — all financial ratios."""
    gross_margin:       float
    operating_margin:   float
    net_margin:         float
    fcf_margin:         float
    roe:                float
    roa:                float
    debt_to_equity:     float
    current_ratio:      float
    interest_coverage:  float
    asset_turnover:     float
    revenue_growth_yoy: float


# ── Helpers ────────────────────────────────────────────────────────────────────
def risk_color(label: str) -> str:
    return {"low_risk": "#22c55e", "medium_risk": "#f59e0b", "high_risk": "#ef4444"}.get(label, "#6b7280")


def predict_from_features(features: dict) -> dict:
    """Run the model on a dict of feature values and return prediction."""
    X = np.array([[features.get(col, 0.0) for col in feature_cols]], dtype=np.float32)
    y_pred  = model.predict(X)[0]
    y_proba = model.predict_proba(X)[0]
    label   = le.inverse_transform([y_pred])[0]

    proba_dict = {le.classes_[i]: round(float(y_proba[i]), 4) for i in range(len(le.classes_))}

    return {
        "risk_label":   label,
        "risk_color":   risk_color(label),
        "confidence":   round(float(y_proba.max()), 4),
        "probabilities": proba_dict,
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {
        "status":    "ok",
        "service":   "Financial Risk Detection API",
        "version":   "1.0.0",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/company")
def get_company():
    """Company metadata — name, sector, market cap, employees."""
    return epam_data["company"]


@app.get("/dashboard")
def get_dashboard():
    """
    Full dashboard payload — company info, all quarters, summary.
    This is the main endpoint the React dashboard calls on load.
    """
    return {
        "company":  epam_data["company"],
        "quarters": epam_data["quarters"],
        "summary":  epam_data["summary"],
        "shap":     shap_df.to_dict(orient="records"),
        "model":    {
            "f1":         meta["metrics"]["weighted_f1"],
            "auc":        meta["metrics"]["weighted_auc"],
            "trained_at": meta["trained_at"],
            "classes":    meta["classes"],
        },
    }


@app.get("/latest")
def get_latest():
    """Latest quarter risk summary — used for the dashboard header card."""
    latest = epam_latest["latest"]
    return {
        "company":    epam_latest["company"],
        "quarter":    latest,
        "risk_color": risk_color(latest["risk_label"]),
        "summary":    epam_latest["summary"],
    }


@app.get("/quarters")
def get_quarters(
    limit:      Optional[int] = None,
    risk_label: Optional[str] = None,
):
    """
    All quarters as a list.
    Optional filters:
        ?limit=8              return last N quarters
        ?risk_label=high_risk return only high risk quarters
    """
    quarters = epam_data["quarters"]

    if risk_label:
        quarters = [q for q in quarters if q["risk_label"] == risk_label]

    if limit:
        quarters = quarters[-limit:]

    return {"quarters": quarters, "count": len(quarters)}


@app.get("/quarters/{date}")
def get_quarter_by_date(date: str):
    """Single quarter by date string (YYYY-MM-DD)."""
    quarters = epam_data["quarters"]
    match = next((q for q in quarters if q["date"] == date), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"No quarter found for date {date}")
    return {**match, "risk_color": risk_color(match["risk_label"])}


@app.get("/predict")
def predict_latest():
    """
    Run model on the latest quarter's features.
    Returns prediction + explanation.
    """
    latest   = epam_data["quarters"][-1]
    features = {col: latest.get(col, 0.0) for col in feature_cols}
    result   = predict_from_features(features)

    return {
        "date":            latest["date"],
        "input_features":  features,
        "prediction":      result,
        "top_risk_drivers": latest.get("top_risk_drivers", []),
    }


@app.post("/predict/custom")
def predict_custom(inputs: CustomPredictInput):
    """
    Run model on custom financial ratio inputs.
    Use this to score any company — not just EPAM.

    Example body:
    {
        "gross_margin": 0.32,
        "operating_margin": 0.08,
        "net_margin": 0.06,
        "fcf_margin": 0.05,
        "roe": 0.12,
        "roa": 0.07,
        "debt_to_equity": 0.45,
        "current_ratio": 1.8,
        "interest_coverage": 12.0,
        "asset_turnover": 0.9,
        "revenue_growth_yoy": 0.05
    }
    """
    features = inputs.model_dump()
    result   = predict_from_features(features)

    return {
        "input_features": features,
        "prediction":     result,
        "feature_guide": {
            "current_ratio":    "Above 1.5 is healthy, below 1.0 is risky",
            "debt_to_equity":   "Below 1.0 is healthy, above 2.0 is risky",
            "operating_margin": "Above 10% is healthy, negative is risky",
            "interest_coverage":"Above 3x is healthy, below 1x is risky",
        }
    }


@app.get("/shap")
def get_shap():
    """Global feature importance from SHAP — used for the dashboard explanation panel."""
    records = shap_df.to_dict(orient="records")
    return {
        "feature_importance": records,
        "description": "Mean absolute SHAP value — higher means more influence on risk prediction",
    }


@app.get("/metrics")
def get_metrics():
    """Model performance metrics."""
    return {
        "model_type":    meta["model_type"],
        "weighted_f1":   meta["metrics"]["weighted_f1"],
        "weighted_auc":  meta["metrics"]["weighted_auc"],
        "test_rows":     meta["metrics"]["test_rows"],
        "train_cutoff":  meta["train_cutoff"],
        "trained_at":    meta["trained_at"],
        "feature_cols":  feature_cols,
        "classes":       meta["classes"],
        "interpretation": {
            "f1":  "0.91 — strong overall balance of precision and recall",
            "auc": "0.97 — excellent at ranking risk levels correctly",
        }
    }
