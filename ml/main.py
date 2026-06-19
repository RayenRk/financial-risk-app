from dotenv import load_dotenv
load_dotenv()

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

MODEL_DIR  = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.pkl")
META_PATH  = os.path.join(MODEL_DIR, "model_meta.json")
SHAP_PATH  = os.path.join(MODEL_DIR, "shap_values.parquet")

app = FastAPI(title="Financial Risk ML Microservice", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    feature_cols = bundle["features"]
    with open(META_PATH) as f:
        meta = json.load(f)
    shap_df      = pd.read_parquet(SHAP_PATH)
    explainer    = shap.TreeExplainer(model)
    print("✅ Model loaded")
    print(f"   Features : {feature_cols}")
    print(f"   Classes  : {meta['classes']}")
    print(f"   CV F1    : {meta['metrics']['weighted_f1']:.4f}")
    print(f"   AUC      : {meta['metrics']['weighted_auc']:.4f}")


# ── Pydantic models ────────────────────────────────────────────────

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
    period: Optional[str] = "quarterly"


class AdviceRequest(BaseModel):
    ticker:             str
    company_name:       str
    risk_label:         str
    confidence:         float
    top_risk_drivers:   list
    current_ratio:      Optional[float] = None
    debt_to_equity:     Optional[float] = None
    operating_margin:   Optional[float] = None
    net_margin:         Optional[float] = None
    roe:                Optional[float] = None
    roa:                Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    fcf_margin:         Optional[float] = None
    interest_coverage:  Optional[float] = None
    quarter_date:       Optional[str]   = None


# ── Helpers ────────────────────────────────────────────────────────

def safe_transpose(df):
    if df is None or df.empty:
        return pd.DataFrame()
    t = df.T.copy()
    t.index = pd.to_datetime(t.index)
    t.index.name = "date"
    return t


def get_col(df, *candidates):
    for c in candidates:
        if c in df.columns:
            return df[c]
    return pd.Series(0.0, index=df.index)


def fetch_company_data(ticker):
    tk   = yf.Ticker(ticker.upper())
    info = tk.info or {}
    if not info or info.get("quoteType") is None:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found.")
    return {
        "info":     info,
        "income":   safe_transpose(tk.quarterly_financials),
        "balance":  safe_transpose(tk.quarterly_balance_sheet),
        "cashflow": safe_transpose(tk.quarterly_cashflow),
    }


def engineer_features(data):
    inc = data["income"]
    bal = data["balance"]
    cf  = data["cashflow"]
    if inc.empty and bal.empty:
        return pd.DataFrame()
    frames = [f for f in [inc, bal, cf] if not f.empty]
    base   = frames[0].copy()
    for f in frames[1:]:
        base = base.join(f, how="outer", rsuffix="_dup")
    base = base.loc[:, ~base.columns.str.endswith("_dup")].sort_index()
    df = pd.DataFrame(index=base.index)
    df["date"]                = base.index
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
    df["cash"]                = get_col(base, "Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")
    df["operating_cash_flow"] = get_col(base, "Operating Cash Flow", "Cash Flow From Continuing Operating Activities")
    df["capex"]               = get_col(base, "Capital Expenditure").abs()
    df["free_cash_flow"]      = df["operating_cash_flow"] - df["capex"]
    eps = 1e-9
    df["gross_margin"]        = df["gross_profit"]     / (df["revenue"].abs() + eps)
    df["operating_margin"]    = df["operating_income"] / (df["revenue"].abs() + eps)
    df["net_margin"]          = df["net_income"]        / (df["revenue"].abs() + eps)
    df["fcf_margin"]          = df["free_cash_flow"]    / (df["revenue"].abs() + eps)
    df["roe"]                 = df["net_income"]        / (df["total_equity"].abs() + eps)
    df["roa"]                 = df["net_income"]        / (df["total_assets"].abs() + eps)
    df["debt_to_equity"]      = df["total_debt"]        / (df["total_equity"].abs() + eps)
    df["current_ratio"]       = df["current_assets"]    / (df["current_liabilities"].abs() + eps)
    df["interest_coverage"]   = df["operating_income"]  / (df["interest_expense"] + eps)
    df["asset_turnover"]      = df["revenue"]            / (df["total_assets"].abs() + eps)
    df["revenue_growth_yoy"]  = df["revenue"].pct_change(periods=4)
    ratio_cols = [
        "gross_margin", "operating_margin", "net_margin", "fcf_margin",
        "roe", "roa", "debt_to_equity", "current_ratio",
        "interest_coverage", "asset_turnover", "revenue_growth_yoy",
    ]
    df[ratio_cols] = df[ratio_cols].clip(-100, 100)
    for col in feature_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())
    return df.reset_index(drop=True)


