import type { JobPosting, SiteAdapterResult } from './types';

/**
 * 리멤버 비공식 API. 로그인 필요 — 사용자가 DevTools Network 탭에서 직접 캡처한
 * 요청을 그대로 재현한다(2026-09 실검증 완료).
 *
 * POST https://career-api.rememberapp.co.kr/job_postings/search
 * 인증: Authorization 헤더 하나(`Token token=<값>`) — 쿠키 전체가 아니라 토큰 하나라
 *   REMEMBER_AUTH_TOKEN 환경변수에 그 값을 통째로 넣으면 된다(예:
 *   "Token token=25c1ad0a3361354240e222dce991fabd"). 사람인/원티드/잡코리아보다
 *   구조는 훨씬 단순하지만, 이 토큰도 언젠가 만료된다 — 만료되면 401을 반환해
 *   authFailed로 처리한다.
 *
 * 응답 필드(실검증): data[].{ id, title, organization:{name}, addresses:[{address_level1,
 *   address_level2}], min_experience, max_experience, job_description, qualifications,
 *   introduction, preferred_qualifications, additional_information, recruiting_process,
 *   starts_at }. 고용형태를 나타내는 전용 필드는 없어 본문 텍스트에서 "정규직"/
 *   "계약직" 등의 단어로 판단한다(사람인과 동일한 방식).
 */

const KEYWORDS = ['회계', '경영지원'];
const HEADERS_BASE = {
  accept: 'application/json, text/plain, */*',
  'content-type': 'application/json',
  referer: 'https://career.rememberapp.co.kr/',
  origin: 'https://career.rememberapp.co.kr',
};

interface Address {
  address_level1?: string;
  address_level2?: string;
}

interface RawPosting {
  id: number;
  title: string;
  organization?: { name?: string };
  addresses?: Address[];
  min_experience?: number | null;
  max_experience?: number | null;
  job_description?: string;
  qualifications?: string;
  introduction?: string;
  preferred_qualifications?: string;
  additional_information?: string;
  recruiting_process?: string;
  starts_at?: string;
}

export async function fetchPostings(): Promise<SiteAdapterResult> {
  const authToken = process.env.REMEMBER_AUTH_TOKEN;
  if (!authToken) {
    return { postings: [], authFailed: true };
  }

  const byId = new Map<string, JobPosting>();

  for (const kw of KEYWORDS) {
    const body = {
      search: {
        include_applied_job_posting: false,
        leader_position: false,
        organization_type: 'all',
        application_type: 'all',
        keywords: [kw],
      },
      sort: 'recommended',
      page: 1,
      per: 30,
      new_function_score: false,
      job_posting_list_ab_test: 'B',
    };

    const res = await fetch('https://career-api.rememberapp.co.kr/job_postings/search', {
      method: 'POST',
      headers: { ...HEADERS_BASE, authorization: authToken },
      body: JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
      return { postings: [], authFailed: true };
    }
    if (!res.ok) throw new Error(`remember http ${res.status}`);

    const json = (await res.json()) as { data?: RawPosting[] };
    for (const raw of json.data ?? []) {
      const posting = toJobPosting(raw);
      if (posting) byId.set(posting.externalId, posting);
    }
  }

  return { postings: [...byId.values()] };
}

function toJobPosting(raw: RawPosting): JobPosting | null {
  if (!raw?.id || !raw.title) return null;

  const location = (raw.addresses ?? [])
    .map((a) => [a.address_level1, a.address_level2].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('; ') || null;

  const jdText = [
    raw.job_description,
    raw.qualifications,
    raw.introduction,
    raw.preferred_qualifications,
    raw.additional_information,
    raw.recruiting_process,
  ]
    .filter(Boolean)
    .join('\n');

  const isRegular = jdText.includes('정규직') ? true : /계약직|인턴/.test(jdText) ? false : null;

  return {
    sourceSite: 'remember',
    externalId: String(raw.id),
    title: raw.title,
    company: raw.organization?.name ?? '',
    location,
    employmentType: null,
    isRegular,
    careerMin: typeof raw.min_experience === 'number' ? raw.min_experience : null,
    careerMax: typeof raw.max_experience === 'number' ? raw.max_experience : null,
    careerText:
      typeof raw.min_experience === 'number' || typeof raw.max_experience === 'number'
        ? `${raw.min_experience ?? 0}~${raw.max_experience ?? '무관'}년`
        : null,
    jdText: jdText || null,
    perkHints: [],
    url: `https://career.rememberapp.co.kr/job/posting/${raw.id}`,
    postedAt: raw.starts_at ?? null,
  };
}
