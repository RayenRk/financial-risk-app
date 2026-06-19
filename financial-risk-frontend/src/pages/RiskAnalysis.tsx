import { useEffect, useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
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
} from "recharts";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import Layout from "../components/Layout.tsx";
import api from "../api/axios.ts";
import AIRecommendations from "../components/AIRecommendations.tsx";

interface RiskDriver {
  feature: string;
  importance: number;
}

interface Quarter {
  id: number;
  quarter_date: string;
  risk_label: string;
  risk_color: string;
  confidence: number;
  prob_high_risk: number;
  prob_low_risk: number;
  prob_medium_risk: number;
  top_risk_drivers: RiskDriver[];
  current_ratio: number | null;
  debt_to_equity: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  interest_coverage: number | null;
  revenue_growth_yoy: number | null;
  free_cash_flow: number | null;
}

const n = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const fmt = (d: string) => d?.split("T")[0]?.slice(0, 7) ?? "";

const riskInfo = (label: string) => {
  switch (label) {
    case "high_risk":
      return {
        text: "High Risk",
        color: "#ef4444",
        bg: "#ef444415",
        Icon: ShieldX,
      };
    case "medium_risk":
      return {
        text: "Medium Risk",
        color: "#f59e0b",
        bg: "#f59e0b15",
        Icon: ShieldAlert,
      };
    default:
      return {
        text: "Low Risk",
        color: "#22c55e",
        bg: "#22c55e15",
        Icon: ShieldCheck,
      };
  }
};

const featureLabel = (f: string) =>
  f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 8,
    color: "var(--color-text-primary)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  },
  labelStyle: { color: "var(--color-text-primary)", fontWeight: 500 },
  itemStyle: { color: "var(--color-text-secondary)" },
  cursor: { fill: "var(--color-background-secondary)" },
};

// ── Sector benchmarks ─────────────────────────────────────────────
const BENCHMARKS = {
  current_ratio: { label: "IT avg 1.5–2.0" },
  debt_to_equity: { label: "IT avg < 1.0" },
  operating_margin: { label: "IT avg 15–25%" },
  free_cash_flow: { label: "healthy if > 0" },
};

// ── Mini bar ──────────────────────────────────────────────────────
const MiniBar = ({
  val,
  min,
  max,
  color,
}: {
  val: number;
  min: number;
  max: number;
  color: string;
}) => {
  const pct = Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
  return (
    <div
      style={{
        width: 64,
        height: 4,
        flexShrink: 0,
        background: "var(--color-background-secondary,#1f2937)",
        borderRadius: 2,
      }}
    >
      <div
        style={{
          width: `${pct.toFixed(0)}%`,
          height: 4,
          borderRadius: 2,
          background: color,
        }}
      />
    </div>
  );
};

// ── Quarter-over-quarter change indicator ─────────────────────────
// higherIsBetter=true  → green when value went up (e.g. current_ratio)
// higherIsBetter=false → green when value went down (e.g. debt_to_equity)
const QoQIndicator = ({
  current,
  previous,
  higherIsBetter = true,
}: {
  current: number;
  previous: number | null;
  higherIsBetter?: boolean;
}) => {
  if (previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.0001) {
    return <Minus className="w-3 h-3 inline ml-1 text-gray-400" />;
  }
  const pct = previous !== 0 ? Math.abs((diff / previous) * 100) : 0;
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs ml-1 font-medium"
      style={{ color: improved ? "#22c55e" : "#ef4444" }}
      title={`${diff > 0 ? "+" : ""}${diff.toFixed(3)} vs previous quarter`}
    >
      {diff > 0 ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      )}
      {pct.toFixed(1)}%
    </span>
  );
};

