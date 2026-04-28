import { useEffect, useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
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
} from "lucide-react";
import Layout from "../components/Layout.tsx";
import api from "../api/axios.ts";

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
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 8,
    color: "#f9fafb",
  },
  labelStyle: { color: "#f9fafb" },
  itemStyle: { color: "#93c5fd" },
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
  const info = riskInfo(selected?.risk_label ?? "");
  const Icon = info.Icon;

  // Probability bar data for selected quarter
  const probData = selected
    ? [
        {
          name: "Low Risk",
          value: +(n(selected.prob_low_risk) * 100).toFixed(1),
          color: "#22c55e",
        },
        {
          name: "Medium Risk",
          value: +(n(selected.prob_medium_risk) * 100).toFixed(1),
          color: "#f59e0b",
        },
        {
          name: "High Risk",
          value: +(n(selected.prob_high_risk) * 100).toFixed(1),
          color: "#ef4444",
        },
      ]
    : [];

  // SHAP importance for selected quarter
  const shapData = (selected?.top_risk_drivers ?? []).map((d) => ({
    feature: featureLabel(d.feature),
    importance: +d.importance.toFixed(4),
  }));

  // Radar data — financial health indicators for selected quarter
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

  // Risk timeline
  const timelineData = quarters.map((q) => ({
    date: fmt(q.quarter_date),
    confidence: +(n(q.confidence) * 100).toFixed(1),
    label: q.risk_label,
    color: q.risk_color,
  }));

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Risk Analysis</h1>
            <p className="text-gray-400 mt-1">
              EPAM Systems — ML-powered financial risk detection
            </p>
          </div>
          {/* Current risk */}
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
                Confidence: {(n(latest?.confidence) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Quarter selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-3 uppercase tracking-wider font-medium">
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
                    borderColor: isSelected ? ri.color : "#374151",
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
              <p className="text-white font-bold text-lg">{info.text}</p>
              <p className="text-gray-400 text-sm">
                Quarter: {fmt(selected.quarter_date)} · Confidence:{" "}
                {(n(selected.confidence) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-gray-400 text-xs">High Risk Prob.</p>
                <p className="text-red-400 font-bold">
                  {(n(selected.prob_high_risk) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Medium Risk Prob.</p>
                <p className="text-yellow-400 font-bold">
                  {(n(selected.prob_medium_risk) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Low Risk Prob.</p>
                <p className="text-green-400 font-bold">
                  {(n(selected.prob_low_risk) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Probability bars */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-0.5">
              Risk Probabilities
            </h3>
            <p className="text-gray-500 text-xs mb-5">
              Model output for {fmt(selected?.quarter_date ?? "")}
            </p>
            <ResponsiveContainer width="100%" height={200}>
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
                  width={90}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v}%`]}
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-0.5">
              Top Risk Drivers
            </h3>
            <p className="text-gray-500 text-xs mb-5">
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
                  <div className="w-full bg-gray-800 rounded-full h-2">
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-0.5">
              Financial Health Radar
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              Normalised score (0–100) — {fmt(selected?.quarter_date ?? "")}
            </p>
            <ResponsiveContainer width="100%" height={240}>
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

          {/* Risk confidence timeline */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-0.5">
              Confidence Timeline
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              Model confidence per quarter (%)
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  unit="%"
                  domain={[90, 100]}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number, _: string, props: any) => [
                    `${v}% (${riskInfo(props.payload.label).text})`,
                    "Confidence",
                  ]}
                />
                <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
                  {timelineData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key indicators table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Risk Indicator Summary</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Thresholds used by the model
            </p>
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
                  const ri = riskInfo(q.risk_label);
                  return (
                    <tr
                      key={q.id}
                      className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                        selected?.id === q.id
                          ? "bg-blue-600/10"
                          : i % 2 === 0
                            ? "bg-gray-800/20 hover:bg-gray-800/40"
                            : "hover:bg-gray-800/40"
                      }`}
                      onClick={() => setSelected(q)}
                    >
                      <td className="px-4 py-3 text-gray-300 font-medium">
                        {fmt(q.quarter_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: ri.color, background: ri.bg }}
                        >
                          {ri.text}
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
                        <div className="flex items-center gap-1">
                          {n(q.operating_margin) > 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                          <span
                            className={
                              n(q.operating_margin) > 0
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {(n(q.operating_margin) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            n(q.free_cash_flow) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          ${n(q.free_cash_flow).toFixed(0)}M
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
    </Layout>
  );
}