def compute_data_quality(df):
    if df.empty:
        return 0.0
    present = sum(1 for col in feature_cols if col in df.columns and df[col].notna().any())
    return round(present / len(feature_cols) * 100, 1)


def score_quarters(df):
    if df.empty:
        return []
    X           = df[feature_cols].values.astype(np.float32)
    y_pred      = model.predict(X)
    y_proba     = model.predict_proba(X)
    shap_values = explainer.shap_values(X)
    if isinstance(shap_values, list):
        mean_abs = np.mean([np.abs(sv) for sv in shap_values], axis=0)
    elif shap_values.ndim == 3:
        mean_abs = np.abs(shap_values).mean(axis=2)
    else:
        mean_abs = np.abs(shap_values)
    results = []
    for i in range(len(df)):
        label    = le.inverse_transform([y_pred[i]])[0]
        proba    = y_proba[i]
        row_shap = mean_abs[i]
        top_idx  = np.argsort(row_shap)[::-1][:3]
        drivers  = [
            {"feature": feature_cols[j], "importance": round(float(row_shap[j]), 4)}
            for j in top_idx
        ]
        proba_dict = {le.classes_[k]: round(float(proba[k]), 4) for k in range(len(le.classes_))}
        r = {
            "date":            df["date"].iloc[i].strftime("%Y-%m-%d") if hasattr(df["date"].iloc[i], "strftime") else str(df["date"].iloc[i])[:10],
            "risk_label":      label,
            "risk_color":      {"low_risk": "#22c55e", "medium_risk": "#f59e0b", "high_risk": "#ef4444"}.get(label, "#6b7280"),
            "confidence":      round(float(proba.max()), 6),
            "probabilities":   proba_dict,
            "top_risk_drivers": drivers,
        }
        for col in ["revenue", "gross_profit", "operating_income", "net_income", "free_cash_flow", "total_debt", "cash"]:
            r[col] = round(float(df[col].iloc[i]) / 1e6, 2) if pd.notna(df[col].iloc[i]) else None
        for col in ["gross_margin", "operating_margin", "net_margin", "fcf_margin", "roe", "roa",
                    "debt_to_equity", "current_ratio", "interest_coverage", "asset_turnover", "revenue_growth_yoy"]:
            r[col] = round(float(df[col].iloc[i]), 4) if pd.notna(df[col].iloc[i]) else None
        results.append(r)
    return results


def risk_color(label):
    return {"low_risk": "#22c55e", "medium_risk": "#f59e0b", "high_risk": "#ef4444"}.get(label, "#6b7280")


# ── Shared advice helper ───────────────────────────────────────────

def _run_groq(system_prompt: str, user_prompt: str) -> list:
    from groq import Groq
    import json as json_lib

    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set in environment.")

    client   = Groq(api_key=groq_key)
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=1500,
        temperature=0.1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
    )
    raw = response.choices[0].message.content.strip()

    if "```" in raw:
        for part in raw.split("```"):
            part = part.strip().lstrip("json").strip()
            if part.startswith("["):
                raw = part
                break

    recommendations = json_lib.loads(raw)
    if not isinstance(recommendations, list):
        raise ValueError("Model did not return a JSON array")

    valid_p = {"high", "medium", "low"}
    valid_c = {"liquidity", "leverage", "profitability", "growth", "operations"}

    return [
        {
            "title":           str(r.get("title", "Recommendation")),
            "description":     str(r.get("description", "")),
            "priority":        r.get("priority", "medium") if r.get("priority") in valid_p else "medium",
            "category":        r.get("category", "operations") if r.get("category") in valid_c else "operations",
            "metric_affected": str(r.get("metric_affected", "")),
            "current_value":   str(r.get("current_value", "")),
            "target_value":    str(r.get("target_value", "")),
            "benchmark":       str(r.get("benchmark", "")),
        }
        for r in recommendations[:5]
    ]


def _fmt(v, mult=1, suffix="", decimals=2):
    return f"{v * mult:.{decimals}f}{suffix}" if v is not None else "N/A"


