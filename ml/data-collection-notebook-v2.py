# ═══════════════════════════════════════════════════════════════════
# FinXG — Improved Data Collection Notebook v2
# Paste each section into a Kaggle notebook cell
# Key improvements over v1:
#   - 8 quarters per company instead of 5 (fixes revenue_growth_yoy)
#   - Retry logic for failed tickers
#   - Better interest_coverage clipping (±20 not ±100)
#   - Improved risk scoring (adds interest coverage signal)
#   - Handles negative equity D/E correctly
# ═══════════════════════════════════════════════════════════════════

# ── CELL 1: Install ────────────────────────────────────────────────
"""
!pip install -q --upgrade yfinance
print('✅ Ready')
"""

# ── CELL 2: Imports & config ───────────────────────────────────────
"""
import os, time, warnings
from datetime import datetime
import pandas as pd
import numpy as np
import yfinance as yf
from tqdm.notebook import tqdm

warnings.filterwarnings('ignore')

OUTPUT_DIR = '/kaggle/working'
RAW_OUT    = f'{OUTPUT_DIR}/training_raw.parquet'
FEAT_OUT   = f'{OUTPUT_DIR}/training_features.parquet'
LOG_OUT    = f'{OUTPUT_DIR}/collection_log.csv'

MIN_QUARTERS = 6    # ← was 5, now 6 so YoY has at least 2 valid values
MAX_QUARTERS = 8    # fetch 8 quarters per company
"""

# ── CELL 3: Full ticker universe (200+) ───────────────────────────
"""
IT_SERVICES = [
    'EPAM', 'CTSH', 'ACN', 'INFY', 'WIT', 'GLOB', 'PEGA',
    'EXLS', 'KFRC', 'MMS', 'PRFT', 'LDOS', 'SAIC', 'BAH',
    'CACI', 'MANT', 'ICFI', 'CLPS', 'NICE', 'TTEC',
]

CLOUD_SAAS = [
    'NOW', 'CRM', 'WDAY', 'VEEV', 'HUBS', 'ZEN',
    'DDOG', 'MDB', 'ESTC', 'FIVN', 'PCTY', 'PAYC',
    'BILL', 'BRZE', 'GTLB', 'SAMSF', 'RNG',
]

ENTERPRISE_SOFTWARE = [
    'ORCL', 'SAP', 'MSFT', 'IBM', 'ANSS', 'PTC',
    'AZPN', 'CDNS', 'SNPS', 'MANH', 'SPSC', 'JKHY',
    'PEGA', 'DOMO', 'PLTR',
]

CYBERSECURITY = [
    'PANW', 'CRWD', 'FTNT', 'ZS', 'OKTA',
    'S', 'TENB', 'CYBR', 'VRNT', 'QLYS',
    'CHKP', 'RPD', 'SAIL',
]

SEMICONDUCTORS = [
    'NVDA', 'AMD', 'INTC', 'QCOM', 'MRVL',
    'AMAT', 'KLAC', 'LRCX', 'ONTO', 'CRUS',
]

NETWORKING_INFRA = [
    'CSCO', 'ANET', 'NTAP', 'PSTG', 'JNPR',
    'ERIC', 'NOK', 'INFN', 'CIEN',
]

EMERGING = [
    'SNOW', 'HUBS', 'DOCN', 'FSLY', 'NET',
    'CFLT', 'RXRX', 'AI', 'BBAI', 'SOUN',
]

HARDWARE = [
    'HPQ', 'HPE', 'DELL', 'STX', 'WDC',
    'NCR', 'TRMB', 'CGNX',
]

# Deduplicate
ALL_TICKERS = list(dict.fromkeys(
    IT_SERVICES + CLOUD_SAAS + ENTERPRISE_SOFTWARE +
    CYBERSECURITY + SEMICONDUCTORS + NETWORKING_INFRA +
    EMERGING + HARDWARE
))
print(f'Total tickers: {len(ALL_TICKERS)}')
"""

