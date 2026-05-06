import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  ArrowLeft,
  RefreshCw,
  Database,
  AlertTriangle,
  Building2,
} from "lucide-react";
import Layout from "../components/Layout.tsx";
import api from "../api/axios.ts";
import AIRecommendations from "../components/AIRecommendations.tsx";

interface Driver {
  feature: string;
  importance: number;
}
interface Quarter {
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
  current_ratio: number | null;
  debt_to_equity: number | null;
  roe: number | null;
  roa: number | null;
  revenue_growth_yoy: number | null;
  risk_label: string;
  risk_color: string;
  confidence: number;
  prob_high_risk: number;
  prob_low_risk: number;
  prob_medium_risk: number;
  top_risk_drivers: Driver[];
}
interface Company {
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
}

const n = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const fmt = (d: string) =>
  d?.split("T")[0]?.slice(0, 7) ?? d?.slice(0, 7) ?? "";
const usd = (v: unknown) => (v != null ? `$${n(v).toFixed(0)}M` : "N/A");
const pct = (v: unknown) => (v != null ? `${(n(v) * 100).toFixed(1)}%` : "N/A");

const riskInfo = (label: string) => {
  switch (label) {
    case "high_risk":
      return { text: "High Risk", color: "#ef4444", bg: "#ef444415" };
    case "medium_risk":
      return { text: "Medium Risk", color: "#f59e0b", bg: "#f59e0b15" };
    default:
      return { text: "Low Risk", color: "#22c55e", bg: "#22c55e15" };
  }
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 8,
    color: "#f9fafb",
  },
  labelStyle: { color: "#f9fafb" },
  itemStyle: { color: "#93c5fd" },
};

