import { useState } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Shield,
  Database,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  Cell,
} from "recharts";
import Layout from "../components/Layout.tsx";
import api from "../api/axios.ts";
import TickerAutocomplete from "../components/TickerAutocomplete.tsx";

interface Driver {
  feature: string;
  importance: number;
}
interface Quarter {
  date: string;
  risk_label: string;
  risk_color: string;
  confidence: number;
  revenue: number | null;
  operating_margin: number | null;
  current_ratio: number | null;
  debt_to_equity: number | null;
  top_risk_drivers: Driver[];
  probabilities: { high_risk: number; low_risk: number; medium_risk: number };
}
interface Company {
  id: number;
  ticker: string;
  name: string;
  sector: string;
  country: string;
  employees: number;
  market_cap: number;
}
interface Analysis {
  total_quarters: number;
  date_range: string;
  latest_risk: string;
  latest_color: string;
  latest_confidence: number;
  data_quality: number;
  data_quality_note: string;
  risk_distribution: {
    low_risk: number;
    medium_risk: number;
    high_risk: number;
  };
}
interface AnalyzeResult {
  ticker: string;
  company: Company;
  analysis: Analysis;
  quarters: Quarter[];
}

const n = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const fmt = (d: string) => d?.slice(0, 7) ?? "";

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

// Popular tickers for quick search
const QUICK_TICKERS = [
  { ticker: "EPAM", label: "EPAM Systems" },
  { ticker: "MSFT", label: "Microsoft" },
  { ticker: "GOOGL", label: "Alphabet" },
  { ticker: "ACN", label: "Accenture" },
  { ticker: "INFY", label: "Infosys" },
  { ticker: "CTSH", label: "Cognizant" },
  { ticker: "SAP", label: "SAP" },
  { ticker: "IBM", label: "IBM" },
];

