'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { KEYWORDS, ALLOWED_LOCATIONS, CAREER_MIN, CAREER_MAX, CRITERIA_SUMMARY, CRITERIA_GROUPS } from '@job/criteria';

interface PostingRow {
  id: number;
  source_site: string;
  title: string;
  company: string;
  location: string | null;
  employment_type: string | null;
  career_text: string | null;
  perk_tags: string[] | null;
  jobplanet_rating: number | null;
  recommend_tier: 'strong' | 'normal' | 'excluded' | null;
  reason: string | null;
  url: string;
  first_seen_at: string;
}

interface CheckResult {
  matchedCount: number;
  newCount: number;
  notifiedCount: number;
  excludedCount: number;
  authFailures: string[];
  error?: string;
}

const SITE_LABEL: Record<string, string> = {
  saramin: '사람인',
  wanted: '원티드',
  jobkorea: '잡코리아',
  remember: '리멤버',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

function tierBadge(tier: PostingRow['recommend_tier']) {
  if (tier === 'strong') return { label: '🔥 강력추천', className: 'bg-red-100 text-red-700' };
  if (tier === 'normal') return { label: '👍 추천', className: 'bg-emerald-100 text-emerald-700' };
  return { label: '평점 정보 없음', className: 'bg-slate-100 text-slate-500' };
}

export default function JobPage() {
  const [postings, setPostings] = useState<PostingRow[]>([]);
  const [showExcluded, setShowExcluded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);

  const loadPostings = useCallback(async () => {
    const { data } = await supabase.from('job_postings').select('*').order('first_seen_at', { ascending: false }).limit(80);
    setPostings((data ?? []) as PostingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPostings();
  }, [loadPostings]);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/cron/job-check?manual=true');
      const result: CheckResult = await res.json();
      setLastCheck(result);
      await loadPostings();
    } catch {
      setLastCheck({ matchedCount: 0, newCount: 0, notifiedCount: 0, excludedCount: 0, authFailures: [], error: '확인 실패' });
    }
    setChecking(false);
  };

  const handleTestNtfy = async () => {
    setTestingSend(true);
    try {
      const res = await fetch('/api/job-test-ntfy');
      const result = await res.json();
      alert(result.sent ? '✅ 테스트 알림을 보냈어요! ntfy 앱을 확인하세요.' : '❌ 알림 전송에 실패했어요.');
    } catch {
      alert('❌ 알림 전송에 실패했어요.');
    }
    setTestingSend(false);
  };

  const visible = postings.filter((p) => showExcluded || p.recommend_tier !== 'excluded');
  const sorted = [...visible].sort((a, b) => {
    const rank = { strong: 0, normal: 1, null: 2, excluded: 3 } as const;
    const ra = rank[a.recommend_tier ?? 'null'];
    const rb = rank[b.recommend_tier ?? 'null'];
    if (ra !== rb) return ra - rb;
    return b.first_seen_at.localeCompare(a.first_seen_at);
  });
  const excludedCount = postings.filter((p) => p.recommend_tier === 'excluded').length;

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-emerald-500 text-sm mb-4 inline-block">
          ← 홈으로
        </Link>

        <h1 className="text-2xl font-bold text-gray-800 mb-1">💼 채용공고 알림</h1>
        <p className="text-gray-400 text-sm mb-6">사람인 · 원티드 · 잡코리아 · 리멤버에서 조건에 맞는 공고를 찾으면 알려드려요</p>

        <button
          onClick={handleManualCheck}
          disabled={checking}
          className="w-full rounded-xl py-3 px-4 bg-emerald-500 text-white font-bold text-base hover:bg-emerald-600 disabled:opacity-50 mb-3"
        >
          {checking ? '확인 중...' : '🔍 지금 확인하기'}
        </button>

        {lastCheck && (
          <div
            className={`rounded-xl p-4 mb-4 text-sm ${
              lastCheck.error
                ? 'bg-red-50 text-red-600'
                : lastCheck.notifiedCount > 0
                  ? 'bg-green-50 text-green-700'
                  : 'bg-gray-50 text-gray-600'
            }`}
          >
            {lastCheck.error
              ? `❌ ${lastCheck.error}`
              : lastCheck.notifiedCount > 0
                ? `🎉 조건에 맞는 새 공고 ${lastCheck.notifiedCount}건! 알림을 보냈어요.`
                : `✅ 변동 없음. 조건 일치 ${lastCheck.matchedCount}건 확인.`}
            {lastCheck.authFailures.length > 0 && (
              <p className="mt-1 text-amber-700">
                ⚠️ {lastCheck.authFailures.map((s) => SITE_LABEL[s] ?? s).join(', ')} 인증/세션 확인 필요
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 mb-6 text-sm">
          <p className="font-bold text-emerald-700 mb-1">📱 알림 받기</p>
          <p className="text-emerald-600 mb-3">
            ntfy 앱 설치 후 <code className="bg-emerald-100 px-1.5 py-0.5 rounded text-xs font-mono">job-alert-yoni</code> 토픽을 구독하세요.
          </p>
          <button
            onClick={handleTestNtfy}
            disabled={testingSend}
            className="w-full rounded-lg py-2 px-3 bg-emerald-200 text-emerald-800 font-medium text-sm hover:bg-emerald-300 disabled:opacity-50"
          >
            {testingSend ? '전송 중...' : '🔔 테스트 알림 보내기'}
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-6 text-xs text-slate-500">
          <p className="font-bold text-slate-600 mb-1">필터 기준</p>
          <p>
            직무: {KEYWORDS.join(', ')} · 지역: {ALLOWED_LOCATIONS.join(', ')} · 정규직만 · 경력 {CAREER_MIN}~{CAREER_MAX}년
          </p>
          <p className="mt-1">잡플래닛 2점 미만은 알림에서 제외돼요.</p>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-700">📋 최근 공고 ({sorted.length}건)</h2>
          {excludedCount > 0 && (
            <button onClick={() => setShowExcluded((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600">
              {showExcluded ? '제외된 공고 숨기기' : `제외된 공고 보기 (${excludedCount})`}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">불러오는 중...</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">💼</p>
            <p>아직 조건에 맞는 공고가 없어요</p>
            <p className="text-xs mt-1">위 버튼으로 직접 확인해보세요</p>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {sorted.map((p) => {
              const badge = tierBadge(p.recommend_tier);
              return (
                <a
                  key={`${p.source_site}_${p.id}`}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block rounded-xl border shadow-sm p-4 hover:shadow-md ${
                    p.recommend_tier === 'excluded' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-emerald-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-800">{p.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.company} · {SITE_LABEL[p.source_site] ?? p.source_site}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>{badge.label}</span>
                  </div>
                  {p.reason && <p className="text-xs text-slate-500 mt-2">{p.reason}</p>}
                  <p className="text-[10px] text-gray-300 mt-2">{timeAgo(p.first_seen_at)}</p>
                </a>
              );
            })}
          </div>
        )}

        <div className="rounded-xl bg-slate-900 p-5 mb-4 text-sm">
          <p className="text-white leading-relaxed">{CRITERIA_SUMMARY}</p>
        </div>

        {CRITERIA_GROUPS.map((group) => (
          <div key={group.id} className="mb-3">
            <p className="text-xs font-bold text-slate-500">{group.title} · {group.subtitle}</p>
            <ul className="mt-1 space-y-0.5">
              {group.items.map((item) => (
                <li key={item.mark} className="text-xs text-slate-400">
                  {item.mark} {item.title}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="text-[10px] text-gray-300 text-center mt-6">GitHub Actions 하루 2번(오전 11시·오후 3시) 자동 체크 · ntfy 푸시 알림</p>
      </div>
    </div>
  );
}
