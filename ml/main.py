"""
Financial Risk Detection — FastAPI Microservice
================================================
Endpoints:
    GET  /                          health check
    GET  /health                    detailed health check
    POST /analyze                   analyze any ticker — fetch + predict + SHAP
    POST /predict/custom            predict from raw feature values
    GET  /shap                      global feature importance
    GET  /metrics                   model performance metrics

Run:
    uvicorn main:app --reload --port 8001

Note: runs on port 8001 to avoid conflict with Laravel on 8000.

Requirements:
    pip install fastapi uvicorn joblib pandas numpy yfinance shap scikit-learn xgboost
"""

import json
import os
import time
import warnings
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
import pandas as pd
import shap
import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
MODEL_DIR  = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.pkl")
META_PATH  = os.path.join(MODEL_DIR, "model_meta.json")
SHAP_PATH  = os.path.join(MODEL_DIR, "shap_values.parquet")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Financial Risk ML Microservice",
    description = "XGBoost risk scoring for any publicly listed company",
    version     = "2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_methods = ["*"],
    allow_headers = ["*"],
)

# ── Global state ───────────────────────────────────────────────────────────────
model        = None
le           = None
meta         = None
feature_cols = None
shap_df      = None
explainer    = None


@app.on_event("startup")
async def startup():
    global model, le, meta, feature_cols, shap_df, explainer

    bundle       = joblib.load(MODEL_PATH)
    model        = bundle["model"]
    le           = bundle["label_encoder"]

    with open(META_PATH) as f:
        meta = json.load(f)
    feature_cols = meta["feature_cols"]

    shap_df   = pd.read_parquet(SHAP_PATH)
    explainer = shap.TreeExplainer(model)

    print("✅ Model loaded")
    print(f"   Features : {feature_cols}")
    print(f"   Classes  : {meta['classes']}")
    print(f"   F1       : {meta['metrics']['weighted_f1']}")


# ── Pydantic models ────────────────────────────────────────────────────────────
class CustomPredictInput(BaseModel):
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


class AnalyzeRequest(BaseModel):
    ticker: str
    period: Optional[str] = "quarterly"  # quarterly or annual