export default function CompanyDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<Company | null>(null);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "financials" | "risk"
  >("overview");

  const fetchData = async () => {
    if (!ticker) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/companies/${ticker}`);
      setCompany(res.data.company);
      setQuarters(res.data.quarters ?? []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(
          `${ticker} has not been analyzed yet. Go to Analyze Company to run a full analysis.`,
        );
      } else {
        setError("Failed to load company data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!ticker) return;
    setRefreshing(true);
    try {
      await api.post("/analyze", { ticker });
      await fetchData();
    } catch {
      setError("Refresh failed. Make sure FastAPI is running.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ticker]);

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
        <div className="p-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Company not found</p>
              <p className="text-red-400/70 text-sm mt-1">{error}</p>
              <button
                onClick={() => navigate("/analyze")}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                Go to Analyze
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );

  if (!company || quarters.length === 0) return null;

  const latest = quarters[quarters.length - 1];
  const previous = quarters[quarters.length - 2];
  const ri = riskInfo(latest?.risk_label ?? "");

  const revChange =
    latest?.revenue && previous?.revenue
      ? (
          ((n(latest.revenue) - n(previous.revenue)) / n(previous.revenue)) *
          100
        ).toFixed(1)
      : null;

  // Chart data
  const incomeData = quarters.map((q) => ({
    date: fmt(q.quarter_date),
    revenue: n(q.revenue),
    net: n(q.net_income),
    operating: n(q.operating_income),
  }));

  const marginData = quarters.map((q) => ({
    date: fmt(q.quarter_date),
    gross: +(n(q.gross_margin) * 100).toFixed(2),
    operating: +(n(q.operating_margin) * 100).toFixed(2),
    net: +(n(q.net_margin) * 100).toFixed(2),
  }));

  const cashData = quarters.map((q) => ({
    date: fmt(q.quarter_date),
    fcf: n(q.free_cash_flow),
    cash: n(q.cash),
    debt: n(q.total_debt),
  }));

  const probData = [
    {
      name: "Low",
      value: +(n(latest?.prob_low_risk) * 100).toFixed(1),
      color: "#22c55e",
    },
    {
      name: "Medium",
      value: +(n(latest?.prob_medium_risk) * 100).toFixed(1),
      color: "#f59e0b",
    },
    {
      name: "High",
      value: +(n(latest?.prob_high_risk) * 100).toFixed(1),
      color: "#ef4444",
    },
  ];

  const clamp = (v: number, min: number, max: number) =>
    Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  const radarData = [
    { metric: "Liquidity", value: clamp(n(latest?.current_ratio), 0, 4) },
    { metric: "Leverage", value: clamp(1 - n(latest?.debt_to_equity), -1, 1) },
    {
      metric: "Profitability",
      value: clamp(n(latest?.operating_margin), -0.1, 0.3),
    },
    {
      metric: "Growth",
      value: clamp(n(latest?.revenue_growth_yoy), -0.2, 0.3),
    },
    { metric: "Cash Flow", value: clamp(n(latest?.free_cash_flow), -100, 500) },
  ];

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-3 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{company.name}</h1>
              <span className="font-mono text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                {company.ticker}
              </span>
            </div>
            <p className="text-gray-400 mt-1 text-sm">
              {company.sector} · {company.industry} · {company.country} ·{" "}
              {company.employees?.toLocaleString()} employees
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Risk badge */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl border"
              style={{
                color: ri.color,
                borderColor: ri.color + "40",
                background: ri.bg,
              }}
            >
              <Shield className="w-4 h-4" />
              <div>
                <p className="font-bold text-sm">{ri.text}</p>
                <p className="text-xs opacity-70">
                  {(n(latest?.confidence) * 100).toFixed(1)}% confidence
                </p>
              </div>
            </div>

            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-xl text-sm transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-800 pb-0">
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "financials", label: "Financials" },
              { key: "risk", label: "Risk Analysis" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Revenue",
                  value: usd(latest?.revenue),
                  sub: revChange
                    ? `${revChange}% vs prev quarter`
                    : "Latest quarter",
                  icon: DollarSign,
                  up: revChange ? parseFloat(revChange) > 0 : null,
                },
                {
                  label: "Operating Margin",
                  value: pct(latest?.operating_margin),
                  sub: "Latest quarter",
                  icon: TrendingUp,
                  up: n(latest?.operating_margin) > 0,
                },
                {
                  label: "Current Ratio",
                  value: n(latest?.current_ratio).toFixed(2),
                  sub: "Liquidity",
                  icon: Activity,
                  up: n(latest?.current_ratio) > 1.5,
                },
                {
                  label: "Market Cap",
                  value: `$${((company.market_cap ?? 0) / 1e9).toFixed(1)}B`,
                  sub: `${company.employees?.toLocaleString()} employees`,
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
                  <p className="text-2xl font-bold text-white mb-1">
                    {kpi.value}
                  </p>
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

            {/* Revenue + risk history */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">
                  Revenue & Net Income
                </h3>
                <p className="text-gray-500 text-xs mb-4">Quarterly — $M</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={incomeData}>
                    <defs>
                      <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="ng2" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#22c55e"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#22c55e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [`$${v}M`]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      fill="url(#rg2)"
                      strokeWidth={2}
                      name="Revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke="#22c55e"
                      fill="url(#ng2)"
                      strokeWidth={2}
                      name="Net Income"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">Risk History</h3>
                <p className="text-gray-500 text-xs mb-4">All quarters</p>
                <div className="space-y-2">
                  {[...quarters].reverse().map((q, i) => {
                    const qri = riskInfo(q.risk_label);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: qri.color }}
                          />
                          <span className="text-gray-300 text-sm font-mono">
                            {fmt(q.quarter_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ color: qri.color, background: qri.bg }}
                          >
                            {qri.text}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {(n(q.confidence) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Company description */}
            {company.description && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-400" /> About{" "}
                  {company.name}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {company.description}
                </p>
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    {company.website} →
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── FINANCIALS TAB ── */}
        {activeTab === "financials" && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Revenue", value: usd(latest?.revenue) },
                { label: "Gross Profit", value: usd(latest?.gross_profit) },
                { label: "Net Income", value: usd(latest?.net_income) },
                { label: "Free Cash Flow", value: usd(latest?.free_cash_flow) },
                { label: "Gross Margin", value: pct(latest?.gross_margin) },
                {
                  label: "Operating Margin",
                  value: pct(latest?.operating_margin),
                },
                { label: "ROE", value: pct(latest?.roe) },
                { label: "ROA", value: pct(latest?.roa) },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                >
                  <p className="text-gray-400 text-xs mb-2">{card.label}</p>
                  <p className="text-xl font-bold text-white">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-1">
                Income Statement
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                Revenue, operating income, net income — $M
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={incomeData}>
                  <defs>
                    {[
                      ["rg3", "#3b82f6"],
                      ["og3", "#f59e0b"],
                      ["ng3", "#22c55e"],
                    ].map(([id, color]) => (
                      <linearGradient
                        key={id}
                        id={id}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={color}
                          stopOpacity={0.25}
                        />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="M" />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [`$${v}M`]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    fill="url(#rg3)"
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="operating"
                    stroke="#f59e0b"
                    fill="url(#og3)"
                    strokeWidth={2}
                    name="Operating Income"
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#22c55e"
                    fill="url(#ng3)"
                    strokeWidth={2}
                    name="Net Income"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">
                  Profit Margins
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Quarterly — percentage
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={marginData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="%" />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [`${v}%`]}
                    />
                    <Line
                      type="monotone"
                      dataKey="gross"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Gross"
                    />
                    <Line
                      type="monotone"
                      dataKey="operating"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Operating"
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Net"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">
                  Cash Flow & Debt
                </h3>
                <p className="text-gray-500 text-xs mb-4">Quarterly — $M</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cashData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [`$${v}M`]}
                    />
                    <Bar
                      dataKey="fcf"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                      name="FCF"
                    />
                    <Bar
                      dataKey="cash"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      name="Cash"
                    />
                    <Bar
                      dataKey="debt"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      name="Debt"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Data table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold">Quarterly Data</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "Quarter",
                        "Revenue",
                        "Op. Income",
                        "Net Income",
                        "FCF",
                        "Current Ratio",
                        "D/E",
                        "Risk",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-gray-400 font-medium text-xs"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...quarters].reverse().map((q, i) => {
                      const qri = riskInfo(q.risk_label);
                      return (
                        <tr
                          key={q.id}
                          className={`border-b border-gray-800/50 ${i % 2 === 0 ? "bg-gray-800/20" : ""}`}
                        >
                          <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                            {fmt(q.quarter_date)}
                          </td>
                          <td className="px-4 py-3 text-white">
                            {usd(q.revenue)}
                          </td>
                          <td className="px-4 py-3 text-yellow-400">
                            {usd(q.operating_income)}
                          </td>
                          <td className="px-4 py-3 text-green-400">
                            {usd(q.net_income)}
                          </td>
                          <td className="px-4 py-3 text-blue-400">
                            {usd(q.free_cash_flow)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                n(q.current_ratio) >= 1.5
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {n(q.current_ratio).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                n(q.debt_to_equity) <= 1
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {n(q.debt_to_equity).toFixed(3)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ color: qri.color, background: qri.bg }}
                            >
                              {qri.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── RISK TAB ── */}
        {activeTab === "risk" && (
          <div className="space-y-6">
            {/* Risk card */}
            <div
              className="flex items-center gap-4 p-5 rounded-xl border"
              style={{ borderColor: ri.color + "40", background: ri.bg }}
            >
              <Shield className="w-10 h-10" style={{ color: ri.color }} />
              <div className="flex-1">
                <p className="text-white font-bold text-xl">{ri.text}</p>
                <p className="text-gray-400 text-sm">
                  Latest: {fmt(latest?.quarter_date ?? "")} ·{" "}
                  {(n(latest?.confidence) * 100).toFixed(1)}% confidence
                </p>
              </div>
              <div className="flex gap-6 text-right">
                {[
                  {
                    label: "Low",
                    value: n(latest?.prob_low_risk),
                    color: "#22c55e",
                  },
                  {
                    label: "Medium",
                    value: n(latest?.prob_medium_risk),
                    color: "#f59e0b",
                  },
                  {
                    label: "High",
                    value: n(latest?.prob_high_risk),
                    color: "#ef4444",
                  },
                ].map((p) => (
                  <div key={p.label}>
                    <p className="text-gray-400 text-xs">{p.label}</p>
                    <p className="font-bold" style={{ color: p.color }}>
                      {(p.value * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Probability bars */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">
                  Risk Probabilities
                </h3>
                <p className="text-gray-500 text-xs mb-4">Latest quarter</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={probData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      type="number"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      unit="%"
                      domain={[0, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      width={60}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [`${v}%`]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {probData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">
                  Financial Health Radar
                </h3>
                <p className="text-gray-500 text-xs mb-4">Normalised 0–100</p>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1f2937" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SHAP drivers */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-1">
                Top Risk Drivers
              </h3>
              <p className="text-gray-500 text-xs mb-5">
                Latest quarter — SHAP importance
              </p>
              <div className="space-y-4">
                {(latest?.top_risk_drivers ?? []).map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-300 capitalize">
                        {d.feature.replace(/_/g, " ")}
                      </span>
                      <span className="text-gray-400 font-mono">
                        {d.importance.toFixed(4)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min((d.importance / 1.5) * 100, 100)}%`,
                          background:
                            i === 0
                              ? "#3b82f6"
                              : i === 1
                                ? "#8b5cf6"
                                : "#f59e0b",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk history table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold">Risk History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "Quarter",
                        "Risk Label",
                        "Confidence",
                        "Current Ratio",
                        "D/E Ratio",
                        "Op. Margin",
                        "FCF",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-gray-400 font-medium text-xs"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...quarters].reverse().map((q, i) => {
                      const qri = riskInfo(q.risk_label);
                      return (
                        <tr
                          key={q.id}
                          className={`border-b border-gray-800/50 ${i % 2 === 0 ? "bg-gray-800/20" : ""}`}
                        >
                          <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                            {fmt(q.quarter_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ color: qri.color, background: qri.bg }}
                            >
                              {qri.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white">
                            {(n(q.confidence) * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                n(q.current_ratio) >= 1.5
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {n(q.current_ratio).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                n(q.debt_to_equity) <= 1
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {n(q.debt_to_equity).toFixed(3)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                n(q.operating_margin) > 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {(n(q.operating_margin) * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                n(q.free_cash_flow) >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {usd(q.free_cash_flow)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* AI Recommendations */}
            <AIRecommendations
              ticker={company.ticker}
              riskLabel={latest?.risk_label ?? "low_risk"}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
