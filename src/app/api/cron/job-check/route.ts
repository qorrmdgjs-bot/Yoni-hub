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

    for (const p of newPostings) {
      const perkTags = detectPerkTags(p);
      const rating = await getJobplanetRating(p.company);
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
      authFailures,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Check failed', detail: String(err) }, { status: 500 });
  }
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

async function getJobplanetRating(company: string): Promise<number | null> {
  const key = normalizeCompany(company);
  if (!key) return null;

  const { data } = await supabase.from('jobplanet_ratings_cache').select('*').eq('company_normalized', key).maybeSingle();
  const cached = data as RatingCacheRow | null;
  // rating이 null인 캐시(조회 실패 또는 미확정)는 신뢰하지 않고 매번 재시도한다.
  // 그래야 차단·일시 오류로 실패했던 회사도 다음 사이클에 다시 시도된다.
  if (cached && cached.rating !== null) {
    const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < JOBPLANET_CACHE_DAYS) return cached.rating;
  }

  try {
    const result = await fetchCompanyRating(company);
    if (result?.rating != null) {
      // 성공(평점을 실제로 찾은 경우)만 캐싱한다 — 실패/미발견을 캐싱하면 재시도 기회가 없어진다.
      await supabase.from('jobplanet_ratings_cache').upsert(
        {
          company_normalized: key,
          rating: result.rating,
          jobplanet_url: result.url ?? null,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'company_normalized' },
      );
      return result.rating;
    }
    return null;
  } catch {
    return null; // 조회 실패 — 캐싱하지 않아 다음 사이클에 재시도된다.
  }
}
