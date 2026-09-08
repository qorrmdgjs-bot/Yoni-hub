import { NextRequest, NextResponse } from 'next/server';
import type { JobPosting, SiteAdapterResult, SourceSite } from '@job/sites/types';
import * as saramin from '@job/sites/saramin';
import * as wanted from '@job/sites/wanted';
import * as jobkorea from '@job/sites/jobkorea';
import * as remember from '@job/sites/remember';
import { fetchCompanyRating } from '@job/sites/jobplanet';
import { normalizeCompany } from '@job/lib/company';
import { matchesCriteria, detectPerkTags, tierFromRating, buildReason } from '@job/criteria';
import { sendNtfy } from '@/utils/ntfy';
import { supabase } from '@/lib/supabase';

const JOB_NTFY_TOPIC = 'job-alert-yoni';
const JOBPLANET_CACHE_DAYS = 30;
/** "잡플래닛에 없는 회사"로 판정된 캐시의 유효기간 — 나중에 등록될 수도 있어 짧게 잡는다 */
const JOBPLANET_MISS_CACHE_DAYS = 3;
/** 평점이 비어 있는 기존 공고를 한 사이클에 몇 건까지 다시 채울지 */
const JOBPLANET_BACKFILL_LIMIT = 60;

const ADAPTERS: { site: SourceSite; fetchPostings: () => Promise<SiteAdapterResult> }[] = [
  { site: 'saramin', fetchPostings: saramin.fetchPostings },
  { site: 'wanted', fetchPostings: wanted.fetchPostings },
  { site: 'jobkorea', fetchPostings: jobkorea.fetchPostings },
  { site: 'remember', fetchPostings: remember.fetchPostings },
];

interface AdapterHealthRow {
  source_site: string;
  alerted_at: string | null;
}

interface ExistingPostingRow {
  source_site: string;
  external_id: string;
}

interface BackfillRow {
  id: number;
  source_site: string;
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  employment_type: string | null;
  career_text: string | null;
  perk_tags: string[] | null;
  url: string;
}

interface RatingCacheRow {
  company_normalized: string;
  rating: number | null;
  jobplanet_url: string | null;
  fetched_at: string;
}

