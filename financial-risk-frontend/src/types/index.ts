// ── Auth ──────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "analyst";
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
  token_type: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role?: "admin" | "analyst";
}

// ── Company ───────────────────────────────────────────────
export interface Company {
  id: number;
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  country: string;
  employees: number;
  market_cap: number;
  website: string;
  description: string;
  fetched_at: string;
  current_risk: RiskLabel;
  risk_color: string;
}

// ── Risk ──────────────────────────────────────────────────
export type RiskLabel = "low_risk" | "medium_risk" | "high_risk";

export interface RiskDriver {
  feature: string;
  importance: number;
}

export interface RiskPrediction {
  quarter_date: string;
  risk_label: RiskLabel;
  risk_color: string;
  confidence: number;
  prob_high_risk: number;
  prob_low_risk: number;
  prob_medium_risk: number;
  top_risk_drivers: RiskDriver[];
  model_version: string;
  predicted_at: string;
}

// ── Quarter ───────────────────────────────────────────────
export interface Quarter {
  id: number;
  quarter_date: string;
  revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  free_cash_flow: number | null;
  total_debt: number | null;
  cash: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  fcf_margin: number | null;
  roe: number | null;
  roa: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  interest_coverage: number | null;
  asset_turnover: number | null;
  revenue_growth_yoy: number | null;
  risk_label: RiskLabel;
  risk_color: string;
  confidence: number;
  prob_high_risk: number;
  prob_low_risk: number;
  prob_medium_risk: number;
  top_risk_drivers: RiskDriver[];
}

// ── Alert ─────────────────────────────────────────────────
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "high_risk_detected"
  | "risk_increased"
  | "risk_decreased"
  | "negative_margin"
  | "low_liquidity"
  | "high_leverage";

export interface Alert {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  severity_color: string;
  message: string;
  is_read: boolean;
  triggered_at: string;
  read_at: string | null;
  company: {
    id: number;
    name: string;
    ticker: string;
  };
  quarter_date: string;
}

// ── API responses ─────────────────────────────────────────
export interface QuartersResponse {
  company_id: number;
  ticker: string;
  quarters: Quarter[];
  count: number;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  unread_count: number;
}

export interface UsersResponse {
  users: User[];
  count: number;
}
