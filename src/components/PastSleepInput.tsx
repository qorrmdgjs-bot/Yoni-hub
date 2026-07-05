'use client';

import { useState, useEffect } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { loadSleepData, addSleepEntry } from '@/utils/sleepStorage';
import { SleepEntry } from '@/types';

interface PastSleepInputProps {
  onSave: () => void;
}

export default function PastSleepInput({ onSave }: PastSleepInputProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [days, setDays] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const monthLabel = format(new Date(year, month - 1), 'yyyy년 M월', { locale: ko });

  // 월이 바뀌면 기존 데이터 로드
  useEffect(() => {
    const data = loadSleepData();
    const initialDays: Record<number, string> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const existing = data.entries.find(e => e.date === dateStr);
      initialDays[d] = existing?.hours != null ? String(existing.hours) : '';
    }
    setDays(initialDays);
    setSaved(false);
  }, [year, month, daysInMonth]);

  const handleChange = (day: number, value: string) => {
    setDays(prev => ({ ...prev, [day]: value }));
    setSaved(false);
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleSave = () => {
    for (let d = 1; d <= daysInMonth; d++) {
      const value = days[d];
      if (value == null || value === '') continue;
      const hours = parseFloat(value);
      if (Number.isNaN(hours)) continue;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry: SleepEntry = { date: dateStr, hours };
      addSleepEntry(entry);
    }
    setSaved(true);
    onSave();
  };

  const getDayOfWeek = (day: number) => {
    const date = new Date(year, month - 1, day);
    return format(date, 'EEE', { locale: ko });
  };

  const isWeekend = (day: number) => {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    return dow === 0 || dow === 6;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-indigo-100">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-500"
        >
          ◀
        </button>
        <h3 className="text-lg font-bold text-indigo-700">{monthLabel}</h3>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-500"
        >
          ▶
        </button>
      </div>

      {/* 테이블 헤더 */}
      <div className="grid grid-cols-[80px_1fr] gap-1 mb-2 text-center text-xs sm:text-sm font-semibold text-indigo-500">
        <div>날짜</div>
        <div>수면시간 (시간)</div>
      </div>

      {/* 일별 입력 */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
          <div
            key={day}
            className={`grid grid-cols-[80px_1fr] gap-1 items-center ${
              isWeekend(day) ? 'bg-indigo-50' : ''
            } rounded px-1 py-0.5`}
          >
            <div className={`text-xs sm:text-sm font-medium text-center ${
              isWeekend(day) ? 'text-rose-400' : 'text-indigo-600'
            }`}>
              {day}일 {getDayOfWeek(day)}
            </div>
            <input
              type="number"
              step="0.1"
              min="0"
              max="24"
              placeholder="-"
              value={days[day] ?? ''}
              onChange={e => handleChange(day, e.target.value)}
              className="w-full px-2 py-1.5 text-sm text-center border border-indigo-200 rounded-lg bg-white text-indigo-700 focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {/* 저장 버튼 */}
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-emerald-500">저장 완료!</span>
        )}
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-indigo-400 text-white rounded-lg hover:bg-indigo-500 font-medium text-sm"
        >
          저장
        </button>
      </div>
    </div>
  );
}
