'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MonthlySleepCalendar from '@/components/MonthlySleepCalendar';
import { loadSleepData, syncFromSupabase } from '@/utils/sleepStorage';

export default function SleepDashboardPage() {
  const [data, setData] = useState(loadSleepData());

  useEffect(() => {
    syncFromSupabase().then(synced => setData(synced));
  }, []);

  // 가장 최근 기록과 목표 대비 안내
  const latestEntry = data.entries.length > 0
    ? data.entries[data.entries.length - 1]
    : null;
  const latestHours = latestEntry?.hours ?? null;
  const diff = latestHours != null
    ? Math.round((latestHours - data.settings.goalHours) * 10) / 10
    : null;

  return (
    <div className="min-h-screen bg-white py-4 px-2 sm:py-6 sm:px-4">
      <div className="max-w-lg mx-auto">
        {/* 앱 선택으로 돌아가기 */}
        <Link href="/" className="inline-block mb-2 text-indigo-400 hover:text-indigo-600 text-sm px-2">
          ← 앱 선택
        </Link>

        {/* 상단 안내 */}
        <div className="flex items-center gap-2 mb-4 px-2">
          <span className="text-2xl">🌙</span>
          {latestHours != null ? (
            <p className="text-sm text-indigo-600 font-medium">
              최근 수면 <span className="font-bold text-indigo-700">{latestHours}시간</span>
              {diff != null && diff !== 0 && (
                <> · 목표보다 {diff > 0 ? `${diff}시간 더` : `${Math.abs(diff)}시간 덜`} 잤어요</>
              )}
            </p>
          ) : (
            <p className="text-sm text-indigo-600 font-medium">오늘의 수면시간을 기록해보세요!</p>
          )}
        </div>

        {/* 달력 */}
        <MonthlySleepCalendar entries={data.entries} />

        {/* 하단 버튼 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/sleep/input" className="text-center px-4 py-3 bg-indigo-400 text-white rounded-xl hover:bg-indigo-500 font-medium text-sm">
            수면 입력
          </Link>
          <Link href="/sleep/graph" className="text-center px-4 py-3 bg-indigo-400 text-white rounded-xl hover:bg-indigo-500 font-medium text-sm">
            그래프
          </Link>
          <Link href="/sleep/past-input" className="col-span-2 text-center px-4 py-3 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 font-medium text-sm">
            과거 수면 입력
          </Link>
          <Link href="/sleep/analysis" className="col-span-2 text-center px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium text-sm">
            AI 수면 분석 🌙
          </Link>
        </div>
      </div>
    </div>
  );
}
