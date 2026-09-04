import type { JobPosting, SiteAdapterResult } from './types';

/**
 * 사람인 비공식 스크래핑. 원래 공식 Open API(access-key 발급, 승인 대기)로 만들었으나,
 * 로그인 없이 열리는 일반 검색 페이지(zf_user/search)에서 원티드·잡코리아와 똑같은
 * 방식으로 데이터를 뽑을 수 있는 게 확인돼(2026-09) 승인 대기 없이 바로 쓰는 쪽으로
 * 바꿨다 — 4개 사이트 전부 비공식이 되어 리스크 성격은 통일됐지만 승인 대기가 없어졌다.
 *
 * GET https://www.saramin.co.kr/zf_user/search?searchType=search&searchword=<키워드>&loc_cd=<코드>
 * - loc_cd는 실검증으로 서버에서 실제로 필터링됨을 확인(101010=강남구, 101150=서초구,
 *   공식 API 코드표와 동일). job_type(고용형태) 파라미터는 이 엔드포인트에서 무시되는
 *   것으로 확인돼 고용형태는 카드 텍스트를 읽어 클라이언트에서 판단한다.
 * - 결과 카드(`item_recruit`)는 구식 서버렌더 HTML이라 class명이 안정적이라 정규식
 *   추출이 잡코리아보다 오히려 쉽다. 다만 사람인이 마크업을 바꾸면 깨질 수 있는 건
 *   원티드·잡코리아와 동일한 리스크다.
 */

const KEYWORDS = ['회계', '경영지원'];
const LOC_CODES = ['101010', '101150']; // 강남구, 서초구
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

export async function fetchPostings(): Promise<SiteAdapterResult> {
  const byId = new Map<string, JobPosting>();

  for (const kw of KEYWORDS) {
    const url =
      `https://www.saramin.co.kr/zf_user/search?searchType=search&searchword=${encodeURIComponent(kw)}` +
      `&loc_cd=${LOC_CODES.join(',')}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`saramin http ${res.status}`);
    const html = await res.text();

    for (const posting of extractCards(html)) {
      byId.set(posting.externalId, posting);
    }
  }

  return { postings: [...byId.values()] };
}

function extractCards(html: string): JobPosting[] {
  const postings: JobPosting[] = [];
  const startRe = /<div class="item_recruit"\s+value="(\d+)"/g;
  const starts: { id: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(html))) {
    starts.push({ id: m[1], index: m.index });
  }

  for (let i = 0; i < starts.length; i++) {
    const { id, index } = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].index : Math.min(html.length, index + 6000);
    const block = html.slice(index, end);

    const titleMatch = block.match(/<h2 class="job_tit">[\s\S]*?<span>([\s\S]*?)<\/span>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';

    const companyMatch = block.match(/<strong class="corp_name">\s*<a[^>]*>\s*([^<]+?)\s*<\/a>/);
    const company = companyMatch?.[1]?.trim() ?? '';

    const conditionMatch = block.match(/<div class="job_condition">([\s\S]*?)<\/div>/);
    const conditionText = conditionMatch
      ? conditionMatch[1]
          .replace(/<a[^>]*>/g, '')
          .replace(/<\/a>/g, '|')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : '';

    const parts = conditionText.split('|').map((s) => s.trim());
    const locationText = parts.slice(0, -1).filter(Boolean).join(' ');
    const trailingText = parts[parts.length - 1] ?? '';

    const { careerMin, careerMax, careerText } = parseCareer(trailingText);
    const isRegular = trailingText.includes('정규직')
      ? true
      : /계약직|인턴직|파견직|아르바이트|프리랜서/.test(trailingText)
        ? false
        : null;

    if (!title || !company) continue;

    postings.push({
      sourceSite: 'saramin',
      externalId: id,
      title,
      company,
      location: locationText || null,
      employmentType: trailingText || null,
      isRegular,
      careerMin,
      careerMax,
      careerText,
      jdText: null,
      perkHints: [],
      url: `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${id}`,
      postedAt: null,
    });
  }

  return postings;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCareer(text: string): { careerMin: number | null; careerMax: number | null; careerText: string | null } {
  if (text.includes('경력무관')) return { careerMin: null, careerMax: null, careerText: '경력무관' };

  const range = text.match(/경력\s*(\d+)\s*~\s*(\d+)\s*년/);
  if (range) return { careerMin: Number(range[1]), careerMax: Number(range[2]), careerText: range[0] };

  const atLeast = text.match(/경력\s*(\d+)\s*년\s*↑/);
  if (atLeast) return { careerMin: Number(atLeast[1]), careerMax: null, careerText: atLeast[0] };

  if (text.includes('신입·경력') || text.includes('신입/경력')) {
    return { careerMin: null, careerMax: null, careerText: '신입·경력' };
  }
  if (text.includes('신입')) return { careerMin: 0, careerMax: 0, careerText: '신입' };

  return { careerMin: null, careerMax: null, careerText: null };
}
