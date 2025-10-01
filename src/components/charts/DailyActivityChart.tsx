"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DailyActivityChartProps {
  data: Array<{ date: string; count: number }>;
}

export function DailyActivityChart({ data }: DailyActivityChartProps) {
  const hasData = data.some((item) => item.count > 0);

  // Format data for chart - only last 30 days
  const chartData = data.slice(-30).map((day) => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    plays: day.count
  }));

  return (
    <div className="mb-12">
      <h3 className="text-white font-bold uppercase text-lg mb-4">Daily Activity (Last 30 Days)</h3>
      {!hasData ? (
        <p className="text-sm text-slate-400">No listening data available for this period.</p>
      ) : (
        <div className="h-64 bg-[rgba(145,162,186,0.05)] rounded-lg p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#90e0ef" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#90e0ef" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                stroke="#91a2ba"
                fontSize={11}
                tick={{ fill: '#91a2ba' }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                stroke="#91a2ba"
                fontSize={11}
                tick={{ fill: '#91a2ba' }}
              />
              <Tooltip
                formatter={(value: number) => [`${value} scrobbles`, ""]}
                contentStyle={{
                  background: '#1b263b',
                  borderRadius: 8,
                  borderColor: 'rgba(144,224,239,0.3)',
                  color: '#fff'
                }}
              />
              <Area
                type="monotone"
                dataKey="plays"
                stroke="#90e0ef"
                strokeWidth={2}
                fill="url(#activityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
