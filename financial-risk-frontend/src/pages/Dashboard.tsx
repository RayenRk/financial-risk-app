import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Shield,
  Activity,
  Building2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import Layout from "../components/Layout.tsx";
import api from "../api/axios.ts";

interface Company {
  id: number;
  ticker: string;
  name: string;
  sector: string;
  country: string;
  employees: number;
  market_cap: number;
  current_risk: string;
  risk_color: string;
}

interface Quarter {
  id: number;
  quarter_date: string;
  revenue: number | null;
  net_income: number | null;
  operating_margin: number | null;
  current_ratio: number | null;
  debt_to_equity: number | null;
  risk_label: string;
  risk_color: string;
  confidence: number;
  top_risk_drivers: { feature: string; importance: number }[];
}

const riskLabel = (label: string) => {
  switch (label) {
    case "high_risk":
      return "High Risk";
    case "medium_risk":
      return "Medium Risk";
    case "low_risk":
      return "Low Risk";
    default:
      return label;
  }
};

const formatCurrency = (val: number | null) => {
  if (val == null) return "N/A";
  const num = parseFloat(String(val));
  return isNaN(num) ? "N/A" : `$${num.toFixed(0)}M`;
};

const formatPct = (val: number | null) => {
  if (val == null) return "N/A";
  const num = parseFloat(String(val));
  return isNaN(num) ? "N/A" : `${(num * 100).toFixed(1)}%`;
};

const formatLargeNum = (val: number) => {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val}`;
};

export default function Dashboard() {
  const [company, setCompany] = useState<Company | null>(null);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [companyRes, quartersRes] = await Promise.all([
          api.get("/company"),
          api.get("/quarters"),
        ]);
        setCompany(companyRes.data);
        setQuarters(quartersRes.data.quarters ?? []);
      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError(
          err?.response?.data?.message ?? "Failed to load dashboard data.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading)
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );

  if (error)
    return (
      <Layout>
        <div className="p-8 text-red-400">{error}</div>
      </Layout>
    );

  const latest = quarters[quarters.length - 1];
  const previous = quarters[quarters.length - 2];

  const revenueData = quarters.map((q) => ({
    date: q.quarter_date?.split("T")[0]?.slice(0, 7),
    revenue: q.revenue ?? 0,
    income: q.net_income ?? 0,
  }));

  const marginData = quarters.map((q) => ({
    date: q.quarter_date?.split("T")[0]?.slice(0, 7),
    margin:
      q.operating_margin != null ? +(q.operating_margin * 100).toFixed(2) : 0,
  }));

  const revChange =
    latest?.revenue && previous?.revenue
      ? (
          ((latest.revenue - previous.revenue) / previous.revenue) *
          100
        ).toFixed(1)
      : null;

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{company?.name}</h1>
            <p className="text-gray-400 mt-1">
              {company?.sector} · {company?.country} · NYSE: {company?.ticker}
            </p>
          </div>
          {/* Current risk badge */}
          <div className="text-right">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold"
              style={{
                color: company?.risk_color,
                borderColor: company?.risk_color + "40",
                background: company?.risk_color + "15",
              }}
            >
              <Shield className="w-4 h-4" />
              {riskLabel(company?.current_risk ?? "")}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Latest: {latest?.quarter_date?.split("T")[0]}
            </p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Revenue",
              value: formatCurrency(latest?.revenue),
              sub: revChange
                ? `${revChange}% vs prev quarter`
                : "vs prev quarter",
              icon: DollarSign,
              up: revChange ? parseFloat(revChange) > 0 : null,
            },
            {
              label: "Operating Margin",
              value: formatPct(latest?.operating_margin),
              sub: "Current quarter",
              icon: TrendingUp,
              up:
                latest?.operating_margin != null
                  ? latest.operating_margin > 0
                  : null,
            },
            {
              label: "Current Ratio",
              value:
                latest?.current_ratio != null
                  ? parseFloat(String(latest.current_ratio)).toFixed(2)
                  : "N/A",
              sub: "Liquidity indicator",
              icon: Activity,
              up:
                latest?.current_ratio != null
                  ? latest.current_ratio > 1.5
                  : null,
            },
            {
              label: "Market Cap",
              value: company?.market_cap
                ? formatLargeNum(company.market_cap)
                : "N/A",
              sub: `${company?.employees?.toLocaleString()} employees`,
              icon: Building2,
              up: null,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-sm">{kpi.label}</p>
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                  <kpi.icon className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{kpi.value}</p>
              <div className="flex items-center gap-1">
                {kpi.up !== null &&
                  (kpi.up ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  ))}
                <p className="text-gray-500 text-xs">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-1">
              Revenue & Net Income
            </h3>
            <p className="text-gray-500 text-xs mb-4">Quarterly — in $M</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  fill="url(#revGrad)"
                  strokeWidth={2}
                  name="Revenue ($M)"
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#22c55e"
                  fill="url(#incGrad)"
                  strokeWidth={2}
                  name="Net Income ($M)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Operating margin chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-1">Operating Margin</h3>
            <p className="text-gray-500 text-xs mb-4">Quarterly — percentage</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={marginData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(v: number) => [`${v}%`, "Operating Margin"]}
                />
                <Bar
                  dataKey="margin"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Operating Margin"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk drivers + latest quarter */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top risk drivers */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-1">Top Risk Drivers</h3>
            <p className="text-gray-500 text-xs mb-4">
              Latest quarter — SHAP importance
            </p>
            <div className="space-y-3">
              {latest?.top_risk_drivers?.map((driver, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 capitalize">
                      {driver.feature.replace(/_/g, " ")}
                    </span>
                    <span className="text-gray-400">
                      {driver.importance.toFixed(3)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{
                        width: `${Math.min((driver.importance / 1.5) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk history */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-1">Risk History</h3>
            <p className="text-gray-500 text-xs mb-4">All quarters</p>
            <div className="space-y-2">
              {[...quarters].reverse().map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: q.risk_color }}
                    />
                    <span className="text-gray-300 text-sm">
                      {q.quarter_date?.split("T")[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        color: q.risk_color,
                        background: q.risk_color + "20",
                      }}
                    >
                      {riskLabel(q.risk_label)}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {(q.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alert if any high risk */}
        {quarters.some((q) => q.risk_label === "high_risk") && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium text-sm">
                High Risk Detected
              </p>
              <p className="text-red-400/70 text-xs mt-0.5">
                One or more quarters have been flagged as high risk. Review the
                Risk Analysis page for details.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