# ── CELL 4: Helper functions ───────────────────────────────────────
"""
def safe_transpose(df):
    if df is None or df.empty:
        return pd.DataFrame()
    t = df.T.copy()
    t.index = pd.to_datetime(t.index)
    t.index.name = 'date'
    return t


def get_col(df, *candidates):
    for c in candidates:
        if c in df.columns:
            return df[c]
    return pd.Series(0.0, index=df.index)


def fetch_yfinance(ticker: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            tk = yf.Ticker(ticker)
            info = tk.info or {}
            return {
                'info':     info,
                'income':   safe_transpose(tk.quarterly_financials),
                'balance':  safe_transpose(tk.quarterly_balance_sheet),
                'cashflow': safe_transpose(tk.quarterly_cashflow),
            }
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # exponential backoff
            else:
                raise e


def build_features(ticker: str, data: dict, sector: str = 'Unknown') -> pd.DataFrame:
    inc = data['income']
    bal = data['balance']
    cf  = data['cashflow']

    if inc.empty and bal.empty:
        return pd.DataFrame()

    frames = [f for f in [inc, bal, cf] if not f.empty]
    base   = frames[0].copy()
    for f in frames[1:]:
        base = base.join(f, how='outer', rsuffix='_dup')
    base = base.loc[:, ~base.columns.str.endswith('_dup')].sort_index()

    # Keep only latest MAX_QUARTERS
    base = base.tail(MAX_QUARTERS)

    df = pd.DataFrame(index=base.index)
    df['date']               = base.index
    df['ticker']             = ticker
    df['sector']             = sector
    df['market_cap']         = data['info'].get('marketCap')
    df['revenue']            = get_col(base, 'Total Revenue', 'Revenue')
    df['gross_profit']       = get_col(base, 'Gross Profit')
    df['operating_income']   = get_col(base, 'Operating Income', 'EBIT')
    df['net_income']         = get_col(base, 'Net Income')
    df['interest_expense']   = get_col(base, 'Interest Expense').abs()
    df['total_assets']       = get_col(base, 'Total Assets')
    df['total_liabilities']  = get_col(base, 'Total Liabilities Net Minority Interest', 'Total Liabilities')
    df['total_equity']       = get_col(base, 'Stockholders Equity', 'Total Stockholders Equity')
    df['current_assets']     = get_col(base, 'Current Assets')
    df['current_liabilities']= get_col(base, 'Current Liabilities')
    df['total_debt']         = get_col(base, 'Total Debt', 'Long Term Debt')
    df['cash']               = get_col(base, 'Cash And Cash Equivalents', 'Cash Cash Equivalents And Short Term Investments')
    df['operating_cash_flow']= get_col(base, 'Operating Cash Flow', 'Cash Flow From Continuing Operating Activities')
    df['capex']              = get_col(base, 'Capital Expenditure').abs()
    df['free_cash_flow']     = df['operating_cash_flow'] - df['capex']

    eps = 1e-9
    rev = df['revenue'].abs() + eps

    df['gross_margin']       = (df['gross_profit']     / rev).clip(-5, 5)
    df['operating_margin']   = (df['operating_income'] / rev).clip(-5, 5)
    df['net_margin']         = (df['net_income']        / rev).clip(-5, 5)
    df['fcf_margin']         = (df['free_cash_flow']    / rev).clip(-5, 5)
    df['roe']                = (df['net_income']        / (df['total_equity'].abs() + eps)).clip(-5, 5)
    df['roa']                = (df['net_income']        / (df['total_assets'].abs()  + eps)).clip(-5, 5)
    df['asset_turnover']     = (df['revenue']            / (df['total_assets'].abs()  + eps)).clip(0, 5)
    df['current_ratio']      = (df['current_assets']    / (df['current_liabilities'].abs() + eps)).clip(0, 10)

    # D/E: if equity is negative (buybacks like DELL), cap at a fixed high value
    equity_safe = df['total_equity'].apply(lambda x: x if x > 0 else eps)
    df['debt_to_equity'] = (df['total_debt'] / equity_safe).clip(0, 10)

    # Interest coverage: clip to [-20, 20] — beyond 20x means no debt problem
    df['interest_coverage'] = (df['operating_income'] / (df['interest_expense'] + eps)).clip(-20, 20)

    # YoY — with 8 quarters, periods=4 gives 4 valid values per company
    df['revenue_growth_yoy'] = df['revenue'].pct_change(periods=4).clip(-1, 2)

    return df.reset_index(drop=True)
"""

