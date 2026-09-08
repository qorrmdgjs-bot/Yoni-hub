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
const JOBPLANET_BACKFILL_LIMIT = 200;
/**
 * 잡플래닛 조회 간격. 프록시 무료 한도가 분당 20건 안팎이라 동시 5건으로 돌렸더니
 * 한 사이클에 23건이 429로 튕겼다. 조회 자체는 1초 안에 끝나므로 동시성 대신
 * 간격을 둬서 분당 18건 정도로 맞춘다.
 */
const JOBPLANET_MIN_GAP_MS = process.env.JINA_API_KEY ? 300 : 3_400;
/**
 * 백필에 쓸 시간 상한. 잡플래닛을 프록시로 우회하면 1건에 수 초씩 걸려서,
 * 건수만으로 제한하면 함수 실행 시간을 넘길 수 있다. 못 채운 건 다음 사이클에 이어서 한다.
 */
const JOBPLANET_BACKFILL_BUDGET_MS = 60_000;
/** 기존 공고 마감일 갱신을 몇 건씩 묶어 보낼지 (Supabase에 한꺼번에 몰지 않기 위한 상한) */
const EXPIRY_REFRESH_CHUNK = 10;

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
  id: number;
  source_site: string;
  external_id: string;
  expires_at: string | null;
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
        // 인증이 풀려도 받아온 공고가 있으면 버리지 않는다 — 리멤버는 토큰이 죽어도
        // 개인화만 빠진 공개 결과를 주기 때문에 그대로 쓰는 편이 낫다.
        candidates.push(...result.value.postings);
        continue;
      }

      await handleAdapterSuccess(site, healthMap.get(site));
      candidates.push(...result.value.postings);
    }

    const matched = candidates.filter(matchesCriteria);

    const { data: existing } = await supabase.from('job_postings').select('id, source_site, external_id, expires_at');
    const existingMap = new Map<string, ExistingPostingRow>();
    for (const r of (existing ?? []) as ExistingPostingRow[]) existingMap.set(`${r.source_site}_${r.external_id}`, r);
    const newPostings = matched.filter((p) => !existingMap.has(`${p.sourceSite}_${p.externalId}`));

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
        expires_at: p.expiresAt,
        notified: tier !== 'excluded',
      });

      if (tier !== 'excluded') notifiable.push({ posting: p, reason, tier });
    }

    if (rows.length > 0) {
      await supabase.from('job_postings').upsert(rows, { onConflict: 'source_site,external_id' });
    }

    const refreshedCount = await refreshExpiryDates(matched, existingMap);
    const alwaysOpenCount = await deleteAlwaysOpenPostings(candidates, existingMap);
    const expiredCount = await deleteExpiredPostings();
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
      refreshedCount,
      alwaysOpenCount,
      expiredCount,
      jobplanet: jobplanetStats,
      authFailures,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Check failed', detail: String(err) }, { status: 500 });
  }
}

/**
 * 이미 저장된 공고의 마감일을 이번에 받아온 값으로 맞춘다.
 *
 * 저장은 "신규 공고"에만 걸려 있어서, 마감일 컬럼을 새로 만든 시점에 이미 있던 공고는
 * 영영 마감일이 비어 있었다(실제로 193건 전부가 그랬다). 평점 백필과 같은 이유·같은 처방.
 * 사이트가 마감일을 연장하거나 상시채용으로 바꾸는 경우도 여기서 따라간다.
 *
 * 값이 그대로인 건 건드리지 않는다 — 첫 사이클만 대량 갱신이고 이후엔 몇 건이면 끝난다.
 */
async function refreshExpiryDates(
  matched: JobPosting[],
  existingMap: Map<string, ExistingPostingRow>,
): Promise<number> {
  const changed: { id: number; expiresAt: string | null }[] = [];

  for (const p of matched) {
    const row = existingMap.get(`${p.sourceSite}_${p.externalId}`);
    if (!row) continue; // 신규 공고는 저장 단계에서 이미 마감일이 들어갔다
    if (sameInstant(row.expires_at, p.expiresAt)) continue;
    changed.push({ id: row.id, expiresAt: p.expiresAt });
  }

  // 한 건씩 순차로 돌리면 첫 사이클에 200번 왕복해 실행 시간을 잡아먹는다.
  for (let i = 0; i < changed.length; i += EXPIRY_REFRESH_CHUNK) {
    const chunk = changed.slice(i, i + EXPIRY_REFRESH_CHUNK);
    await Promise.all(
      chunk.map((c) => supabase.from('job_postings').update({ expires_at: c.expiresAt }).eq('id', c.id)),
    );
  }

  return changed.length;
}

/**
 * 상시채용으로 바뀌었거나, 상시채용 제외 규칙이 생기기 전에 이미 저장된 공고를 지운다.
 *
 * 필터(matchesCriteria)는 새로 들어오는 걸 막을 뿐이라, 이미 DB에 있는 상시채용 공고는
 * 그대로 남는다. 어댑터가 돌려준 후보(candidates)에는 걸러지기 전 원본이 다 들어 있어서
 * "이번에 상시채용이라고 표기된 공고"를 정확히 짚어낼 수 있다.
 * 관심기업으로 별을 눌러둔 건 남긴다 — 사용자가 직접 표시한 것이기 때문.
 */
async function deleteAlwaysOpenPostings(
  candidates: JobPosting[],
  existingMap: Map<string, ExistingPostingRow>,
): Promise<number> {
  const ids: number[] = [];
  for (const p of candidates) {
    if (!p.alwaysOpen) continue;
    const row = existingMap.get(`${p.sourceSite}_${p.externalId}`);
    if (row) ids.push(row.id);
  }
  if (ids.length === 0) return 0;

  const { data } = await supabase.from('job_postings').delete().in('id', ids).eq('starred', false).select('id');
  return (data ?? []).length;
}

/** 타임스탬프 표기가 달라도(`+00:00` vs `.000Z`) 같은 시각이면 갱신하지 않기 위한 비교 */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Number.isNaN(ta) || Number.isNaN(tb) ? a === b : ta === tb;
}

/**
 * 마감이 지난 공고를 지운다. 지원할 수 없는 공고가 목록에 남아 있어도 방해만 된다.
 *
 * 관심기업으로 별을 눌러둔 공고는 남긴다 — 사용자가 직접 표시한 것이라
 * 마감됐다는 이유로 말없이 지우면 안 된다.
 * 마감일을 안 주는 사이트(원티드)나 상시채용은 expires_at이 null이라 대상이 아니다.
 */
async function deleteExpiredPostings(): Promise<number> {
  const { data } = await supabase
    .from('job_postings')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .eq('starred', false)
    .select('id');

  return (data ?? []).length;
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
  const deadline = Date.now() + JOBPLANET_BACKFILL_BUDGET_MS;

  // 공고 단위가 아니라 "회사 단위"로 조회한다 — 같은 회사 공고가 여러 건이면
  // 조회는 한 번이면 된다.
  const companies = [...new Set(rows.map((r) => r.company).filter(Boolean))];
  const ratings = new Map<string, number>();

  for (const company of companies) {
    if (Date.now() > deadline) break;

    const startedAt = Date.now();
    const rating = await getJobplanetRating(company, stats);
    if (rating !== null) ratings.set(company, rating);

    const gap = JOBPLANET_MIN_GAP_MS - (Date.now() - startedAt);
    if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap));
  }

  let filled = 0;

  for (const row of rows) {
    const rating = ratings.get(row.company);
    if (rating === undefined) continue;

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
      expiresAt: null,
      alwaysOpen: false,
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