export async function GET(request: NextRequest) {
  const isManual = request.nextUrl.searchParams.get('manual') === 'true';
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!isManual && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: healthRows } = await supabase.from('job_adapter_health').select('source_site, alerted_at');
    const healthMap = new Map<string, AdapterHealthRow>();
    for (const r of (healthRows ?? []) as AdapterHealthRow[]) healthMap.set(r.source_site, r);

    const results = await Promise.allSettled(ADAPTERS.map((a) => a.fetchPostings()));

    const authFailures: string[] = [];
    const candidates: JobPosting[] = [];

    for (let i = 0; i < ADAPTERS.length; i++) {
      const { site } = ADAPTERS[i];
      const result = results[i];

      if (result.status === 'rejected') {
        await handleAdapterFailure(site, String(result.reason), healthMap.get(site));
        continue;
      }
      if (result.value.authFailed) {
        authFailures.push(site);
        await handleAdapterFailure(site, `${site} 인증/세션 만료`, healthMap.get(site));
        continue;
      }

      await handleAdapterSuccess(site, healthMap.get(site));
      candidates.push(...result.value.postings);
    }

    const matched = candidates.filter(matchesCriteria);

    const { data: existing } = await supabase.from('job_postings').select('source_site, external_id');
    const existingSet = new Set(
      ((existing ?? []) as ExistingPostingRow[]).map((r) => `${r.source_site}_${r.external_id}`),
    );
    const newPostings = matched.filter((p) => !existingSet.has(`${p.sourceSite}_${p.externalId}`));

    const rows = [];
    const notifiable: { posting: JobPosting; reason: string; tier: ReturnType<typeof tierFromRating> }[] = [];
    const jobplanetStats: JobplanetStats = { hit: 0, miss: 0, failed: 0, lastError: null };

    for (const p of newPostings) {
      const perkTags = detectPerkTags(p);
      const rating = await getJobplanetRating(p.company, jobplanetStats);
      const tier = tierFromRating(rating);
      const reason = buildReason(p, rating, tier, perkTags);

      rows.push({
        source_site: p.sourceSite,
        external_id: p.externalId,
        title: p.title,
        company: p.company,
        location: p.location,
        employment_type: p.employmentType,
        career_text: p.careerText,
        perk_tags: perkTags,
        jobplanet_rating: rating,
        recommend_tier: tier,
        reason,
        url: p.url,
        posted_at: p.postedAt,
        notified: tier !== 'excluded',
      });

      if (tier !== 'excluded') notifiable.push({ posting: p, reason, tier });
    }

    if (rows.length > 0) {
      await supabase.from('job_postings').upsert(rows, { onConflict: 'source_site,external_id' });
    }

    const backfilledCount = await backfillMissingRatings(jobplanetStats);

    if (jobplanetStats.failed > 0) {
      await supabase.from('job_adapter_health').upsert(
        { source_site: 'jobplanet', last_error: `${jobplanetStats.failed}건 실패: ${jobplanetStats.lastError}` },
        { onConflict: 'source_site' },
      );
    } else if (jobplanetStats.hit > 0) {
      await supabase
        .from('job_adapter_health')
        .upsert({ source_site: 'jobplanet', last_success_at: new Date().toISOString(), last_error: null }, { onConflict: 'source_site' });
    }

    if (notifiable.length > 0) {
      const lines = notifiable.map(({ posting, reason, tier }) => {
        const badge = tier === 'strong' ? '🔥강력추천' : '👍추천';
        return `[${badge}] ${posting.title} - ${posting.company} (${posting.sourceSite})\n${reason}`;
      });
      await sendNtfy(
        `💼 새 채용공고 ${notifiable.length}건`,
        lines.join('\n\n'),
        JOB_NTFY_TOPIC,
        4,
      );
    }

    return NextResponse.json({
      perSite: Object.fromEntries(
        ADAPTERS.map((a, i) => [
          a.site,
          results[i].status === 'fulfilled'
            ? { ok: !results[i].value.authFailed, authFailed: !!results[i].value.authFailed }
            : { ok: false, error: String((results[i] as PromiseRejectedResult).reason) },
        ]),
      ),
      candidateCount: candidates.length,
      matchedCount: matched.length,
      newCount: newPostings.length,
      notifiedCount: notifiable.length,
      excludedCount: newPostings.length - notifiable.length,
      backfilledCount,
      jobplanet: jobplanetStats,
      authFailures,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Check failed', detail: String(err) }, { status: 500 });
  }
}

/**
 * 이미 저장된 공고 중 잡플래닛 평점이 비어 있는 것들을 다시 조회해 채운다.
 *
 * 평점 조회는 원래 "신규 공고"에만 걸려 있어서, 저장 시점에 조회가 실패한 공고는
 * 그 뒤로 영영 "평점 정보 없음"으로 남았다(실제로 에이블리코퍼레이션이 그랬다).
 * 한 사이클에 JOBPLANET_BACKFILL_LIMIT건씩만 처리해 실행 시간을 묶어둔다.
 * 백필로 등급이 바뀌어도 알림은 다시 보내지 않는다 — 이미 알린 공고이기 때문.
 */
