import type { JobPosting, SiteAdapterResult } from './types';

/**
 * 원티드 비공식 API. 로그인 불필요, 실검증 완료(2026-09).
 *
 * 검색: GET /api/chaos/search/v1/position?query=<키워드>&locations=all&years=-1&sort=job.latest_order
 *   - 응답의 employment_type("regular"/"contract"/"intern")과 annual_from/annual_to(요구 경력)가
 *     검색 결과에 이미 포함돼 있어 후보 단계에서 바로 필터링할 수 있다.
 *   - 주의(실검증 확인): locations에 특정 구 코드(예: seoul.gangnam-gu)를 넣으면 query
 *     키워드 필터가 무시된다. 그래서 항상 locations=all로 검색하고 지역은 상세 API로 확인한다.
 * 상세: GET /api/chaos/jobs/v5/{id}/details → data.job.address.district(예: "강남구"),
 *   data.job.detail.{intro, main_tasks, preferred_points, requirements, benefits}(JD 텍스트).
 *   신규 후보에 대해서만 호출해 요청 수를 최소화한다.
 *
 * 두 API 모두 비공식이라 사전 통보 없이 바뀔 수 있다.
 */

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

const KEYWORDS = ['회계', '경영지원'];

interface SearchItem {
  id: number;
  position: string;
  company?: { name?: string };
  employment_type?: string;
  annual_from?: number;
  annual_to?: number;
}

interface JobAddress {
  location?: string;
  district?: string;
  full_location?: string;
}

interface JobDetailText {
  intro?: string;
  main_tasks?: string;
  preferred_points?: string;
  requirements?: string;
  benefits?: string;
}

interface DetailResponse {
  data?: {
    job?: {
      address?: JobAddress;
      detail?: JobDetailText;
    };
  };
}

interface FetchedDetail extends JobDetailText {
  address?: JobAddress;
}

export async function fetchPostings(): Promise<SiteAdapterResult> {
  const byId = new Map<number, SearchItem>();

  for (const kw of KEYWORDS) {
    const url =
      `https://www.wanted.co.kr/api/chaos/search/v1/position?query=${encodeURIComponent(kw)}` +
      `&country=kr&years=-1&locations=all&sort=job.latest_order&limit=100&offset=0`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`wanted search http ${res.status}`);
    const json = (await res.json()) as { data?: SearchItem[] };
    for (const item of json.data ?? []) {
      if (item?.id) byId.set(item.id, item);
    }
  }

  const postings: JobPosting[] = [];
  for (const item of byId.values()) {
    if (item.employment_type && item.employment_type !== 'regular') continue; // 정규직 아님이 확실하면 상세 조회 생략

    const detail = await fetchDetail(item.id);
    const jdText = detail
      ? [detail.intro, detail.main_tasks, detail.preferred_points, detail.requirements, detail.benefits]
          .filter(Boolean)
          .join('\n')
      : null;

    postings.push({
      sourceSite: 'wanted',
      externalId: String(item.id),
      title: item.position ?? '',
      company: item.company?.name ?? '',
      location: detail?.address ? `${detail.address.location ?? ''} ${detail.address.district ?? ''}`.trim() : null,
      employmentType: item.employment_type ?? null,
      isRegular: item.employment_type ? item.employment_type === 'regular' : null,
      careerMin: typeof item.annual_from === 'number' ? item.annual_from : null,
      careerMax: typeof item.annual_to === 'number' ? item.annual_to : null,
      careerText:
        typeof item.annual_from === 'number' || typeof item.annual_to === 'number'
          ? `${item.annual_from ?? 0}~${item.annual_to ?? '무관'}년`
          : null,
      jdText,
      perkHints: [],
      url: `https://www.wanted.co.kr/wd/${item.id}`,
      postedAt: null, // 검색 응답에 게시일 필드가 없어 first_seen_at으로 대체
      expiresAt: null, // 원티드는 마감일을 주지 않는다(상세의 due_time도 항상 null)
    });
  }

  return { postings };
}

async function fetchDetail(id: number): Promise<FetchedDetail | null> {
  const res = await fetch(`https://www.wanted.co.kr/api/chaos/jobs/v5/${id}/details`, { headers: HEADERS });
  if (!res.ok) return null;
  const json = (await res.json()) as DetailResponse;
  const job = json.data?.job;
  if (!job) return null;
  return { address: job.address, ...job.detail };
}
