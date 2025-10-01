"use client";

import { useEffect, useState } from 'react';
import { DailyActivityChart } from './DailyActivityChart';
import { DayOfWeekChart } from './DayOfWeekChart';

interface ChartsData {
  listeningByDay: Array<{ date: string; count: number }>;
  listeningByDayOfWeek: Array<{ day: number; count: number }>;
  artistDiversity: { top10_plays: number; other_plays: number };
  listeningByDecade: Array<{ decade: string; count: number }>;
}

interface AllTimeData {
  totalScrobbles: number;
  oldestScrobble: number | null;
}

export function ChartsContainer() {
  const [data, setData] = useState<{ charts: ChartsData; allTime: AllTimeData } | null>(null);

  useEffect(() => {
    fetch('/api/listening-stats')
      .then(res => res.json())
      .then(result => setData(result))
      .catch(err => console.error('Failed to load charts:', err));
  }, []);

  if (!data) return null;

  const { charts, allTime } = data;

  return (
    <div>
      <h2 className="text-white font-black uppercase text-2xl mb-8">Listening Patterns</h2>

      {/* Daily Activity Chart */}
      {charts.listeningByDay && charts.listeningByDay.length > 0 && (
        <DailyActivityChart data={charts.listeningByDay} />
      )}

      {/* Artist Diversity Pie */}
      {charts.artistDiversity && (
        <div className="mb-12">
          <h3 className="text-white font-bold uppercase text-lg mb-4">Artist Diversity</h3>
          <div className="flex items-center justify-center gap-12 flex-wrap py-8">
            <div
              className="w-48 h-48 rounded-full relative"
              style={{
                background: `conic-gradient(#90e0ef 0% ${
                  ((charts.artistDiversity.top10_plays /
                    (charts.artistDiversity.top10_plays + charts.artistDiversity.other_plays)) *
                    100).toFixed(1)
                }%, #91a2ba ${
                  ((charts.artistDiversity.top10_plays /
                    (charts.artistDiversity.top10_plays + charts.artistDiversity.other_plays)) *
                    100).toFixed(1)
                }% 100%)`
              }}
            >
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1b263b] w-28 h-28 rounded-full flex flex-col items-center justify-center">
                <div className="text-3xl font-black text-[#90e0ef]">
                  {((charts.artistDiversity.top10_plays /
                    (charts.artistDiversity.top10_plays + charts.artistDiversity.other_plays)) *
                    100).toFixed(1)}%
                </div>
                <div className="text-xs text-[#91a2ba] uppercase mt-1">Top 10</div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-[#90e0ef]"></div>
                <div>
                  <div className="text-sm font-semibold text-[#e0e1dd]">Top 10 Artists</div>
                  <div className="text-xs text-[#91a2ba]">{charts.artistDiversity.top10_plays.toLocaleString()} plays</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-[#91a2ba]"></div>
                <div>
                  <div className="text-sm font-semibold text-[#e0e1dd]">All Other Artists</div>
                  <div className="text-xs text-[#91a2ba]">{charts.artistDiversity.other_plays.toLocaleString()} plays</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listening Journey */}
      {allTime.oldestScrobble && (
        <div className="mb-12">
          <h3 className="text-white font-bold uppercase text-lg mb-4">Listening Journey</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[rgba(144,224,239,0.05)] border border-[rgba(144,224,239,0.3)] rounded-xl p-6 text-center">
              <div className="text-5xl font-black text-[#90e0ef]">
                {Math.floor((Date.now() / 1000 - allTime.oldestScrobble) / 86400).toLocaleString()}
              </div>
              <div className="text-sm text-[#91a2ba] uppercase tracking-wider mt-2">Days Tracking</div>
            </div>
            <div className="bg-[rgba(144,224,239,0.05)] border border-[rgba(144,224,239,0.3)] rounded-xl p-6 text-center">
              <div className="text-5xl font-black text-[#90e0ef]">
                {((Date.now() / 1000 - allTime.oldestScrobble) / 86400 / 365).toFixed(1)}
              </div>
              <div className="text-sm text-[#91a2ba] uppercase tracking-wider mt-2">Years of Data</div>
            </div>
            <div className="bg-[rgba(144,224,239,0.05)] border border-[rgba(144,224,239,0.3)] rounded-xl p-6 text-center">
              <div className="text-5xl font-black text-[#90e0ef]">
                {Math.floor(allTime.totalScrobbles / Math.floor((Date.now() / 1000 - allTime.oldestScrobble) / 86400))}
              </div>
              <div className="text-sm text-[#91a2ba] uppercase tracking-wider mt-2">Avg Plays/Day</div>
            </div>
          </div>
        </div>
      )}

      {/* Day of Week Chart */}
      {charts.listeningByDayOfWeek && charts.listeningByDayOfWeek.length > 0 && (
        <DayOfWeekChart data={charts.listeningByDayOfWeek} />
      )}

      {/* Decade Chart */}
      {charts.listeningByDecade && charts.listeningByDecade.length > 0 && (
        <div className="mb-12">
          <h3 className="text-white font-bold uppercase text-lg mb-4">Listening by Era</h3>
          <div className="flex flex-col gap-4">
            {charts.listeningByDecade.map((decade) => {
              const maxCount = Math.max(...charts.listeningByDecade.map(d => d.count));
              const width = (decade.count / maxCount) * 100;
              return (
                <div key={decade.decade} className="flex items-center gap-4">
                  <div className="min-w-[100px] text-right text-sm font-semibold text-[#c5d0e4]">
                    {decade.decade}
                  </div>
                  <div className="flex-1 h-9 bg-[rgba(145,162,186,0.1)] rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#90e0ef] to-[#caf0f8] flex items-center justify-end px-4 transition-all duration-700"
                      style={{ width: `${width}%` }}
                    >
                      <span className="text-sm font-bold text-white whitespace-nowrap">
                        {decade.count.toLocaleString()} plays
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-slate-400 mt-4">* Based on when you listened (approximation)</div>
        </div>
      )}
    </div>
  );
}
