'use client';

import { useState, useEffect } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { loadWeightData, addWeightEntry, deleteWeightEntry } from '@/utils/storage';
import { WeightEntry } from '@/types';

interface PastDataInputProps {
  onSave: () => void;
}

interface DayInput {
  morning: string;
  evening: string;
}

export default function PastDataInput({ onSave }: PastDataInputProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [days, setDays] = useState<Record<number, DayInput>>({});
  // 기록이 존재하는 날짜 (기분·메모만 있는 날짜도 삭제할 수 있도록 별도 추적)
  const [hasEntry, setHasEntry] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const monthLabel = format(new Date(year, month - 1), 'yyyy년 M월', { locale: ko });

  // 월이 바뀌면 기존 데이터 로드
  useEffect(() => {
    const data = loadWeightData();
    const initialDays: Record<number, DayInput> = {};
    const initialHasEntry: Record<number, boolean> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const existing = data.entries.find(e => e.date === dateStr);
      initialDays[d] = {
        morning: existing?.morning != null ? String(existing.morning) : '',
        evening: existing?.evening != null ? String(existing.evening) : '',
      };
      initialHasEntry[d] = existing != null;
    }
    setDays(initialDays);
    setHasEntry(initialHasEntry);
    setSaved(false);
  }, [year, month, daysInMonth]);

  const handleChange = (day: number, field: 'morning' | 'evening', value: string) => {
    setDays(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
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
    const nextHasEntry: Record<number, boolean> = { ...hasEntry };

    for (let d = 1; d <= daysInMonth; d++) {
      const input = days[d];
      if (!input) continue;
      const morning = input.morning ? parseFloat(input.morning) : null;
      const evening = input.evening ? parseFloat(input.evening) : null;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // 아침·저녁을 모두 비우고 저장하면 그 날짜 기록을 삭제
      if (morning === null && evening === null) {
        if (hasEntry[d]) {
          deleteWeightEntry(dateStr);
          nextHasEntry[d] = false;
        }
        continue;
      }

      const entry: WeightEntry = { date: dateStr, morning, evening };
      addWeightEntry(entry);
      nextHasEntry[d] = true;
    }

    setHasEntry(nextHasEntry);
    setSaved(true);
    onSave();
  };

  const handleDelete = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    deleteWeightEntry(dateStr);
    setDays(prev => ({ ...prev, [day]: { morning: '', evening: '' } }));
    setHasEntry(prev => ({ ...prev, [day]: false }));
    setSaved(false);
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
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-pink-100">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg hover:bg-pink-50 text-pink-500"
        >
          ◀
        </button>
        <h3 className="text-lg font-bold text-pink-700">{monthLabel}</h3>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-pink-50 text-pink-500"
        >
          ▶
        </button>
      </div>

      {/* 안내 */}
      <p className="mb-2 text-[11px] sm:text-xs text-pink-400 text-center">
        잘못 입력한 날짜는 🗑을 누르거나, 아침·저녁을 모두 비우고 저장하면 지워져요.
      </p>

      {/* 테이블 헤더 */}
      <div className="grid grid-cols-[60px_1fr_1fr_36px] gap-1 mb-2 text-center text-xs sm:text-sm font-semibold text-pink-500">
        <div>날짜</div>
        <div>아침 (kg)</div>
        <div>저녁 (kg)</div>
        <div></div>
      </div>

      {/* 일별 입력 */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const canDelete =
            hasEntry[day] || !!days[day]?.morning || !!days[day]?.evening;
          return (
          <div
            key={day}
            className={`grid grid-cols-[60px_1fr_1fr_36px] gap-1 items-center ${
              isWeekend(day) ? 'bg-pink-50' : ''
            } rounded px-1 py-0.5`}
          >
            <div className={`text-xs sm:text-sm font-medium text-center ${
              isWeekend(day) ? 'text-rose-400' : 'text-pink-600'
            }`}>
              {day}일 {getDayOfWeek(day)}
            </div>
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              placeholder="-"
              value={days[day]?.morning ?? ''}
              onChange={e => handleChange(day, 'morning', e.target.value)}
              className="w-full px-2 py-1.5 text-sm text-center border border-pink-200 rounded-lg bg-white text-pink-700 focus:ring-2 focus:ring-pink-300 focus:outline-none"
            />
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              placeholder="-"
              value={days[day]?.evening ?? ''}
              onChange={e => handleChange(day, 'evening', e.target.value)}
              className="w-full px-2 py-1.5 text-sm text-center border border-pink-200 rounded-lg bg-white text-pink-700 focus:ring-2 focus:ring-pink-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleDelete(day)}
              disabled={!canDelete}
              aria-label={`${day}일 기록 삭제`}
              title="이 날짜 기록 삭제"
              className="text-sm text-rose-400 hover:text-rose-600 disabled:text-gray-200 disabled:cursor-not-allowed"
            >
              🗑
            </button>
          </div>
          );
        })}
      </div>

      {/* 저장 버튼 */}
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-emerald-500">저장 완료!</span>
        )}
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 font-medium text-sm"
        >
          저장
        </button>
      </div>
    </div>
  );
}
