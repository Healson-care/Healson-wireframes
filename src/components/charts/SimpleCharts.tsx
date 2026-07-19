"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartPoint {
  label: string;
  count: number;
}

const PIE_COLORS = ["#0d7d6f", "#c8973a", "#6366f1", "#e11d48", "#0ea5e9", "#a855f7"];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-700">{label ?? payload[0].name}</p>
      <p className="text-slate-500">{payload[0].value}</p>
    </div>
  );
}

export function BarChartSimple({ data, color = "#0d7d6f" }: { data: ChartPoint[]; color?: string }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChartSimple({ data, color = "#c8973a" }: { data: ChartPoint[]; color?: string }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1" }} />
          <Line
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieChartSimple({ data, colors = PIE_COLORS }: { data: ChartPoint[]; colors?: string[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
          />
          <Pie data={data} dataKey="count" nameKey="label" innerRadius={32} outerRadius={52} paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={entry.label} fill={colors[i % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
