'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface ScreeningRow {
  id: number;
  screening_date: string;
  start_time: string;
  screen_name: string;
  movie_name: string;
  total_seats: number;
  free_seats: number;
  first_seen_at: string;
  notified: boolean;
}

interface CheckResult {
  checked: number;
  found: number;
  newDates: number;
  seatsAlerts: number;
  error?: string;
}

function formatDate(d: string) {
  const m = d.slice(4, 6);
  const day = d.slice(6, 8);
  const date = new Date(`${d.slice(0, 4)}-${m}-${day}`);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${Number(m)}/${Number(day)}(${days[date.getDay()]})`;
}

function formatTime(t: string) {
  return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

export default function CgvPage() {
  const [screenings, setScreenings] = useState<ScreeningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);

  const loadScreenings = useCallback(async () => {
    const { data } = await supabase
      .from('cgv_screenings')
      .select('*')
      .order('screening_date', { ascending: true })
      .order('start_time', { ascending: true });
    setScreenings(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadScreenings(); }, [loadScreenings]);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/cron/cgv-check');
      const result: CheckResult = await res.json();
      setLastCheck(result);
      await loadScreenings();
    } catch {
      setLastCheck({ checked: 0, found: 0, newDates: 0, seatsAlerts: 0, error: '확인 실패' });
    }
    setChecking(false);
  };

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const upcoming = screenings.filter((s) => s.screening_date >= today);
  const past = screenings.filter((s) => s.screening_date < today);

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-amber-500 text-sm mb-4 inline-block">← 홈으로</Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">🎬 CGV IMAX 모니터</h1>
        <p className="text-gray-400 text-sm mb-6">오디세이 · 용산아이파크몰 IMAX</p>

        <button onClick={handleManualCheck} disabled={checking}
          className="w-full rounded-xl py-3 px-4 bg-amber-500 text-white font-bold text-base hover:bg-amber-600 disabled:opacity-50 mb-4">
          {checking ? '확인 중...' : '🔍 지금 확인하기'}
        </button>

        {lastCheck && (
          <div className={`rounded-xl p-4 mb-4 text-sm ${lastCheck.error ? 'bg-red-50 text-red-600' : lastCheck.newDates > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
            {lastCheck.error ? `❌ ${lastCheck.error}`
              : lastCheck.newDates > 0 ? `🎉 새 상영 ${lastCheck.newDates}건 발견! 알림을 보냈어요.`
              : `✅ ${lastCheck.found}건 확인 완료. 새 상영은 없어요.`}
          </div>
        )}

        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 mb-6 text-sm">
          <p className="font-bold text-amber-700 mb-1">📱 알림 받기</p>
          <p className="text-amber-600">
            ntfy 앱 설치 후 <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">cgv-imax-odyssey</code> 토픽을 구독하세요.
          </p>
        </div>

        <h2 className="text-lg font-bold text-gray-700 mb-3">📅 예정된 상영 ({upcoming.length}건)</h2>

        {loading ? (
          <p className="text-gray-400 text-center py-8">불러오는 중...</p>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">🎬</p>
            <p>현재 확인된 IMAX 상영이 없어요</p>
            <p className="text-xs mt-1">위 버튼으로 직접 확인해보세요</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {upcoming.map((s) => (
              <div key={`${s.screening_date}_${s.start_time}`}
                className="rounded-xl bg-white border border-amber-100 shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800">{formatDate(s.screening_date)} {formatTime(s.start_time)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.screen_name}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${s.free_seats > 50 ? 'text-green-600' : s.free_seats > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                    {s.free_seats > 0 ? `${s.free_seats}석` : '매진'}
                  </p>
                  <p className="text-[10px] text-gray-300">/ {s.total_seats}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-400 mb-2">지난 상영 ({past.length}건)</h2>
            <div className="space-y-1 mb-6 opacity-50">
              {past.slice(-5).map((s) => (
                <div key={`${s.screening_date}_${s.start_time}`} className="rounded-lg bg-gray-50 p-3 text-sm text-gray-400 flex justify-between">
                  <span>{formatDate(s.screening_date)} {formatTime(s.start_time)}</span>
                  <span>{s.screen_name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
