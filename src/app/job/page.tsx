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
  expires_at: string | null;
  starred: boolean;
  dismissed: boolean;
}

interface CheckResult {
  matchedCount: number;
  newCount: number;
  notifiedCount: number;
  excludedCount: number;
  expiredCount?: number;
  authFailures: string[];
  error?: string;
}

/** 한 회사 공고가 이 수를 넘으면 접어서 보여준다 (유닛블랙 10건처럼 목록을 잡아먹는 경우) */
const COLLAPSE_FROM = 3;
/** 수동 확인에 걸리는 대략적인 시간 — 진행률 표시용 기준값 */
const CHECK_ESTIMATE_SEC = 130;

const SITE_LABEL: Record<string, string> = {
  saramin: '사람인',
  wanted: '원티드',
  jobkorea: '잡코리아',
  remember: '리멤버',
};

const FILTER_TAGS = [
  ...KEYWORDS,
  ...ALLOWED_LOCATIONS,
  '정규직',
  `경력 ${CAREER_MIN}~${CAREER_MAX}년`,
  '상시채용 제외',
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

function tierLabel(tier: PostingRow['recommend_tier']) {
  if (tier === 'strong') return { label: '강력추천', className: 'text-red-600' };
  if (tier === 'normal') return { label: '추천', className: 'text-blue-600' };
  return { label: '평점 정보 없음', className: 'text-gray-400' };
}

function deadlineLabel(iso: string | null) {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return '마감';
  if (days === 0) return '오늘 마감';
  if (days <= 7) return `D-${days}`;
  return `~${new Date(iso).getMonth() + 1}/${new Date(iso).getDate()}`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`w-5 h-5 ${filled ? 'fill-amber-400 stroke-amber-400' : 'fill-none stroke-gray-300'}`}
      strokeWidth={1.5}
    >
      <path
        d="M10 2.5l2.36 4.78 5.27.77-3.82 3.72.9 5.25L10 14.6l-4.71 2.42.9-5.25-3.82-3.72 5.27-.77z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function JobPage() {
  const [postings, setPostings] = useState<PostingRow[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [viewTab, setViewTab] = useState<'all' | 'starred'>('all');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);

  // 확인은 2분 넘게 걸려서, 경과 시간이라도 보여주지 않으면 멈춘 줄 알게 된다.
  useEffect(() => {
    if (!checking) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [checking]);

  const loadPostings = useCallback(async () => {
    // 평점 없음·2점 미만을 숨기면서 실제로 보이는 건수가 줄어, 넉넉히 받아온다.
    const { data } = await supabase.from('job_postings').select('*').order('first_seen_at', { ascending: false }).limit(300);
    setPostings((data ?? []) as PostingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPostings();
  }, [loadPostings]);

  const handleManualCheck = async () => {
    setChecking(true);
    setElapsed(0);
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

  const toggleStar = async (p: PostingRow) => {
    const next = !p.starred;
    setPostings((prev) => prev.map((row) => (row.id === p.id ? { ...row, starred: next } : row)));
    await supabase.from('job_postings').update({ starred: next }).eq('id', p.id);
  };

  const toggleDismiss = async (p: PostingRow) => {
    const next = !p.dismissed;
    setPostings((prev) => prev.map((row) => (row.id === p.id ? { ...row, dismissed: next } : row)));
    await supabase.from('job_postings').update({ dismissed: next }).eq('id', p.id);
  };

  const toggleCompany = (company: string) =>
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });

  const byTier = (a: PostingRow, b: PostingRow) => {
    const rank = { strong: 0, normal: 1, null: 2, excluded: 3 } as const;
    const ra = rank[a.recommend_tier ?? 'null'];
    const rb = rank[b.recommend_tier ?? 'null'];
    if (ra !== rb) return ra - rb;
    return b.first_seen_at.localeCompare(a.first_seen_at);
  };

  const starredSorted = postings.filter((p) => p.starred).sort(byTier);
  // 평점이 확인된 공고만 기본으로 보여준다. 잡플래닛에 없는 회사(평점 없음), 2점 미만,
  // 그리고 직접 "관심없음"으로 접은 공고는 빼고, 토글로만 확인할 수 있게 한다.
  const isHidden = (p: PostingRow) => p.recommend_tier === 'excluded' || p.recommend_tier === null || p.dismissed;
  const visible = postings.filter((p) => showHidden || !isHidden(p));
  const sorted = [...visible].sort(byTier);
  const hiddenCount = postings.filter(isHidden).length;
  const listed = viewTab === 'starred' ? starredSorted : sorted;

  // 한 회사가 공고를 여러 개 올리면 목록을 독차지한다(유닛블랙 10건). 같은 회사가
  // COLLAPSE_FROM건 이상이면 첫 건만 남기고 접는다. 관심기업 탭은 접지 않는다 —
  // 직접 고른 것들이라 그대로 다 보이는 게 맞다.
  const rows: PostingRow[] = [];
  const collapsedExtra = new Map<number, number>(); // 대표 공고 id → 접힌 나머지 건수

  if (viewTab === 'starred') {
    rows.push(...listed);
  } else {
    const byCompany = new Map<string, PostingRow[]>();
    for (const p of listed) {
      const key = p.company || `__${p.id}`;
      byCompany.set(key, [...(byCompany.get(key) ?? []), p]);
    }
    const done = new Set<string>();
    for (const p of listed) {
      const key = p.company || `__${p.id}`;
      if (done.has(key)) continue;
      done.add(key);

      const all = byCompany.get(key) ?? [p];
      if (all.length >= COLLAPSE_FROM && !expandedCompanies.has(key)) {
        rows.push(all[0]);
        collapsedExtra.set(all[0].id, all.length - 1);
      } else {
        rows.push(...all);
      }
    }
  }

  return (
    <div className="jobfinder-root min-h-screen bg-white text-gray-900">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-5 inline-block">
          ← 홈
        </Link>

        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-xl font-bold tracking-tight">채용공고</h1>
          <span className="text-xs text-gray-400">사람인 · 원티드 · 잡코리아 · 리멤버</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
          {FILTER_TAGS.map((tag) => (
            <span key={tag} className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1">
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={handleManualCheck}
          disabled={checking}
          className="w-full rounded-md py-2.5 px-4 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {checking ? `확인 중... ${elapsed}초` : '지금 확인하기'}
        </button>

        {checking ? (
          <div className="mt-2 mb-4">
            <div className="h-1 w-full bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(98, (elapsed / CHECK_ESTIMATE_SEC) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {elapsed < 80 ? '채용사이트 4곳에서 공고를 받아오는 중' : '잡플래닛 평점을 확인하는 중'} · 보통 2분쯤 걸려요
            </p>
          </div>
        ) : (
          <div className="mb-4" />
        )}

        {lastCheck && (
          <div
            className={`border-l-2 pl-3 py-1.5 mb-5 text-sm ${
              lastCheck.error
                ? 'border-red-400 text-red-600'
                : lastCheck.notifiedCount > 0
                  ? 'border-blue-400 text-blue-700'
                  : 'border-gray-200 text-gray-500'
            }`}
          >
            {lastCheck.error
              ? lastCheck.error
              : lastCheck.notifiedCount > 0
                ? `조건에 맞는 새 공고 ${lastCheck.notifiedCount}건 · 알림을 보냈어요`
                : `변동 없음 · 조건 일치 ${lastCheck.matchedCount}건 확인`}
            {lastCheck.authFailures.length > 0 && (
              <p className="mt-0.5 text-amber-600 text-xs">
                {lastCheck.authFailures.map((s) => SITE_LABEL[s] ?? s).join(', ')} 인증/세션 확인 필요
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mb-6">
          잡플래닛 평점이 2점 미만이거나 확인되지 않은 공고는 목록에서 숨겨요. 평점은 회사명이 정확히 일치할 때만 표시돼요.
        </p>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 mb-6">
          <p className="text-sm text-gray-700 leading-relaxed">{CRITERIA_SUMMARY}</p>

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 mt-4">
            {CRITERIA_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="text-xs font-semibold text-gray-500">{group.title} · {group.subtitle}</p>
                <ul className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.mark} className="text-xs text-gray-500">
                      {item.mark} {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setViewTab('all')}
              className={`text-sm font-semibold ${viewTab === 'all' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              전체 <span className="font-normal">{sorted.length}</span>
            </button>
            <button
              onClick={() => setViewTab('starred')}
              className={`text-sm font-semibold ${viewTab === 'starred' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              ⭐ 관심기업 <span className="font-normal">{starredSorted.length}</span>
            </button>
          </div>
          {viewTab === 'all' && hiddenCount > 0 && (
            <button onClick={() => setShowHidden((v) => !v)} className="text-xs text-gray-400 hover:text-gray-600">
              {showHidden ? '숨겨진 공고 접기' : `숨겨진 공고 보기 (${hiddenCount})`}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-10">불러오는 중...</p>
        ) : listed.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {viewTab === 'starred' ? (
              <p>⭐ 표시를 누르면 관심기업으로 여기 모여요</p>
            ) : (
              <>
                <p>아직 조건에 맞는 공고가 없어요</p>
                <p className="text-xs mt-1">위 버튼으로 직접 확인해보세요</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((p) => {
              const tier = tierLabel(p.recommend_tier);
              const deadline = deadlineLabel(p.expires_at);
              const extra = collapsedExtra.get(p.id);
              return (
                <div key={`${p.source_site}_${p.id}`}>
                  <div className={`flex gap-2 py-3.5 px-2 -mx-2 rounded hover:bg-gray-50 ${isHidden(p) ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => toggleStar(p)}
                      className="shrink-0 pt-0.5"
                      aria-label={p.starred ? '관심기업 해제' : '관심기업으로 등록'}
                    >
                      <StarIcon filled={p.starred} />
                    </button>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 flex-1 min-w-0">
                      <div className="shrink-0 w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-[11px] font-semibold text-gray-400">
                        {(SITE_LABEL[p.source_site] ?? p.source_site).slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[14px] font-semibold text-gray-900 leading-snug">{p.title}</h3>
                          <span className={`shrink-0 text-[11px] font-medium ${tier.className}`}>{tier.label}</span>
                        </div>
                        <p className="text-[13px] text-gray-600 mt-0.5">{p.company}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {[p.location, p.career_text, p.employment_type, SITE_LABEL[p.source_site] ?? p.source_site, timeAgo(p.first_seen_at)]
                            .filter(Boolean)
                            .join(' · ')}
                          {deadline && <span className="ml-1.5 text-orange-600 font-medium">{deadline}</span>}
                        </p>
                        {p.reason && <p className="text-xs text-gray-500 mt-1">{p.reason}</p>}
                      </div>
                    </a>
                    <button
                      onClick={() => toggleDismiss(p)}
                      className="shrink-0 self-start text-gray-300 hover:text-gray-600 text-xs px-1"
                      aria-label={p.dismissed ? '관심없음 해제' : '관심없음으로 숨기기'}
                      title={p.dismissed ? '관심없음 해제' : '관심없음'}
                    >
                      {p.dismissed ? '↺' : '✕'}
                    </button>
                  </div>
                  {extra ? (
                    <button
                      onClick={() => toggleCompany(p.company)}
                      className="w-full text-left text-xs text-gray-400 hover:text-gray-600 pb-3 pl-[52px]"
                    >
                      {p.company} 공고 {extra}건 더 보기
                    </button>
                  ) : null}
                </div>
              );
            })}
            {viewTab === 'all' &&
              [...expandedCompanies].length > 0 &&
              rows.length > 0 && (
                <button
                  onClick={() => setExpandedCompanies(new Set())}
                  className="w-full text-left text-xs text-gray-400 hover:text-gray-600 py-2"
                >
                  펼친 회사 모두 접기
                </button>
              )}
          </div>
        )}

        <p className="text-[11px] text-gray-300 text-center mt-8">GitHub Actions 하루 1번(오후 1시) 자동 체크 · ntfy 푸시 알림</p>
      </div>
    </div>
  );
}
