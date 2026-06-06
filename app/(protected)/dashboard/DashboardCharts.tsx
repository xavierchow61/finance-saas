"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fmtMoney } from "@/lib/finance";

const COLORS = [
  "#00A6E0",
  "#7DD3FC",
  "#FFC700",
  "#E60012",
  "#34D399",
  "#A78BFA",
  "#FB923C",
  "#F472B6",
  "#60A5FA",
  "#FBBF24",
  "#4ADE80",
  "#94A3B8",
];

export function ExpensePie({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="text-slate-400 text-sm text-center py-16">
        本月尚無支出資料
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
          label={(p: { name?: string; percent?: number }) =>
            (p.percent ?? 0) > 0.05
              ? `${p.name} ${(((p.percent ?? 0) * 100)).toFixed(0)}%`
              : ""
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => fmtMoney(Number(v))}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ExpenseTrend({
  data,
}: {
  data: { month: string; amount: number }[];
}) {
  const hasData = data.some((d) => d.amount > 0);
  if (!hasData) {
    return (
      <div className="text-slate-400 text-sm text-center py-16">
        尚無支出走勢資料
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickFormatter={(m: string) => m.slice(5)} // 只顯示月份
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />
        <Tooltip
          formatter={(v) => fmtMoney(Number(v))}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        />
        <Legend />
        <Bar
          dataKey="amount"
          name="月支出"
          fill="#00A6E0"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
