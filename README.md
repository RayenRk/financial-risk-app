# FinXG — Financial Risk Detection Platform

> An intelligent web platform for automated financial risk classification, real-time monitoring, and AI-powered advisory — built as a final year engineering project.

---

## Overview

**FinXG** continuously monitors the financial health of companies and detects early signs of financial distress using machine learning. For each quarterly report, the platform classifies the company into one of three risk levels, explains the key drivers behind the decision using SHAP values, and generates structured financial recommendations through an LLM-powered advisor.

---

## Features

| Feature | Description |
|---|---|
| **Risk Classification** | XGBoost model trained on 144 technology companies, achieving **F1 = 0.947** via GroupKFold cross-validation |
| **Explainability** | SHAP values identify which financial ratios drove each prediction |
| **Real-time Alerts** | Email and popup notifications triggered automatically on risk level changes |
| **AI Advisor** | Dual-perspective recommendations (company CFO + analyst) powered by Llama 3.1 via Groq |
| **Multi-company Analysis** | Analyze any publicly traded company by ticker symbol |
| **PDF Export** | One-page quarterly risk report generated on demand |
| **Role-based Access** | Analyst and Administrator roles with distinct permissions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React + TypeScript                    │
│                    (Vite · Tailwind · Recharts)              │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (Bearer token)
┌───────────────────────────▼─────────────────────────────────┐
│                    Laravel 11 + Sanctum                      │
│              (Auth · Scheduler · Alerts · PDF)               │
└──────────┬────────────────────────────────┬─────────────────┘
           │ Eloquent ORM                   │ HTTP
┌──────────▼──────────┐        ┌────────────▼────────────────┐
│    PostgreSQL        │        │    FastAPI (Python)          │
│  financial_risk_db  │        │  XGBoost · SHAP · yfinance  │
└─────────────────────┘        └────────────┬────────────────┘
                                            │
                               ┌────────────▼────────────────┐
                               │   Groq API — Llama 3.1      │
                               └─────────────────────────────┘
```

---

## ML Pipeline

The risk classifier was built with a rigorous methodology:

1. **Data collection** — 144 technology companies, 10 quarters each, via Yahoo Finance API
2. **Audit** — 4 critical anomalies detected and fixed: extreme outliers, class imbalance, inter-company data leakage, and inflated train-set metrics
3. **Feature engineering** — 11 financial ratios across liquidity, leverage, profitability, and growth dimensions
4. **Validation** — GroupKFold by ticker (5 folds) ensures no company appears in both train and validation
5. **Comparison** — XGBoost vs Random Forest on identical splits; XGBoost wins on all metrics

| Metric | XGBoost | Random Forest |
|---|---|---|
| CV F1 (weighted) | **0.947 ± 0.028** | 0.926 ± 0.022 |
| CV Accuracy | **94.9%** | 92.6% |
| Recall high_risk | **1.00** | 0.99 |
| OOF AUC | **1.000** | 0.998 |

---

## Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS
- Recharts (data visualization)
- Lucide React (icons)

**Backend**
- Laravel 11 + Laravel Sanctum
- PostgreSQL
- DOMPDF (PDF generation)
- Laravel Task Scheduling (daily import at 6:00 AM)

**ML Microservice**
- FastAPI (Python)
- XGBoost + scikit-learn (GroupKFold)
- SHAP (TreeSHAP)
- yfinance (financial data)

**AI Advisory**
- Groq API — Llama 3.1 8b Instant
- Temperature 0.1 — structured JSON output

---

## Project Structure

```
finxg/
├── frontend/          # React + TypeScript app
│   └── src/
│       ├── pages/     # Dashboard, RiskAnalysis, Analyze, Alerts...
│       ├── components/
│       └── context/
├── backend/           # Laravel 11 API
│   ├── app/
│   │   ├── Models/
│   │   ├── Http/Controllers/Api/
│   │   └── Console/Commands/
│   └── resources/views/reports/
└── ml/                # FastAPI microservice
    ├── main.py
    ├── retrain_clean.py
    └── models/
```

---

## Getting Started

### Prerequisites
- PHP 8.2+ · Composer
- Node.js 18+
- Python 3.10+
- PostgreSQL 15+

### Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### ML Microservice (FastAPI)
```bash
cd ml
pip install -r requirements.txt
python retrain_clean.py        # train the model
uvicorn main:app --port 8001
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

---

## Risk Classification

Each quarter is labeled using a composite score across 8 financial thresholds:

| Condition | Points |
|---|---|
| Current Ratio < 1.0 | +2 |
| Current Ratio < 0.7 (extra penalty) | +1 |
| Debt-to-Equity > 2.0 | +2 |
| Interest Coverage < 1.5 | +2 |
| Operating Margin < 0 | +2 |
| Net Margin < −10% | +1 |
| Revenue Growth YoY < −10% | +1 |
| Free Cash Flow < 0 | +1 |

**Score 0–1** → `low_risk` · **Score 2–3** → `medium_risk` · **Score 4+** → `high_risk`

---

## Developed by

**Rayen Rakkad** — Full-Stack & ML Engineering Intern  
TEKUP University — Final Year Project (PFE) 2026

---

## License

This project was developed as an academic final year project.