# ── Data helpers ───────────────────────────────────────────────────────────────
def safe_transpose(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    t = df.T.copy()
    t.index = pd.to_datetime(t.index)
    t.index.name = "date"
    return t


def get_col(df: pd.DataFrame, *candidates) -> pd.Series:
    for c in candidates:
        if c in df.columns:
            return df[c]
    return pd.Series(0.0, index=df.index)


def fetch_company_data(ticker: str) -> dict:
    """Fetch financials and company info from yfinance."""
    tk   = yf.Ticker(ticker.upper())
    info = tk.info or {}

    if not info or info.get("quoteType") is None:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found on Yahoo Finance.")

    income   = safe_transpose(tk.quarterly_financials)
    balance  = safe_transpose(tk.quarterly_balance_sheet)
    cashflow = safe_transpose(tk.quarterly_cashflow)

    return {
        "info":     info,
        "income":   income,
        "balance":  balance,
        "cashflow": cashflow,
    }


def engineer_features(data: dict) -> pd.DataFrame:
    """Merge statements and compute all 11 risk features."""
    inc      = data["income"]
    bal      = data["balance"]
    cf       = data["cashflow"]

    if inc.empty and bal.empty:
        return pd.DataFrame()

    frames = [f for f in [inc, bal, cf] if not f.empty]
    base   = frames[0].copy()
    for f in frames[1:]:
        base = base.join(f, how="outer", rsuffix="_dup")
    base = base.loc[:, ~base.columns.str.endswith("_dup")].sort_index()

    df = pd.DataFrame(index=base.index)
    df["date"] = base.index

    # Raw financials
    df["revenue"]             = get_col(base, "Total Revenue", "Revenue")
    df["gross_profit"]        = get_col(base, "Gross Profit")
    df["operating_income"]    = get_col(base, "Operating Income", "EBIT")
    df["net_income"]          = get_col(base, "Net Income")
    df["interest_expense"]    = get_col(base, "Interest Expense").abs()
    df["total_assets"]        = get_col(base, "Total Assets")
    df["total_equity"]        = get_col(base, "Stockholders Equity", "Total Stockholders Equity")
    df["current_assets"]      = get_col(base, "Current Assets")
    df["current_liabilities"] = get_col(base, "Current Liabilities")
    df["total_debt"]          = get_col(base, "Total Debt", "Long Term Debt")
    df["cash"]                = get_col(base, "Cash And Cash Equivalents",
                                               "Cash Cash Equivalents And Short Term Investments")
    df["operating_cash_flow"] = get_col(base, "Operating Cash Flow",
                                               "Cash Flow From Continuing Operating Activities")
    df["capex"]               = get_col(base, "Capital Expenditure").abs()
    df["free_cash_flow"]      = df["operating_cash_flow"] - df["capex"]

    # Engineered ratios (model features)
    eps = 1e-9
    df["gross_margin"]       = df["gross_profit"]     / (df["revenue"].abs() + eps)
    df["operating_margin"]   = df["operating_income"] / (df["revenue"].abs() + eps)
    df["net_margin"]         = df["net_income"]        / (df["revenue"].abs() + eps)
    df["fcf_margin"]         = df["free_cash_flow"]    / (df["revenue"].abs() + eps)
    df["roe"]                = df["net_income"]        / (df["total_equity"].abs() + eps)
    df["roa"]                = df["net_income"]        / (df["total_assets"].abs() + eps)
    df["debt_to_equity"]     = df["total_debt"]        / (df["total_equity"].abs() + eps)
    df["current_ratio"]      = df["current_assets"]    / (df["current_liabilities"].abs() + eps)
    df["interest_coverage"]  = df["operating_income"]  / (df["interest_expense"] + eps)
    df["asset_turnover"]     = df["revenue"]            / (df["total_assets"].abs() + eps)
    df["revenue_growth_yoy"] = df["revenue"].pct_change(periods=4)

    # Clip outliers
    ratio_cols = [
        "gross_margin", "operating_margin", "net_margin", "fcf_margin",
        "roe", "roa", "debt_to_equity", "current_ratio",
        "interest_coverage", "asset_turnover", "revenue_growth_yoy"
    ]
    df[ratio_cols] = df[ratio_cols].clip(-100, 100)

    # Fill NaN with median
    for col in feature_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())

    df = df.reset_index(drop=True)
    return df


def compute_data_quality(df: pd.DataFrame) -> float:
    """Compute what % of model features are present (not zero from fill)."""
    if df.empty:
        return 0.0
    present = sum(1 for col in feature_cols if col in df.columns and df[col].notna().any())
    return round(present / len(feature_cols) * 100, 1)


