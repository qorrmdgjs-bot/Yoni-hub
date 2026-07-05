'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addSleepEntry, updateSleepSettings, loadSleepData } from '@/utils/sleepStorage';
import { getToday } from '@/utils/dates';
import { SleepEntry } from '@/types';

export default function SleepInputPage() {
  const [date, setDate] = useState(getToday());
  const [hours, setHours] = useState('');
  const [goalHours, setGoalHours] = useState('');
  const [hasData, setHasData] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const data = loadSleepData();
    if (data.settings.goalHours) setGoalHours(data.settings.goalHours.toString());
    setHasData(data.entries.length > 0);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: SleepEntry = {
      date,
      hours: hours ? parseFloat(hours) : null,
    };
    addSleepEntry(entry);

    if (goalHours) updateSleepSettings({ goalHours: parseFloat(goalHours) });

    router.push('/sleep');
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700 mb-4">Well-Sleep 🌙</h1>
          <p className="text-indigo-400">오늘의 수면시간을 입력해주세요!</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-md space-y-4 border border-indigo-100">
          <div>
            <label className="block text-sm font-medium text-indigo-600 mb-2">
              날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border-indigo-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-400 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-indigo-600 mb-2">
              수면시간 (시간)
            </label>
            <input
              type="number"
              step="0.1"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="예: 7.5"
              className="w-full rounded-md border-indigo-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-400 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-indigo-600 mb-2">
              목표 수면시간 (시간)
            </label>
            <input
              type="number"
              step="0.5"
              value={goalHours}
              onChange={(e) => setGoalHours(e.target.value)}
              placeholder="예: 8"
              className="w-full rounded-md border-indigo-200 shadow-sm focus:border-indigo-400 focus:ring-indigo-400 px-3 py-2"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-400 text-white py-3 px-4 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-lg font-semibold"
          >
            저장하기
          </button>
        </form>

        {hasData && (
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/sleep" className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 text-sm">
              달력 보기
            </Link>
            <Link href="/sleep/past-input" className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 text-sm">
              과거 입력
            </Link>
            <Link href="/sleep/graph" className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 text-sm">
              그래프 보기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
