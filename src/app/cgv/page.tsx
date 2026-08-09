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
  seatsReset: number;
  error?: string;
}

const CGV_BOOKING_URL = 'https://cgv.co.kr/cnm/movieBook/movie';

function formatDate(d: string) {
  if (!d || d.length < 8) return d;
  const m = d.slice(4, 6);
  const day = d.slice(6, 8);
  const date = new Date(`${d.slice(0, 4)}-${m}-${day}`);
  if (isNaN(date.getTime())) return d;
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${Number(m)}/${Number(day)}(${days[date.getDay()]})`;
}

function formatTime(t: string) {
  if (!t || t.length < 4) return t;
  return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function CgvPage() {
  const [screenings, setScreenings] = useState<ScreeningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const loadScreenings = useCallback(async () => {
    const { data } = await supabase
      .from('cgv_screenings')
      .select('*')
      .order('screening_date', { ascending: true })
      .order('start_time', { ascending: true });
    setScreenings(data ?? []);

    if (data && data.length > 0) {
      const latest = data.reduce((a: ScreeningRow, b: ScreeningRow) =>
        a.first_seen_at > b.first_seen_at ? a : b
      );
      setLastCheckedAt(latest.first_seen_at);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadScreenings(); }, [loadScreenings]);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/cron/cgv-check?manual=true');
      const result: CheckResult = await res.json();
      setLastCheck(result);
      setLastCheckedAt(new Date().toISOString());
      await loadScreenings();
    } catch {
      setLastCheck({ checked: 0, found: 0, newDates: 0, seatsAlerts: 0, seatsReset: 0, error: '확인 실패' });
    }
    setChecking(false);
  };

  const handleTestNtfy = async () => {
    setTestingSend(true);
    try {
      const res = await fetch('/api/cgv-test-ntfy');
      const result = await res.json();
      alert(result.sent ? '✅ 테스트 알림을 보냈어요! ntfy 앱을 확인하세요.' : '❌ 알림 전송에 실패했어요.');
    } catch {
      alert('❌ 알림 전송에 실패했어요.');
    }
    setTestingSend(false);
  };

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const upcoming = screenings.filter((s) => s.screening_date >= today);
  const past = screenings.filter((s) => s.screening_date < today);

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-amber-500 text-sm mb-4 inline-block">← 홈으로</Link>

        <h1 className="text-2xl font-bold text-gray-800 mb-1">🎬 CGV IMAX 모니터</h1>
        <p className="text-gray-400 text-sm mb-1">오디세이 · 용산아이파크몰 IMAX</p>
        {lastCheckedAt && (
          <p className="text-xs text-gray-300 mb-6">마지막 확인: {timeAgo(lastCheckedAt)}</p>
        )}
        {!lastCheckedAt && <div className="mb-6" />}

        <button onClick={handleManualCheck} disabled={checking}
          className="w-full rounded-xl py-3 px-4 bg-amber-500 text-white font-bold text-base hover:bg-amber-600 disabled:opacity-50 mb-3">
          {checking ? '확인 중...' : '🔍 지금 확인하기'}
        </button>

        <a href={CGV_BOOKING_URL} target="_blank" rel="noopener noreferrer"
          className="block w-full rounded-xl py-3 px-4 bg-red-600 text-white font-bold text-base text-center hover:bg-red-700 mb-4">
          🎟️ CGV 예매 바로가기
        </a>

        {lastCheck && (
          <div className={`rounded-xl p-4 mb-4 text-sm ${
            lastCheck.error ? 'bg-red-50 text-red-600'
            : (lastCheck.newDates > 0 || lastCheck.seatsAlerts > 0) ? 'bg-green-50 text-green-700'
            : 'bg-gray-50 text-gray-600'
          }`}>
            {lastCheck.error
              ? `❌ ${lastCheck.error}`
              : lastCheck.newDates > 0 && lastCheck.seatsAlerts > 0
                ? `🎉 새 상영 ${lastCheck.newDates}건 + 8석 확보 ${lastCheck.seatsAlerts}건 발견!`
                : lastCheck.newDates > 0
                  ? `🎉 새 상영 ${lastCheck.newDates}건 발견! 알림을 보냈어요.`
                  : lastCheck.seatsAlerts > 0
                    ? `🎟️ 8석 이상 확보 ${lastCheck.seatsAlerts}건! 알림을 보냈어요.`
                    : `✅ 변동 없음. ${lastCheck.found}건 확인 완료.`
            }
          </div>
        )}

        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 mb-6 text-sm">
          <p className="font-bold text-amber-700 mb-1">📱 알림 받기</p>
          <p className="text-amber-600 mb-3">
            ntfy 앱 설치 후 <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">cgv-imax-odyssey</code> 토픽을 구독하세요.
          </p>
          <button onClick={handleTestNtfy} disabled={testingSend}
            className="w-full rounded-lg py-2 px-3 bg-amber-200 text-amber-800 font-medium text-sm hover:bg-amber-300 disabled:opacity-50">
            {testingSend ? '전송 중...' : '🔔 테스트 알림 보내기'}
          </button>
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
              <div key={`${s.screening_date}_${s.start_time}_${s.screen_name}`}
                className="rounded-xl bg-white border border-amber-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">
                      {formatDate(s.screening_date)} {formatTime(s.start_time)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.screen_name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${s.free_seats > 50 ? 'text-green-600' : s.free_seats > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                      {s.free_seats > 0 ? `${s.free_seats}석` : '매진'}
                    </p>
                    <p className="text-[10px] text-gray-300">/ {s.total_seats}</p>
                  </div>
                </div>
                <a href={CGV_BOOKING_URL} target="_blank" rel="noopener noreferrer"
                  className="block mt-2 text-center text-xs text-red-500 font-medium hover:text-red-600">
                  예매하기 →
                </a>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-400 mb-2">지난 상영 ({past.length}건)</h2>
            <div className="space-y-1 mb-6 opacity-50">
              {past.slice(-5).map((s) => (
                <div key={`${s.screening_date}_${s.start_time}_${s.screen_name}`}
                  className="rounded-lg bg-gray-50 p-3 text-sm text-gray-400 flex justify-between">
                  <span>{formatDate(s.screening_date)} {formatTime(s.start_time)}</span>
                  <span>{s.screen_name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-[10px] text-gray-300 text-center mt-8">
          GitHub Actions 30분 자동 체크 · ntfy 푸시 알림
        </p>
      </div>
    </div>
  );
}