def score_quarters(df: pd.DataFrame) -> list:
    """Run model on all quarters and return predictions with SHAP."""
    if df.empty or len(df) == 0:
        return []

    X = df[feature_cols].values.astype(np.float32)

    y_pred      = model.predict(X)
    y_proba     = model.predict_proba(X)
    shap_values = explainer.shap_values(X)

    # Handle 3D SHAP output
    if isinstance(shap_values, list):
        mean_abs = np.mean([np.abs(sv) for sv in shap_values], axis=0)
    elif shap_values.ndim == 3:
        mean_abs = np.abs(shap_values).mean(axis=2)
    else:
        mean_abs = np.abs(shap_values)

    results = []
    for i in range(len(df)):
        label      = le.inverse_transform([y_pred[i]])[0]
        proba      = y_proba[i]
        row_shap   = mean_abs[i]
        top_idx    = np.argsort(row_shap)[::-1][:3]
        drivers    = [
            {"feature": feature_cols[j], "importance": round(float(row_shap[j]), 4)}
            for j in top_idx
        ]

        proba_dict = {le.classes_[k]: round(float(proba[k]), 4) for k in range(len(le.classes_))}

        results.append({
            "date":             df["date"].iloc[i].strftime("%Y-%m-%d") if hasattr(df["date"].iloc[i], "strftime") else str(df["date"].iloc[i])[:10],
            "risk_label":       label,
            "risk_color":       {"low_risk": "#22c55e", "medium_risk": "#f59e0b", "high_risk": "#ef4444"}.get(label, "#6b7280"),
            "confidence":       round(float(proba.max()), 4),
            "probabilities":    proba_dict,
            "top_risk_drivers": drivers,
            # Raw financials
            "revenue":          round(float(df["revenue"].iloc[i]) / 1e6, 2) if pd.notna(df["revenue"].iloc[i]) else None,
            "gross_profit":     round(float(df["gross_profit"].iloc[i]) / 1e6, 2) if pd.notna(df["gross_profit"].iloc[i]) else None,
            "operating_income": round(float(df["operating_income"].iloc[i]) / 1e6, 2) if pd.notna(df["operating_income"].iloc[i]) else None,
            "net_income":       round(float(df["net_income"].iloc[i]) / 1e6, 2) if pd.notna(df["net_income"].iloc[i]) else None,
            "free_cash_flow":   round(float(df["free_cash_flow"].iloc[i]) / 1e6, 2) if pd.notna(df["free_cash_flow"].iloc[i]) else None,
            "total_debt":       round(float(df["total_debt"].iloc[i]) / 1e6, 2) if pd.notna(df["total_debt"].iloc[i]) else None,
            "cash":             round(float(df["cash"].iloc[i]) / 1e6, 2) if pd.notna(df["cash"].iloc[i]) else None,
            # Ratios
            "gross_margin":       round(float(df["gross_margin"].iloc[i]), 4) if pd.notna(df["gross_margin"].iloc[i]) else None,
            "operating_margin":   round(float(df["operating_margin"].iloc[i]), 4) if pd.notna(df["operating_margin"].iloc[i]) else None,
            "net_margin":         round(float(df["net_margin"].iloc[i]), 4) if pd.notna(df["net_margin"].iloc[i]) else None,
            "fcf_margin":         round(float(df["fcf_margin"].iloc[i]), 4) if pd.notna(df["fcf_margin"].iloc[i]) else None,
            "roe":                round(float(df["roe"].iloc[i]), 4) if pd.notna(df["roe"].iloc[i]) else None,
            "roa":                round(float(df["roa"].iloc[i]), 4) if pd.notna(df["roa"].iloc[i]) else None,
            "debt_to_equity":     round(float(df["debt_to_equity"].iloc[i]), 4) if pd.notna(df["debt_to_equity"].iloc[i]) else None,
            "current_ratio":      round(float(df["current_ratio"].iloc[i]), 4) if pd.notna(df["current_ratio"].iloc[i]) else None,
            "interest_coverage":  round(float(df["interest_coverage"].iloc[i]), 4) if pd.notna(df["interest_coverage"].iloc[i]) else None,
            "asset_turnover":     round(float(df["asset_turnover"].iloc[i]), 4) if pd.notna(df["asset_turnover"].iloc[i]) else None,
            "revenue_growth_yoy": round(float(df["revenue_growth_yoy"].iloc[i]), 4) if pd.notna(df["revenue_growth_yoy"].iloc[i]) else None,
        })

    return results


def risk_color(label: str) -> str:
    return {"low_risk": "#22c55e", "medium_risk": "#f59e0b", "high_risk": "#ef4444"}.get(label, "#6b7280")


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "Financial Risk ML Microservice", "version": "2.0.0"}


