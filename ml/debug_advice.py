import requests

payload = {
    "ticker": "EPAM",
    "company_name": "EPAM Systems",
    "risk_label": "low_risk",
    "confidence": 0.99,
    "top_risk_drivers": [
        {"feature": "current_ratio", "importance": 0.5},
        {"feature": "debt_to_equity", "importance": 0.3},
        {"feature": "operating_margin", "importance": 0.2},
    ],
    "current_ratio": 2.67,
    "debt_to_equity": 0.084,
    "operating_margin": 0.083,
    "net_margin": 0.07,
    "roe": 0.12,
    "roa": 0.08,
    "revenue_growth_yoy": 0.05,
    "fcf_margin": 0.06,
    "interest_coverage": 15.0,
    "quarter_date": "2026-03-31",
}

r = requests.post("http://localhost:8001/advice/analyst", json=payload)
print("Status:", r.status_code)
print("Raw text:", r.text[:3000])