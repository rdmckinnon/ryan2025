"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DayOfWeekChartProps {
  data: Array<{ day: number; count: number }>;
}

export function DayOfWeekChart({ data }: DayOfWeekChartProps) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Transform data for chart
  const chartData = days.map((dayName, index) => {
    const dayData = data.find((d) => d.day === index);
    return {
      day: dayName,
      plays: dayData?.count || 0
    };
  });

  const hasData = chartData.some((item) => item.plays > 0);

  return (
    <div className="mb-12">
      <h3 className="text-white font-bold uppercase text-lg mb-4">Listening by Day of Week</h3>
      {!hasData ? (
        <p className="text-sm text-slate-400">No listening data available.</p>
      ) : (
        <div className="h-64 bg-[rgba(145,162,186,0.05)] rounded-lg p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                stroke="#91a2ba"
                fontSize={12}
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
                formatter={(value: number) => [`${value} plays`, ""]}
                contentStyle={{
                  background: '#1b263b',
                  borderRadius: 8,
                  borderColor: 'rgba(144,224,239,0.3)',
                  color: '#fff'
                }}
                cursor={{ fill: 'rgba(144,224,239,0.1)' }}
              />
              <Bar
                dataKey="plays"
                fill="#90e0ef"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