@app.get("/health")
def health():
    return {
        "status":      "ok",
        "model":       "loaded" if model else "not loaded",
        "features":    feature_cols,
        "classes":     meta["classes"] if meta else [],
        "model_f1":    meta["metrics"]["weighted_f1"] if meta else None,
        "model_auc":   meta["metrics"]["weighted_auc"] if meta else None,
        "timestamp":   datetime.now().isoformat(),
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    """
    Main endpoint — analyze any publicly listed company by ticker.
    1. Fetch financials from yfinance
    2. Engineer features
    3. Score all quarters with XGBoost
    4. Return full analysis with SHAP explanations
    """
    ticker = request.ticker.upper().strip()
    start  = time.time()

    # 1. Fetch data
    try:
        data = fetch_company_data(ticker)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to fetch data for '{ticker}': {str(e)}")

    info = data["info"]

    # 2. Engineer features
    df = engineer_features(data)

    if df.empty or len(df) < 2:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient financial data for '{ticker}'. This ticker may not have enough quarterly reports."
        )

    # 3. Data quality check
    quality = compute_data_quality(df)
    if quality < 50:
        raise HTTPException(
            status_code=422,
            detail=f"Data quality too low for '{ticker}' ({quality}% features available). Minimum 50% required."
        )

    # 4. Score quarters
    quarters = score_quarters(df)
    latest   = quarters[-1] if quarters else {}

    elapsed = round(time.time() - start, 2)

    return {
        "ticker":        ticker,
        "company": {
            "name":        info.get("longName", ticker),
            "sector":      info.get("sector", "Unknown"),
            "industry":    info.get("industry", "Unknown"),
            "country":     info.get("country", "Unknown"),
            "employees":   info.get("fullTimeEmployees", None),
            "market_cap":  info.get("marketCap", None),
            "website":     info.get("website", None),
            "description": (info.get("longBusinessSummary", "") or "")[:400],
            "fetched_at":  datetime.now().isoformat(),
        },
        "analysis": {
            "total_quarters":    len(quarters),
            "date_range":        f"{quarters[0]['date']} → {quarters[-1]['date']}" if quarters else "N/A",
            "latest_risk":       latest.get("risk_label"),
            "latest_color":      latest.get("risk_color"),
            "latest_confidence": latest.get("confidence"),
            "data_quality":      quality,
            "data_quality_note": "excellent" if quality >= 90 else "good" if quality >= 70 else "partial",
            "risk_distribution": {
                "low_risk":    sum(1 for q in quarters if q["risk_label"] == "low_risk"),
                "medium_risk": sum(1 for q in quarters if q["risk_label"] == "medium_risk"),
                "high_risk":   sum(1 for q in quarters if q["risk_label"] == "high_risk"),
            },
        },
        "quarters":      quarters,
        "shap_global":   shap_df.to_dict(orient="records"),
        "model": {
            "f1":         meta["metrics"]["weighted_f1"],
            "auc":        meta["metrics"]["weighted_auc"],
            "version":    "1.0.0",
            "trained_at": meta["trained_at"],
        },
        "elapsed_seconds": elapsed,
    }


@app.post("/predict/custom")
def predict_custom(inputs: CustomPredictInput):
    """Predict risk from manually entered financial ratios."""
    features = inputs.model_dump()
    X        = np.array([[features[col] for col in feature_cols]], dtype=np.float32)

    y_pred      = model.predict(X)[0]
    y_proba     = model.predict_proba(X)[0]
    label       = le.inverse_transform([y_pred])[0]
    shap_values = explainer.shap_values(X)

    if isinstance(shap_values, list):
        row_shap = np.mean([np.abs(sv[0]) for sv in shap_values], axis=0)
    elif shap_values.ndim == 3:
        row_shap = np.abs(shap_values[0]).mean(axis=1)
    else:
        row_shap = np.abs(shap_values[0])

    top_idx = np.argsort(row_shap)[::-1][:3]
    drivers = [
        {"feature": feature_cols[j], "importance": round(float(row_shap[j]), 4)}
        for j in top_idx
    ]

    return {
        "risk_label":       label,
        "risk_color":       risk_color(label),
        "confidence":       round(float(y_proba.max()), 4),
        "probabilities":    {le.classes_[i]: round(float(y_proba[i]), 4) for i in range(len(le.classes_))},
        "top_risk_drivers": drivers,
        "input_features":   features,
    }


@app.get("/shap")
def get_shap():
    return {
        "feature_importance": shap_df.to_dict(orient="records"),
        "description": "Mean absolute SHAP value across training set",
    }

@app.get("/search")
def search_tickers(q: str):
    """Search for tickers by name or symbol using yfinance."""
    if not q or len(q) < 1:
        return {"results": []}
    try:
        results = yf.Search(q, max_results=6)
        quotes  = results.quotes

        formatted = []
        for item in quotes:
            if not item.get("symbol"):
                continue
            formatted.append({
                "ticker":   item.get("symbol", ""),
                "name":     item.get("longname") or item.get("shortname") or item.get("symbol"),
                "sector":   item.get("sector", ""),
                "exchange": item.get("exchange", ""),
                "type":     item.get("quoteType", ""),
            })

        return {"results": formatted}
    except Exception as e:
        return {"results": [], "error": str(e)}

@app.get("/metrics")
def get_metrics():
    return {
        "model_type":   meta["model_type"],
        "weighted_f1":  meta["metrics"]["weighted_f1"],
        "weighted_auc": meta["metrics"]["weighted_auc"],
        "test_rows":    meta["metrics"]["test_rows"],
        "trained_at":   meta["trained_at"],
        "feature_cols": feature_cols,
        "classes":      meta["classes"],
    }