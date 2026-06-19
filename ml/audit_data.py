"""
FinXG — Data Audit Script
Run from ml/ folder: python audit_data.py
Tells you exactly what's in your training data and what's missing/corrupted.
"""

import json, os, warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

RAW_PATH      = "../data/training_raw.parquet"
FEATURES_PATH = "../data/training_features.parquet"
LOG_PATH      = "../data/collection_log.csv"

FEATURE_COLS = [
    "gross_margin", "operating_margin", "net_margin", "fcf_margin",
    "roe", "roa", "debt_to_equity", "current_ratio",
    "interest_coverage", "asset_turnover", "revenue_growth_yoy",
]
TARGET_COL = "risk_label"

print("=" * 65)
print("  FinXG Data Audit Report")
print("=" * 65)

# ── 1. Collection log ──────────────────────────────────────────────
if os.path.exists(LOG_PATH):
    log = pd.read_csv(LOG_PATH)
    print(f"\n── Collection Log ({LOG_PATH}) ────────────────────────")
    print(f"   Total tickers attempted : {len(log)}")
    if "status" in log.columns:
        print(log["status"].value_counts().to_string())
    if "error" in log.columns:
        errors = log[log["error"].notna() & (log["error"] != "")]
        if len(errors):
            print(f"\n   Tickers with errors ({len(errors)}):")
            for _, row in errors.iterrows():
                print(f"     {row.get('ticker','?'):10} — {str(row['error'])[:80]}")
    if "skipped_reason" in log.columns:
        skipped = log[log["skipped_reason"].notna()]
        if len(skipped):
            print(f"\n   Skipped tickers ({len(skipped)}):")
            for _, row in skipped.iterrows():
                print(f"     {row.get('ticker','?'):10} — {row['skipped_reason']}")
else:
    print(f"\n   ⚠ Collection log not found at {LOG_PATH}")

# ── 2. Raw parquet ─────────────────────────────────────────────────
if os.path.exists(RAW_PATH):
    raw = pd.read_parquet(RAW_PATH)
    print(f"\n── Raw Data ({RAW_PATH}) ───────────────────────────────")
    print(f"   Shape       : {raw.shape}")
    print(f"   Columns     : {list(raw.columns)}")
    if "ticker" in raw.columns:
        print(f"   Tickers     : {raw['ticker'].nunique()} unique")
        print(f"   Rows/ticker : {raw.groupby('ticker').size().describe().to_string()}")
    missing = raw.isnull().sum()
    missing = missing[missing > 0]
    if len(missing):
        print(f"\n   Missing values:")
        print(missing.to_string())
    else:
        print("   No missing values in raw data")
else:
    print(f"\n   ⚠ Raw parquet not found at {RAW_PATH}")

# ── 3. Features parquet ────────────────────────────────────────────
if os.path.exists(FEATURES_PATH):
    df = pd.read_parquet(FEATURES_PATH)
    print(f"\n── Features Data ({FEATURES_PATH}) ─────────────────────")
    print(f"   Shape       : {df.shape}")
    print(f"   Columns     : {list(df.columns)}")

    if "ticker" in df.columns:
        print(f"   Tickers     : {df['ticker'].nunique()} unique")
        ticker_counts = df.groupby("ticker").size()
        print(f"   Rows/ticker :")
        print(f"     min={ticker_counts.min()}, max={ticker_counts.max()}, mean={ticker_counts.mean():.1f}")
        low_data = ticker_counts[ticker_counts < 4]
        if len(low_data):
            print(f"\n   ⚠ Tickers with < 4 quarters (may affect YoY calculation):")
            for t, c in low_data.items():
                print(f"     {t}: {c} quarters")

    if TARGET_COL in df.columns:
        print(f"\n   Class distribution:")
        print(df[TARGET_COL].value_counts().to_string())
        pct = df[TARGET_COL].value_counts(normalize=True) * 100
        print(f"\n   Class balance (%):")
        print(pct.round(1).to_string())
        if pct.max() > 70:
            print(f"\n   ⚠ WARNING: Class imbalance detected!")
            print(f"   Dominant class: {pct.idxmax()} ({pct.max():.1f}%)")
            print(f"   Consider: SMOTE oversampling or class_weight='balanced'")

    # Feature-level audit
    print(f"\n   Feature quality:")
    print(f"   {'Feature':<25} {'Missing':>8} {'Inf':>6} {'Min':>10} {'Max':>10} {'Mean':>10}")
    print("   " + "-" * 72)
    for col in FEATURE_COLS:
        if col in df.columns:
            s        = df[col]
            n_miss   = s.isna().sum()
            n_inf    = np.isinf(s.replace([None], np.nan).fillna(0)).sum()
            vmin     = s.min() if not s.isna().all() else float('nan')
            vmax     = s.max() if not s.isna().all() else float('nan')
            vmean    = s.mean() if not s.isna().all() else float('nan')
            flag     = " ⚠" if n_miss > 0 or n_inf > 0 or abs(vmax) > 50 else ""
            print(f"   {col:<25} {n_miss:>8} {n_inf:>6} {vmin:>10.3f} {vmax:>10.3f} {vmean:>10.3f}{flag}")
        else:
            print(f"   {col:<25} {'MISSING COLUMN':>40} ⚠")

    # Outlier detection
    print(f"\n   Extreme value check (|value| > 10 = suspicious):")
    found_outliers = False
    for col in FEATURE_COLS:
        if col in df.columns:
            outliers = df[np.abs(df[col]) > 10]
            if len(outliers):
                found_outliers = True
                print(f"   {col}: {len(outliers)} rows with |value| > 10")
                if "ticker" in df.columns:
                    print(f"     Tickers: {outliers['ticker'].unique().tolist()}")
    if not found_outliers:
        print("   No extreme outliers detected ✓")

else:
    print(f"\n   ⚠ Features parquet not found at {FEATURES_PATH}")

# ── 4. Gap analysis — what was dropped between raw and features ────
if os.path.exists(RAW_PATH) and os.path.exists(FEATURES_PATH):
    raw = pd.read_parquet(RAW_PATH)
    df  = pd.read_parquet(FEATURES_PATH)
    if "ticker" in raw.columns and "ticker" in df.columns:
        raw_tickers  = set(raw["ticker"].unique())
        feat_tickers = set(df["ticker"].unique())
        dropped      = raw_tickers - feat_tickers
        print(f"\n── Gap Analysis ─────────────────────────────────────────────")
        print(f"   Raw tickers      : {len(raw_tickers)}")
        print(f"   Feature tickers  : {len(feat_tickers)}")
        print(f"   Dropped tickers  : {len(dropped)}")
        if dropped:
            print(f"   Dropped: {sorted(dropped)}")
            print(f"   → These were likely dropped due to insufficient quarters or data quality < 50%")

print("\n" + "=" * 65)
print("  Audit complete")
print("=" * 65)