async function backfillMissingRatings(stats: JobplanetStats): Promise<number> {
  const { data } = await supabase
    .from('job_postings')
    .select('id, source_site, external_id, title, company, location, employment_type, career_text, perk_tags, url')
    .is('jobplanet_rating', null)
    .order('first_seen_at', { ascending: false })
    .limit(JOBPLANET_BACKFILL_LIMIT);

  const rows = (data ?? []) as BackfillRow[];
  let filled = 0;

  for (const row of rows) {
    const rating = await getJobplanetRating(row.company, stats);
    if (rating === null) continue;

    const perkTags = row.perk_tags ?? [];
    const tier = tierFromRating(rating);
    const posting: JobPosting = {
      sourceSite: row.source_site as SourceSite,
      externalId: row.external_id,
      title: row.title,
      company: row.company,
      location: row.location,
      employmentType: row.employment_type,
      isRegular: null,
      careerMin: null,
      careerMax: null,
      careerText: row.career_text,
      jdText: null,
      perkHints: perkTags,
      url: row.url,
      postedAt: null,
    };

    await supabase
      .from('job_postings')
      .update({ jobplanet_rating: rating, recommend_tier: tier, reason: buildReason(posting, rating, tier, perkTags) })
      .eq('id', row.id);
    filled++;
  }

  return filled;
}

async function handleAdapterFailure(site: SourceSite, message: string, prevHealth?: AdapterHealthRow) {
  const alreadyAlerted = !!prevHealth?.alerted_at;
  await supabase
    .from('job_adapter_health')
    .upsert(
      { source_site: site, last_error: message, alerted_at: alreadyAlerted ? prevHealth!.alerted_at : new Date().toISOString() },
      { onConflict: 'source_site' },
    );
  if (!alreadyAlerted) {
    await sendNtfy(`⚠️ ${site} 체크 실패`, `${message}\n\n리멤버라면 REMEMBER_AUTH_TOKEN 갱신이 필요할 수 있습니다.`, JOB_NTFY_TOPIC, 4);
  }
}

async function handleAdapterSuccess(site: SourceSite, prevHealth?: AdapterHealthRow) {
  if (prevHealth?.alerted_at) {
    await supabase
      .from('job_adapter_health')
      .upsert({ source_site: site, last_success_at: new Date().toISOString(), alerted_at: null }, { onConflict: 'source_site' });
  } else {
    await supabase
      .from('job_adapter_health')
      .upsert({ source_site: site, last_success_at: new Date().toISOString() }, { onConflict: 'source_site' });
  }
}

/** 한 사이클 동안의 잡플래닛 조회 결과 집계 — 실패가 조용히 묻히지 않게 응답·health에 남긴다 */
interface JobplanetStats {
  hit: number;
  miss: number;
  failed: number;
  lastError: string | null;
}

async function getJobplanetRating(company: string, stats: JobplanetStats): Promise<number | null> {
  const key = normalizeCompany(company);
  if (!key) return null;

  const { data } = await supabase.from('jobplanet_ratings_cache').select('*').eq('company_normalized', key).maybeSingle();
  const cached = data as RatingCacheRow | null;
  if (cached) {
    const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60 * 24);
    // 평점을 찾은 캐시는 오래 믿고, "잡플래닛에 없는 회사"라는 캐시는 짧게만 믿는다.
    const ttl = cached.rating !== null ? JOBPLANET_CACHE_DAYS : JOBPLANET_MISS_CACHE_DAYS;
    if (ageDays < ttl) return cached.rating;
  }

  try {
    const result = await fetchCompanyRating(company);
    // 조회 자체는 성공했으므로 결과를 캐싱한다. 평점을 못 찾은 경우(null)도
    // 짧은 TTL로 캐싱해, 잡플래닛에 아예 없는 회사를 매 사이클 다시 뒤지지 않게 한다.
    await supabase.from('jobplanet_ratings_cache').upsert(
      {
        company_normalized: key,
        rating: result?.rating ?? null,
        jobplanet_url: result?.url ?? null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'company_normalized' },
    );
    if (result?.rating != null) stats.hit++;
    else stats.miss++;
    return result?.rating ?? null;
  } catch (err) {
    // 네트워크 오류·차단 등 조회 실패는 캐싱하지 않는다 — 다음 사이클에 다시 시도해야 하므로.
    stats.failed++;
    stats.lastError = String(err);
    return null;
  }
}