export default function RiskAnalysis() {
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [selected, setSelected] = useState<Quarter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/quarters")
      .then((res) => {
        const qs = res.data.quarters ?? [];
        setQuarters(qs);
        setSelected(qs[qs.length - 1] ?? null);
      })
      .catch(() => setError("Failed to load risk data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );

  if (error)
    return (
      <Layout>
        <div className="p-8 text-red-500 dark:text-red-400">{error}</div>
      </Layout>
    );

  const latest = quarters[quarters.length - 1];
  const info = riskInfo(selected?.risk_label ?? "");
  const Icon = info.Icon;

  // ── Quarter-over-quarter lookup map ───────────────────────────
  // quarters is sorted oldest→newest. For each quarter id, store the
  // previous quarter so the table can show change arrows instantly.
  const prevMap = new Map<number, Quarter>();
  quarters.forEach((q, idx) => {
    if (idx > 0) prevMap.set(q.id, quarters[idx - 1]);
  });

  const probData = selected
    ? [
        {
          name: "Low Risk",
          value: +(n(selected.prob_low_risk) * 100).toFixed(2),
          color: "#22c55e",
        },
        {
          name: "Medium Risk",
          value: +(n(selected.prob_medium_risk) * 100).toFixed(2),
          color: "#f59e0b",
        },
        {
          name: "High Risk",
          value: +(n(selected.prob_high_risk) * 100).toFixed(2),
          color: "#ef4444",
        },
      ]
    : [];

  const shapData = (selected?.top_risk_drivers ?? []).map((d) => ({
    feature: featureLabel(d.feature),
    importance: +d.importance.toFixed(4),
  }));

  const clamp = (v: number, min: number, max: number) =>
    Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  const radarData = selected
    ? [
        { metric: "Liquidity", value: clamp(n(selected.current_ratio), 0, 4) },
        {
          metric: "Leverage",
          value: clamp(1 - n(selected.debt_to_equity), -1, 1),
        },
        {
          metric: "Profitability",
          value: clamp(n(selected.operating_margin), -0.1, 0.3),
        },
        {
          metric: "Coverage",
          value: clamp(Math.min(n(selected.interest_coverage), 20), 0, 20),
        },
        {
          metric: "Growth",
          value: clamp(n(selected.revenue_growth_yoy), -0.2, 0.3),
        },
        {
          metric: "Cash Flow",
          value: clamp(n(selected.free_cash_flow), -100, 500),
        },
      ]
    : [];

  const trendData = quarters.map((q) => ({
    date: fmt(q.quarter_date),
    low: +(n(q.prob_low_risk) * 100).toFixed(2),
    medium: +(n(q.prob_medium_risk) * 100).toFixed(2),
    high: +(n(q.prob_high_risk) * 100).toFixed(2),
  }));

  const medHighValues = trendData.flatMap((d) => [d.medium, d.high]);
  const medHighMax = Math.max(
    0.1,
    Math.ceil((Math.max(...medHighValues) + 0.02) * 100) / 100,
  );

  return (
    <Layout>
      <div className="p-8 space-y-6 bg-gray-50 dark:bg-gray-950 min-h-screen transition-colors duration-200">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Risk Analysis
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              EPAM Systems — ML-powered financial risk detection
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* PDF Export button */}
            <button
              onClick={() => {
                const quarter = selected?.quarter_date?.split("T")[0] ?? "";
                const token = localStorage.getItem("token") ?? "";
                window.open(
                  `http://localhost:8000/api/report/EPAM?quarter=${quarter}&token=${token}`,
                  "_blank",
                );
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                 text-gray-600 dark:text-gray-300 text-sm font-medium
                 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              Export PDF
            </button>

            {/* Current risk badge */}
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl border"
              style={{
                color: riskInfo(latest?.risk_label).color,
                borderColor: riskInfo(latest?.risk_label).color + "40",
                background: riskInfo(latest?.risk_label).bg,
              }}
            >
              <ShieldCheck className="w-5 h-5" />
              <div>
                <p className="font-bold text-sm">
                  {riskInfo(latest?.risk_label).text}
                </p>
                <p className="text-xs opacity-70">
                  Confidence: {(n(latest?.confidence) * 100).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quarter selector */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-3 uppercase tracking-wider font-medium">
            Select Quarter
          </p>
          <div className="flex gap-2 flex-wrap">
            {quarters.map((q) => {
              const ri = riskInfo(q.risk_label);
              const isSelected = selected?.id === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setSelected(q)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    borderColor: isSelected
                      ? ri.color
                      : "var(--color-border-strong, #d1d5db)",
                    background: isSelected ? ri.bg : "transparent",
                    color: isSelected ? ri.color : "#9ca3af",
                  }}
                >
                  {fmt(q.quarter_date)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected quarter risk card */}
        {selected && (
          <div
            className="flex items-center gap-4 p-5 rounded-xl border"
            style={{ borderColor: info.color + "40", background: info.bg }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: info.color + "20" }}
            >
              <Icon className="w-6 h-6" style={{ color: info.color }} />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 dark:text-white font-bold text-lg">
                {info.text}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Quarter: {fmt(selected.quarter_date)} · Confidence:{" "}
                {(n(selected.confidence) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-gray-400 text-xs">High Risk Prob.</p>
                <p className="text-red-400 font-bold">
                  {(n(selected.prob_high_risk) * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Medium Risk Prob.</p>
                <p className="text-yellow-400 font-bold">
                  {(n(selected.prob_medium_risk) * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Low Risk Prob.</p>
                <p className="text-green-400 font-bold">
                  {(n(selected.prob_low_risk) * 100).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Probability bars */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-0.5">
              Risk Probabilities
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-5">
              Model output for {fmt(selected?.quarter_date ?? "")}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={probData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-grid, #1f2937)"
                />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--color-tick, #6b7280)", fontSize: 11 }}
                  unit="%"
                  domain={[0, 100]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "var(--color-tick, #9ca3af)", fontSize: 12 }}
                  width={90}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v}%`]}
                  cursor={{
                    fill: "var(--color-background-secondary)",
                    opacity: 0.1,
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {probData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* SHAP importance */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-0.5">
              Top Risk Drivers
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-5">
              SHAP feature importance — {fmt(selected?.quarter_date ?? "")}
            </p>
            <div className="space-y-4">
              {shapData.map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-300">{d.feature}</span>
                    <span className="text-gray-400 font-mono">
                      {d.importance}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((d.importance / 1.5) * 100, 100)}%`,
                        background:
                          i === 0 ? "#3b82f6" : i === 1 ? "#8b5cf6" : "#f59e0b",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial health radar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-0.5">
              Financial Health Radar
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-4">
              Normalised score (0–100) — {fmt(selected?.quarter_date ?? "")}
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--color-grid, #1f2937)" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: "var(--color-tick, #9ca3af)", fontSize: 11 }}
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

          {/* Risk probability trend */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-0.5">
              Risk Probability Trend
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-3">
              How each risk class probability evolved over time
            </p>
            <div className="flex gap-4 mb-4 flex-wrap">
              {[
                { label: "Low risk", color: "#22c55e", dash: "none" },
                { label: "Medium risk", color: "#f59e0b", dash: "4 3" },
                { label: "High risk", color: "#ef4444", dash: "2 2" },
              ].map(({ label, color, dash }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                >
                  <svg width="20" height="10">
                    <line
                      x1="0"
                      y1="5"
                      x2="20"
                      y2="5"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray={dash === "none" ? undefined : dash}
                    />
                  </svg>
                  {label}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ right: 16 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-grid, #1f2937)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--color-tick, #6b7280)", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="left"
                  domain={([dataMin, dataMax]: [number, number]) => {
                    const pad = (dataMax - dataMin) * 0.5 || 0.05;
                    return [
                      Math.max(0, +(dataMin - pad).toFixed(2)),
                      Math.min(100, +(dataMax + pad).toFixed(2)),
                    ];
                  }}
                  tick={{ fill: "#22c55e", fontSize: 10 }}
                  unit="%"
                  tickFormatter={(v: number) => v.toFixed(2)}
                  tickCount={5}
                  width={58}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, medHighMax]}
                  tick={{ fill: "#f59e0b", fontSize: 10 }}
                  unit="%"
                  tickFormatter={(v: number) => v.toFixed(2)}
                  width={52}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number, name: string) => [
                    `${v.toFixed(2)}%`,
                    name === "low"
                      ? "Low risk"
                      : name === "medium"
                        ? "Medium risk"
                        : "High risk",
                  ]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="low"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#22c55e" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="medium"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: "#f59e0b" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="high"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  dot={{ r: 3, fill: "#ef4444" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key indicators table — with sector benchmarks + QoQ arrows */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-gray-900 dark:text-white font-semibold">
              Risk Indicator Summary
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
              Thresholds used by the model · IT sector benchmarks · arrows show
              quarter-over-quarter change
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
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
                      className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium text-xs"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...quarters].reverse().map((q, i) => {
                  const ri = riskInfo(q.risk_label);
                  const cr = n(q.current_ratio);
                  const de = n(q.debt_to_equity);
                  const om = n(q.operating_margin);
                  const fcf = n(q.free_cash_flow);

                  // Previous quarter for QoQ comparison
                  // reversed array: index i → previous is index i+1
                  const prev = prevMap.get(q.id) ?? null;
                  const pCr = prev ? n(prev.current_ratio) : null;
                  const pDe = prev ? n(prev.debt_to_equity) : null;
                  const pOm = prev ? n(prev.operating_margin) : null;
                  const pFcf = prev ? n(prev.free_cash_flow) : null;

                  const crColor =
                    cr >= 1.5 ? "#22c55e" : cr >= 1.0 ? "#f59e0b" : "#ef4444";
                  const deColor =
                    de <= 1.0 ? "#22c55e" : de <= 2.0 ? "#f59e0b" : "#ef4444";
                  const omColor =
                    om >= 0.15 ? "#22c55e" : om >= 0 ? "#f59e0b" : "#ef4444";
                  const fcfColor = fcf >= 0 ? "#22c55e" : "#ef4444";

                  return (
                    <tr
                      key={q.id}
                      className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                        selected?.id === q.id
                          ? "bg-blue-50 dark:bg-blue-600/10"
                          : i % 2 === 0
                            ? "bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-100 dark:hover:bg-gray-800/40"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800/40"
                      }`}
                      onClick={() => setSelected(q)}
                    >
                      {/* Quarter */}
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                        {fmt(q.quarter_date)}
                      </td>

                      {/* Risk label */}
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: ri.color, background: ri.bg }}
                        >
                          {ri.text}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {(n(q.confidence) * 100).toFixed(2)}%
                      </td>

                      {/* Current Ratio */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MiniBar val={cr} min={0} max={4} color={crColor} />
                          <div>
                            <div className="flex items-center">
                              <span
                                className="font-medium"
                                style={{ color: crColor }}
                              >
                                {cr.toFixed(2)}
                              </span>
                              <QoQIndicator
                                current={cr}
                                previous={pCr}
                                higherIsBetter={true}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {BENCHMARKS.current_ratio.label}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* D/E Ratio */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MiniBar
                            val={Math.min(de, 3)}
                            min={0}
                            max={3}
                            color={deColor}
                          />
                          <div>
                            <div className="flex items-center">
                              <span
                                className="font-medium"
                                style={{ color: deColor }}
                              >
                                {de.toFixed(3)}
                              </span>
                              <QoQIndicator
                                current={de}
                                previous={pDe}
                                higherIsBetter={false}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {BENCHMARKS.debt_to_equity.label}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Op. Margin */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MiniBar
                            val={om * 100}
                            min={-10}
                            max={30}
                            color={omColor}
                          />
                          <div>
                            <div className="flex items-center gap-1">
                              {om > 0 ? (
                                <TrendingUp className="w-3 h-3 text-green-400" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-red-400" />
                              )}
                              <span
                                className="font-medium"
                                style={{ color: omColor }}
                              >
                                {(om * 100).toFixed(1)}%
                              </span>
                              <QoQIndicator
                                current={om}
                                previous={pOm}
                                higherIsBetter={true}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {BENCHMARKS.operating_margin.label}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* FCF */}
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span
                            className="font-medium"
                            style={{ color: fcfColor }}
                          >
                            ${fcf.toFixed(0)}M
                          </span>
                          <QoQIndicator
                            current={fcf}
                            previous={pFcf}
                            higherIsBetter={true}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {BENCHMARKS.free_cash_flow.label}
                        </p>
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
          ticker="EPAM"
          riskLabel={latest?.risk_label ?? "low_risk"}
        />
      </div>
    </Layout>
  );
}
