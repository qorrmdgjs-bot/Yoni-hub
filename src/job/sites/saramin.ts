import type { JobPosting, SiteAdapterResult } from './types';

/**
 * 사람인 공식 Open API(job-search). 4개 채용사이트 중 유일하게 정식 계약된 소스.
 *
 * access-key는 https://oapi.saramin.co.kr 에서 "이용신청" 승인을 받은 뒤
 * [Application] > [앱 등록]으로 발급받아 SARAMIN_ACCESS_KEY 환경변수에 넣는다.
 * 일일 500회 한도(초과 시 에러코드 4) — 그래서 키워드를 한 번에 묶어(회계,경영지원)
 * 사이클당 1회만 호출한다.
 *
 * 코드값은 공식 코드표에서 확인함(2026-09 기준):
 * loc_cd 101010=강남구, 101150=서초구 / job_type 1=정규직.
 *
 * 응답은 XML로 받아 정규식으로 필드를 뽑는다(공식 문서가 JSON 응답의 정확한 키
 * 표기를 예시로 보여주지 않아, XML 문서에 명시된 엘리먼트명을 그대로 신뢰하는 쪽이
 * 더 안전하다). 사이트가 API를 바꾸면 이 정규식들이 깨질 수 있다.
 */

const LOC_CODES = ['101010', '101150']; // 강남구, 서초구
const JOB_TYPE_REGULAR_CODE = '1';

export async function fetchPostings(): Promise<SiteAdapterResult> {
  const accessKey = process.env.SARAMIN_ACCESS_KEY;
  if (!accessKey) {
    // 키 미발급 상태 — 사람이 개입해야 하므로 인증 실패로 취급
    return { postings: [], authFailed: true };
  }

  const params = new URLSearchParams({
    'access-key': accessKey,
    keywords: '회계,경영지원',
    loc_cd: LOC_CODES.join(','),
    job_type: JOB_TYPE_REGULAR_CODE,
    count: '110',
    sort: 'pd',
  });

  const res = await fetch(`https://oapi.saramin.co.kr/job-search?${params.toString()}`, {
    headers: { Accept: 'application/xml' },
  });
  if (!res.ok) throw new Error(`saramin http ${res.status}`);
  const xml = await res.text();

  const resultCode = matchOne(xml, /<result>\s*<code>(\d+)<\/code>/);
  if (resultCode === '2') {
    return { postings: [], authFailed: true }; // 유효하지 않은 access-key
  }
  if (resultCode) {
    const message = matchOne(xml, /<message>([^<]*)<\/message>/) ?? '';
    throw new Error(`saramin error code ${resultCode}: ${message}`);
  }

  const jobBlocks = xml.match(/<job>[\s\S]*?<\/job>/g) ?? [];
  const postings: JobPosting[] = jobBlocks.map(parseJobBlock).filter((p): p is JobPosting => p !== null);

  return { postings };
}

function parseJobBlock(block: string): JobPosting | null {
  const id = matchOne(block, /<id>(\d+)<\/id>/);
  const url = matchOne(block, /<url>\s*([^<]*?)\s*<\/url>/);
  if (!id || !url) return null;

  const postingTs = Number(matchOne(block, /<posting-timestamp>(\d+)<\/posting-timestamp>/));
  const title = matchCdata(block, 'title');
  const companyName = matchCdata(block, 'name');
  const locationText = matchCdata(block, 'location');

  const jobTypeMatch = block.match(/<job-type code="(\d+)">([^<]*)<\/job-type>/);
  const jobTypeCode = jobTypeMatch?.[1] ?? null;
  const jobTypeText = jobTypeMatch?.[2]?.trim() ?? null;

  const expMatch = block.match(
    /<experience-level code="(\d+)"(?:\s+min="(\d+)")?(?:\s+max="(\d+)")?>([^<]*)<\/experience-level>/,
  );
  const expCode = expMatch?.[1];
  const careerMin = expMatch?.[2] ? Number(expMatch[2]) : expCode === '0' || expCode === '1' ? 0 : null;
  const careerMax = expMatch?.[3] ? Number(expMatch[3]) : null;
  const careerText = expMatch?.[4]?.trim() ?? null;

  const keyword = matchOne(block, /<keyword>\s*([^<]*?)\s*<\/keyword>/);

  return {
    sourceSite: 'saramin',
    externalId: id,
    title: title ?? '',
    company: companyName ?? '',
    location: locationText,
    employmentType: jobTypeText,
    isRegular: jobTypeCode ? jobTypeCode === JOB_TYPE_REGULAR_CODE : null,
    careerMin,
    careerMax,
    careerText,
    jdText: keyword,
    perkHints: [],
    url,
    postedAt: Number.isFinite(postingTs) && postingTs > 0 ? new Date(postingTs * 1000).toISOString() : null,
  };
}

function matchOne(text: string, re: RegExp): string | null {
  return text.match(re)?.[1]?.trim() ?? null;
}

/** <tag><![CDATA[ 값 ]]></tag> 또는 <tag>값</tag> 둘 다 처리 */
function matchCdata(text: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?\\s*([^\\]<]*?)\\s*(?:\\]\\]>)?\\s*<\\/${tag}>`);
  return text.match(re)?.[1]?.trim() ?? null;
}