# ── CELL 5: Collect all companies ─────────────────────────────────
"""
all_frames = []
log_rows   = []

for ticker in tqdm(ALL_TICKERS, desc='Collecting'):
    try:
        data    = fetch_yfinance(ticker)
        info    = data['info']
        sector  = info.get('sector', 'Technology')
        df      = build_features(ticker, data, sector)

        if df.empty or len(df) < MIN_QUARTERS:
            log_rows.append({'ticker': ticker, 'status': 'skipped',
                             'rows': len(df), 'reason': 'insufficient data'})
            continue

        all_frames.append(df)
        log_rows.append({'ticker': ticker, 'status': 'ok', 'rows': len(df), 'reason': ''})
        time.sleep(0.5)  # be polite to yfinance API

    except Exception as e:
        log_rows.append({'ticker': ticker, 'status': 'error',
                         'rows': 0, 'reason': str(e)[:100]})

raw = pd.concat(all_frames).sort_values(['ticker', 'date']).reset_index(drop=True)
pd.DataFrame(log_rows).to_csv(LOG_OUT, index=False)

print(f'Collected  : {sum(1 for r in log_rows if r["status"]=="ok")} companies')
print(f'Skipped    : {sum(1 for r in log_rows if r["status"]=="skipped")} companies')
print(f'Errors     : {sum(1 for r in log_rows if r["status"]=="error")} companies')
print(f'Total rows : {len(raw)}')
"""

# ── CELL 6: Risk labels (improved scoring) ────────────────────────
"""
def create_risk_labels(df: pd.DataFrame) -> pd.DataFrame:
    df    = df.copy()
    score = pd.Series(0, index=df.index)

    # Liquidity — most predictive
    score += (df['current_ratio']      < 1.0 ).astype(int) * 2
    score += (df['current_ratio']      < 0.7 ).astype(int) * 1  # extra if critical

    # Leverage
    score += (df['debt_to_equity']     > 2.0 ).astype(int) * 2
    score += (df['interest_coverage']  < 1.5 ).astype(int) * 2  # NEW: can't service debt

    # Profitability
    score += (df['operating_margin']   < 0.0 ).astype(int) * 2
    score += (df['net_margin']         < -0.1).astype(int) * 1  # extra if deeply negative

    # Growth
    score += (df['revenue_growth_yoy'] < -0.1).astype(int) * 1

    # Cash flow
    score += (df['free_cash_flow']     < 0   ).astype(int) * 1

    df['risk_score'] = score
    df['risk_label'] = pd.cut(
        score,
        bins=[-1, 1, 3, 100],
        labels=['low_risk', 'medium_risk', 'high_risk']
    ).astype(str)

    return df

raw = create_risk_labels(raw)
print(raw['risk_label'].value_counts())
print(f'\\nHigh risk %: {(raw["risk_label"]=="high_risk").mean()*100:.1f}%')
"""

# ── CELL 7: Fill missing values properly ──────────────────────────
"""
FEATURE_COLS = [
    'gross_margin', 'operating_margin', 'net_margin', 'fcf_margin',
    'roe', 'roa', 'debt_to_equity', 'current_ratio',
    'interest_coverage', 'asset_turnover', 'revenue_growth_yoy',
]

# Fill per-ticker median first, then sector, then global
for col in FEATURE_COLS:
    raw[col] = raw.groupby('ticker')[col].transform(lambda x: x.fillna(x.median()))
    raw[col] = raw.groupby('sector')[col].transform(lambda x: x.fillna(x.median()))
    raw[col] = raw[col].fillna(raw[col].median())

print(f'Missing after fill: {raw[FEATURE_COLS].isna().sum().sum()}')
"""

# ── CELL 8: Save ──────────────────────────────────────────────────
"""
SAVE_COLS = [
    'ticker', 'date', 'sector', 'market_cap',
    'revenue', 'gross_profit', 'operating_income', 'net_income',
    'total_assets', 'total_liabilities', 'total_equity',
    'current_assets', 'current_liabilities', 'total_debt', 'cash',
    'operating_cash_flow', 'free_cash_flow',
    'gross_margin', 'operating_margin', 'net_margin', 'fcf_margin',
    'roe', 'roa', 'debt_to_equity', 'current_ratio',
    'interest_coverage', 'asset_turnover', 'revenue_growth_yoy',
    'risk_score', 'risk_label',
]

features_df = raw[[c for c in SAVE_COLS if c in raw.columns]]
features_df.to_parquet(FEAT_OUT, index=False)
raw.to_parquet(RAW_OUT, index=False)

print(f'✅ Saved {len(features_df)} rows × {len(features_df.columns)} columns')
print(f'   Companies : {features_df["ticker"].nunique()}')
print(f'   Labels    : {features_df["risk_label"].value_counts().to_dict()}')
"""
