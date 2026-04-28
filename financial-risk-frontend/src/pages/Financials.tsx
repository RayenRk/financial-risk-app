import { useEffect, useState } from "react";
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
  Legend,
} from "recharts";
import Layout from "../components/Layout.tsx";
import api from "../api/axios.ts";

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
}

const n = (val: unknown): number => parseFloat(String(val ?? 0)) || 0;
const pct = (val: unknown) => `${(n(val) * 100).toFixed(1)}%`;
const usd = (val: unknown) => `$${n(val).toFixed(0)}M`;
const fmt = (date: string) => date?.split("T")[0]?.slice(0, 7) ?? "";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 8,
  },
  labelStyle: { color: "#fff" },
};

const SECTION = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
    <h3 className="text-white font-semibold mb-0.5">{title}</h3>
    <p className="text-gray-500 text-xs mb-5">{subtitle}</p>
    {children}
  </div>
);

export default function Financials() {
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/quarters")
      .then((res) => setQuarters(res.data.quarters ?? []))
      .catch(() => setError("Failed to load financial data."))
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

  // Chart datasets
  const incomeData = quarters.map((q) => ({
    date: fmt(q.quarter_date),
    revenue: n(q.revenue),
    gross: n(q.gross_profit),
    operating: n(q.operating_income),
    net: n(q.net_income),
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

  const ratioData = quarters.map((q) => ({
    date: fmt(q.quarter_date),
    current: +n(q.current_ratio).toFixed(2),
    de: +n(q.debt_to_equity).toFixed(2),
    roe: +(n(q.roe) * 100).toFixed(2),
    roa: +(n(q.roa) * 100).toFixed(2),
  }));

  // Summary cards
  const summaryCards = [
    { label: "Revenue", value: usd(latest?.revenue), sub: "Latest quarter" },
    {
      label: "Gross Profit",
      value: usd(latest?.gross_profit),
      sub: `Margin: ${pct(latest?.gross_margin)}`,
    },
    {
      label: "Operating Income",
      value: usd(latest?.operating_income),
      sub: `Margin: ${pct(latest?.operating_margin)}`,
    },
    {
      label: "Net Income",
      value: usd(latest?.net_income),
      sub: `Margin: ${pct(latest?.net_margin)}`,
    },
    {
      label: "Free Cash Flow",
      value: usd(latest?.free_cash_flow),
      sub: "Latest quarter",
    },
    {
      label: "Cash on Hand",
      value: usd(latest?.cash),
      sub: `Debt: ${usd(latest?.total_debt)}`,
    },
    {
      label: "Current Ratio",
      value: n(latest?.current_ratio).toFixed(2),
      sub: "Liquidity",
    },
    {
      label: "Debt / Equity",
      value: n(latest?.debt_to_equity).toFixed(3),
      sub: "Leverage",
    },
  ];

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Financials</h1>
          <p className="text-gray-400 mt-1">
            EPAM Systems — {quarters.length} quarters ·{" "}
            {fmt(quarters[0]?.quarter_date)} to {fmt(latest?.quarter_date)}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4"
            >
              <p className="text-gray-400 text-xs mb-2">{card.label}</p>
              <p className="text-xl font-bold text-white">{card.value}</p>
              <p className="text-gray-500 text-xs mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Income statement chart */}
        <SECTION
          title="Income Statement"
          subtitle="Revenue, gross profit, operating income, net income — $M"
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={incomeData}>
              <defs>
                {[
                  ["revGrad", "#3b82f6"],
                  ["grossGrad", "#8b5cf6"],
                  ["opGrad", "#f59e0b"],
                  ["netGrad", "#22c55e"],
                ].map(([id, color]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="M" />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v: number) => [`$${v}M`]}
              />
              <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                fill="url(#revGrad)"
                strokeWidth={2}
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="gross"
                stroke="#8b5cf6"
                fill="url(#grossGrad)"
                strokeWidth={2}
                name="Gross Profit"
              />
              <Area
                type="monotone"
                dataKey="operating"
                stroke="#f59e0b"
                fill="url(#opGrad)"
                strokeWidth={2}
                name="Operating Income"
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#22c55e"
                fill="url(#netGrad)"
                strokeWidth={2}
                name="Net Income"
              />
            </AreaChart>
          </ResponsiveContainer>
        </SECTION>

        {/* Margins chart */}
        <SECTION
          title="Profit Margins"
          subtitle="Gross, operating, and net margin — percentage"
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={marginData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="%" />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v: number) => [`${v}%`]}
              />
              <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="gross"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Gross Margin"
              />
              <Line
                type="monotone"
                dataKey="operating"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Operating Margin"
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Net Margin"
              />
            </LineChart>
          </ResponsiveContainer>
        </SECTION>

        {/* Cash flow chart */}
        <SECTION
          title="Cash Flow & Debt"
          subtitle="Free cash flow, cash on hand, total debt — $M"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cashData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="M" />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v: number) => [`$${v}M`]}
              />
              <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
              <Bar
                dataKey="fcf"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                name="Free Cash Flow"
              />
              <Bar
                dataKey="cash"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                name="Cash on Hand"
              />
              <Bar
                dataKey="debt"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name="Total Debt"
              />
            </BarChart>
          </ResponsiveContainer>
        </SECTION>

        {/* Ratios chart */}
        <SECTION
          title="Key Ratios"
          subtitle="Current ratio, debt-to-equity, ROE, ROA"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liquidity & leverage */}
            <div>
              <p className="text-gray-400 text-xs mb-3">Liquidity & Leverage</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ratioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Current Ratio"
                  />
                  <Line
                    type="monotone"
                    dataKey="de"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="D/E Ratio"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Profitability */}
            <div>
              <p className="text-gray-400 text-xs mb-3">Profitability (%)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ratioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} unit="%" />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v}%`]}
                  />
                  <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="roe"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="ROE"
                  />
                  <Line
                    type="monotone"
                    dataKey="roa"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="ROA"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SECTION>

        {/* Data table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Quarterly Data Table</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              All financial figures in $M
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    "Quarter",
                    "Revenue",
                    "Gross Profit",
                    "Op. Income",
                    "Net Income",
                    "FCF",
                    "Cash",
                    "Debt",
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
                {[...quarters].reverse().map((q, i) => (
                  <tr
                    key={q.id}
                    className={`border-b border-gray-800/50 ${i % 2 === 0 ? "bg-gray-800/20" : ""}`}
                  >
                    <td className="px-4 py-3 text-gray-300 font-medium">
                      {fmt(q.quarter_date)}
                    </td>
                    <td className="px-4 py-3 text-white">{usd(q.revenue)}</td>
                    <td className="px-4 py-3 text-purple-400">
                      {usd(q.gross_profit)}
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
                    <td className="px-4 py-3 text-gray-300">{usd(q.cash)}</td>
                    <td className="px-4 py-3 text-red-400">
                      {usd(q.total_debt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