def _ratios_block(req: AdviceRequest) -> str:
    # Format quarter_date cleanly — strip time component if present
    if req.quarter_date:
        quarter_display = req.quarter_date[:10]  # "2026-12-31T00:00:00Z" → "2026-12-31"
        # Convert to readable format: "2026-12-31" → "Q4 2026"
        from datetime import datetime
        try:
            dt = datetime.strptime(quarter_display, "%Y-%m-%d")
            month_to_quarter = {1:"Q1",2:"Q1",3:"Q1",4:"Q2",5:"Q2",6:"Q2",
                                 7:"Q3",8:"Q3",9:"Q3",10:"Q4",11:"Q4",12:"Q4"}
            quarter_display = f"{month_to_quarter[dt.month]} {dt.year}"
        except ValueError:
            pass
    else:
        quarter_display = "latest"

    return f"""
FINANCIAL RATIOS — {req.company_name} ({req.ticker}), quarter {quarter_display}:
  Current Ratio:      {_fmt(req.current_ratio)}      [healthy >1.5 | danger <1.0]
  Debt/Equity:        {_fmt(req.debt_to_equity, decimals=3)}      [healthy <1.0 | high risk >2.0]
  Operating Margin:   {_fmt(req.operating_margin, mult=100, suffix='%')}      [IT avg 15-25%]
  Net Margin:         {_fmt(req.net_margin, mult=100, suffix='%')}      [IT avg 10-20%]
  ROE:                {_fmt(req.roe, mult=100, suffix='%')}      [healthy >15%]
  ROA:                {_fmt(req.roa, mult=100, suffix='%')}      [healthy >5%]
  Revenue Growth YoY: {_fmt(req.revenue_growth_yoy, mult=100, suffix='%')}      [IT avg 8-15%]
  FCF Margin:         {_fmt(req.fcf_margin, mult=100, suffix='%')}      [healthy >10%]
  Interest Coverage:  {_fmt(req.interest_coverage)}x      [healthy >3x | danger <1.5x]"""


def _drivers_block(req: AdviceRequest) -> str:
    return "\n".join([
        f"  {i+1}. {d['feature'].replace('_', ' ').title()} — SHAP: {d['importance']:.4f}"
        for i, d in enumerate(req.top_risk_drivers)
    ])


def _risk_text(label: str) -> str:
    return {"high_risk": "HIGH RISK", "medium_risk": "MEDIUM RISK", "low_risk": "LOW RISK"}.get(
        label, label.upper()
    )


def _advice_response(req: AdviceRequest, recs: list) -> dict:
    return {
        "ticker":          req.ticker,
        "company_name":    req.company_name,
        "risk_label":      req.risk_label,
        "quarter_date":    req.quarter_date,
        "recommendations": recs,
        "model":           "llama-3.1-8b-instant (Groq)",
        "generated_at":    datetime.now().isoformat(),
    }
    
def compute_risk_score(row: dict, shap_weights: dict) -> int:
    score = 0
    if row.get("current_ratio", 9) < 0.7:  score += shap_weights["current_ratio"] * 100
    elif row.get("current_ratio", 9) < 1.0: score += shap_weights["current_ratio"] * 70
    if row.get("debt_to_equity", 0) > 2.0:  score += shap_weights["debt_to_equity"] * 100
    if row.get("interest_coverage", 9) < 1.5: score += shap_weights["interest_coverage"] * 100
    if row.get("operating_margin", 1) < 0:  score += shap_weights["operating_margin"] * 100
    if row.get("net_margin", 1) < -0.1:     score += shap_weights["net_margin"] * 100
    if row.get("revenue_growth_yoy", 1) < -0.1: score += shap_weights["revenue_growth_yoy"] * 100
    return min(100, round(score))


# ── Routes ─────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "Financial Risk ML Microservice", "version": "2.0.0"}