export default function Analyze() {
  const navigate = useNavigate();
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const analyze = async (t?: string) => {
    const target = (t ?? ticker).trim().toUpperCase();
    if (!target) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await api.post("/analyze", { ticker: target });
      setResult(res.data);
      setTicker(target);
    } catch (err: any) {
      setError(
        err.response?.data?.message ??
          err.response?.data?.detail ??
          "Analysis failed. Please check the ticker symbol and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const latest = result?.quarters[result.quarters.length - 1];
  const previous = result?.quarters[result.quarters.length - 2];

  const revenueData =
    result?.quarters.map((q) => ({
      date: fmt(q.date),
      revenue: n(q.revenue),
      margin: +(n(q.operating_margin) * 100).toFixed(2),
    })) ?? [];

  const riskData = [
    {
      name: "Low Risk",
      value: result?.analysis.risk_distribution.low_risk ?? 0,
      color: "#22c55e",
    },
    {
      name: "Medium Risk",
      value: result?.analysis.risk_distribution.medium_risk ?? 0,
      color: "#f59e0b",
    },
    {
      name: "High Risk",
      value: result?.analysis.risk_distribution.high_risk ?? 0,
      color: "#ef4444",
    },
  ];

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Analyze Company</h1>
          <p className="text-gray-400 mt-1">
            Enter any publicly listed ticker to run a full financial risk
            analysis
          </p>
        </div>

        {/* Search bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex gap-3">
            <TickerAutocomplete
              value={ticker}
              onChange={setTicker}
              onSelect={(t) => {
                setTicker(t);
                analyze(t);
              }}
              onAnalyze={() => analyze()}
              loading={loading}
            />
            <button
              onClick={() => analyze()}
              disabled={loading || !ticker.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" /> Analyze
                </>
              )}
            </button>
          </div>

          {/* Quick tickers */}
          <div className="mt-4">
            <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">
              Quick search
            </p>
            <div className="flex gap-2 flex-wrap">
              {QUICK_TICKERS.map((q) => (
                <button
                  key={q.ticker}
                  onClick={() => analyze(q.ticker)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white rounded-lg text-xs font-mono transition-colors"
                >
                  {q.ticker}
                  <span className="text-gray-500 ml-1 font-sans">
                    {q.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-white font-medium">Analyzing {ticker}...</p>
              <p className="text-gray-400 text-sm mt-1">
                Fetching financials → engineering features → scoring risk
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Analysis Failed</p>
              <p className="text-red-400/70 text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Company header */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-white">
                      {result.company.name}
                    </h2>
                    <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                      {result.ticker}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {result.company.sector} · {result.company.country} ·{" "}
                    {result.company.employees?.toLocaleString()} employees · $
                    {((result.company.market_cap ?? 0) / 1e9).toFixed(1)}B
                    market cap
                  </p>
                </div>

                {/* Risk badge */}
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                  style={{
                    color: riskInfo(result.analysis.latest_risk).color,
                    borderColor:
                      riskInfo(result.analysis.latest_risk).color + "40",
                    background: riskInfo(result.analysis.latest_risk).bg,
                  }}
                >
                  <Shield className="w-4 h-4" />
                  <div>
                    <p className="font-bold text-sm">
                      {riskInfo(result.analysis.latest_risk).text}
                    </p>
                    <p className="text-xs opacity-70">
                      {(result.analysis.latest_confidence * 100).toFixed(1)}%
                      confidence
                    </p>
                  </div>
                </div>
              </div>

              {/* Data quality + meta */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400 text-sm">
                    Data quality:
                    <span
                      className={`ml-1 font-medium ${
                        result.analysis.data_quality >= 90
                          ? "text-green-400"
                          : result.analysis.data_quality >= 70
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {result.analysis.data_quality}% (
                      {result.analysis.data_quality_note})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400 text-sm">
                    {result.analysis.total_quarters} quarters ·{" "}
                    {result.analysis.date_range}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-400 text-sm">
                    Saved to database
                  </span>
                </div>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Revenue (latest)",
                  value: latest?.revenue
                    ? `$${n(latest.revenue).toFixed(0)}M`
                    : "N/A",
                },
                {
                  label: "Operating Margin",
                  value: latest?.operating_margin
                    ? `${(n(latest.operating_margin) * 100).toFixed(1)}%`
                    : "N/A",
                },
                {
                  label: "Current Ratio",
                  value: latest?.current_ratio
                    ? n(latest.current_ratio).toFixed(2)
                    : "N/A",
                },
                {
                  label: "Debt / Equity",
                  value: latest?.debt_to_equity
                    ? n(latest.debt_to_equity).toFixed(3)
                    : "N/A",
                },
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

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue trend */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">Revenue Trend</h3>
                <p className="text-gray-500 text-xs mb-4">Quarterly — $M</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#rg)"
                      strokeWidth={2}
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Risk distribution */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">
                  Risk Distribution
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Quarters by risk level
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={riskData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [`${v} quarters`]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {riskData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk history + top drivers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk history */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">Risk History</h3>
                <p className="text-gray-500 text-xs mb-4">All quarters</p>
                <div className="space-y-2">
                  {[...result.quarters].reverse().map((q, i) => {
                    const ri = riskInfo(q.risk_label);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: ri.color }}
                          />
                          <span className="text-gray-300 text-sm font-mono">
                            {q.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ color: ri.color, background: ri.bg }}
                          >
                            {ri.text}
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

              {/* Top risk drivers */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-1">
                  Top Risk Drivers
                </h3>
                <p className="text-gray-500 text-xs mb-4">
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

                {/* Probability breakdown */}
                <div className="mt-6 pt-4 border-t border-gray-800">
                  <p className="text-gray-400 text-xs mb-3">
                    Risk probabilities
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "Low",
                        value: latest?.probabilities.low_risk ?? 0,
                        color: "#22c55e",
                      },
                      {
                        label: "Medium",
                        value: latest?.probabilities.medium_risk ?? 0,
                        color: "#f59e0b",
                      },
                      {
                        label: "High",
                        value: latest?.probabilities.high_risk ?? 0,
                        color: "#ef4444",
                      },
                    ].map((p) => (
                      <div key={p.label} className="text-center">
                        <p className="text-xs text-gray-500 mb-1">{p.label}</p>
                        <p
                          className="font-bold text-sm"
                          style={{ color: p.color }}
                        >
                          {(n(p.value) * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* View full dashboard button */}
            <div className="flex justify-center">
              <button
                onClick={() => navigate(`/companies/${result.ticker}`)}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                View Full Dashboard for {result.ticker}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