@app.get("/health")
def health():
    return {
        "status":    "ok",
        "model":     "loaded" if model else "not loaded",
        "features":  feature_cols,
        "classes":   meta["classes"] if meta else [],
        "model_f1":  meta["metrics"]["weighted_f1"]  if meta else None,
        "model_auc": meta["metrics"]["weighted_auc"] if meta else None,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    ticker = request.ticker.upper().strip()
    start  = time.time()
    try:
        data = fetch_company_data(ticker)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to fetch '{ticker}': {str(e)}")
    info     = data["info"]
    df       = engineer_features(data)
    if df.empty or len(df) < 2:
        raise HTTPException(status_code=422, detail=f"Insufficient data for '{ticker}'.")
    quality  = compute_data_quality(df)
    if quality < 50:
        raise HTTPException(status_code=422, detail=f"Data quality too low ({quality}%).")
    quarters = score_quarters(df)
    latest   = quarters[-1] if quarters else {}
    return {
        "ticker": ticker,
        "company": {
            "name":        info.get("longName", ticker),
            "sector":      info.get("sector", "Unknown"),
            "industry":    info.get("industry", "Unknown"),
            "country":     info.get("country", "Unknown"),
            "employees":   info.get("fullTimeEmployees"),
            "market_cap":  info.get("marketCap"),
            "website":     info.get("website"),
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
        "quarters":       quarters,
        "shap_global":    shap_df.to_dict(orient="records"),
        "model": {
            "f1":         meta["metrics"]["weighted_f1"],
            "auc":        meta["metrics"]["weighted_auc"],
            "version":    "2.0.0",
            "trained_at": meta["trained_at"],
        },
        "elapsed_seconds": round(time.time() - start, 2),
    }


@app.post("/predict/custom")
def predict_custom(inputs: CustomPredictInput):
    features    = inputs.model_dump()
    X           = np.array([[features[col] for col in feature_cols]], dtype=np.float32)
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
    drivers = [{"feature": feature_cols[j], "importance": round(float(row_shap[j]), 4)} for j in top_idx]
    return {
        "risk_label":      label,
        "risk_color":      risk_color(label),
        "confidence":      round(float(y_proba.max()), 6),
        "probabilities":   {le.classes_[i]: round(float(y_proba[i]), 4) for i in range(len(le.classes_))},
        "top_risk_drivers": drivers,
        "input_features":  features,
    }


@app.get("/shap")
def get_shap():
    return {
        "feature_importance": shap_df.to_dict(orient="records"),
        "description":        "Mean absolute SHAP value across training set",
    }


@app.get("/search")
def search_tickers(q: str):
    if not q:
        return {"results": []}
    try:
        results   = yf.Search(q, max_results=6)
        formatted = []
        for item in results.quotes:
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


# ── /advice ─────────────

@app.post("/advice/analyst")
def get_analyst_advice(request: AdviceRequest):
    """Action plan for the analyst/decision-maker — what THEY should do."""
    system = (
        "You are a senior risk advisor at a financial institution. "
        "You advise analysts and portfolio managers on what ACTIONS TO TAKE — "
        "not what companies should do internally. "
        "Every recommendation is an action the decision-maker can execute this week, this quarter, or strategically. "
        "Be specific with numbers, timelines, and reversal conditions. "
        "Respond with valid JSON only — no markdown, no preamble."
    )
    user = f"""You are advising a financial risk analyst reviewing {request.company_name} ({request.ticker}).
Risk: {_risk_text(request.risk_label)} | Confidence: {request.confidence*100:.1f}%

TOP RISK SIGNALS (ML model SHAP importance):
{_drivers_block(request)}
{_ratios_block(request)}

Give exactly 5 concrete actions THE ANALYST should take (invest/divest/monitor/escalate/hedge decisions).
Return ONLY a JSON array — no markdown, no explanation:
[{{
  "title": "max 8 words, action verb, specific (e.g. 'Reduce Exposure Until Liquidity Improves')",
  "description": "3-4 sentences. What action? When? Based on which exact number? What is the reversal trigger?",
  "priority": "high|medium|low",
  "category": "liquidity|leverage|profitability|growth|operations",
  "metric_affected": "ratio name",
  "current_value": "actual value with unit",
  "target_value": "threshold that changes this recommendation",
  "benchmark": "IT sector benchmark"
}}]
Priority: high=act this week, medium=this quarter, low=monitor. Order by priority desc."""

    try:
        recs = _run_groq(system, user)
        return _advice_response(request, recs)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analyst advice failed: {str(e)}")


@app.post("/advice")
def get_advice(request: AdviceRequest):
    """Company-focused advice — what the company should fix internally."""
    system = (
        "You are a senior financial analyst specializing in IT/technology companies. "
        "You give precise, quantitative advice grounded in actual financial data. "
        "Every statement references specific numbers. "
        "Respond with valid JSON only — no markdown, no preamble."
    )
    user = f"""Analyze {request.company_name} ({request.ticker}).

ML RISK: {_risk_text(request.risk_label)} — Confidence: {request.confidence*100:.1f}%

TOP RISK DRIVERS (SHAP):
{_drivers_block(request)}
{_ratios_block(request)}

Give exactly 5 company-level recommendations. Reference exact numbers. Compare to benchmarks. Give specific targets.
Return ONLY a JSON array:
[{{
  "title": "max 8 words, specific to actual numbers",
  "description": "3-4 sentences. Reference exact ratios. Compare to benchmark. Give specific target numbers and action steps.",
  "priority": "high|medium|low",
  "category": "liquidity|leverage|profitability|growth|operations",
  "metric_affected": "exact ratio name",
  "current_value": "actual value with unit",
  "target_value": "specific target to reach",
  "benchmark": "industry benchmark"
}}]
Order by priority desc."""

    try:
        recs = _run_groq(system, user)
        return _advice_response(request, recs)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI advice failed: {str(e)}")