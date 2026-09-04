import type { JobPosting, SiteAdapterResult } from './types';

/**
 * 잡코리아 비공식. 로그인 불필요, 실검증 완료(2026-09).
 *
 * 검색 자체는 평범한 GET이다: /Search/?stext=<키워드>&careerType=2&careerMin=<x>&careerMax=<y>
 * 이 페이지는 Next.js RSC(App Router) 응답이라 결과 JSON이 눈에 보이는 HTML이 아니라
 * `self.__next_f.push([1, "..."])` 형태로 문서 안에 이스케이프된 문자열로 박혀 있다.
 * 각 push 호출의 두 번째 원소는 그 자체로 유효한 JSON 문자열이라, 배열 리터럴
 * `[1, "..."]`을 그대로 JSON.parse하면 이스케이프가 풀린 원문(React Flight 텍스트)을
 * 얻을 수 있다. 그 안에서 `{"id":"...","legacyJobNo":"..."...}` 형태의 공고 객체를
 * 중괄호 매칭으로 잘라내 다시 JSON.parse한다.
 *
 * 지역/고용형태 코드는 실검증으로 확인함(2026-09 기준, 페이지 안에 코드표가 통째로
 * 내려온다): area I010=강남구, I150=서초구 / employment 1=정규직(코드가 "1/..."로 시작).
 * 지역은 서버 쿼리 파라미터로 넘기는 방법을 찾지 못해(시도한 이름 모두 무반응)
 * 키워드+경력만 서버에 넘기고, 지역은 각 공고의 areaCodeList로 클라이언트에서 거른다.
 *
 * 비공식 API라 사전 통보 없이 바뀔 수 있다.
 */

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

const KEYWORDS = ['회계', '경영지원'];
const AREA_CODES = ['I010', 'I150']; // 강남구, 서초구
const CAREER_MIN = 5;
const CAREER_MAX = 6;

interface RawJob {
  id?: string;
  legacyJobNo?: string;
  title?: string;
  postingCompanyName?: string;
  companyName?: string;
  createdAt?: string;
  employmentTypeCodeList?: string[];
  areaCodeList?: string[];
  benefitNameList?: string[];
}

export async function fetchPostings(): Promise<SiteAdapterResult> {
  const byLegacyId = new Map<string, RawJob>();

  for (const kw of KEYWORDS) {
    const url =
      `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(kw)}` +
      `&tabType=recruit&careerType=2&careerMin=${CAREER_MIN}&careerMax=${CAREER_MAX}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`jobkorea http ${res.status}`);
    const html = await res.text();

    for (const job of extractJobObjects(html)) {
      if (job.legacyJobNo) byLegacyId.set(job.legacyJobNo, job);
    }
  }

  const postings: JobPosting[] = [];
  for (const job of byLegacyId.values()) {
    if (!job.legacyJobNo) continue;

    const inAllowedArea = (job.areaCodeList ?? []).some((c) => AREA_CODES.includes(c));
    if (!inAllowedArea) continue; // 서버 쿼리로 못 거른 지역 필터를 여기서 적용

    const employmentCodes = job.employmentTypeCodeList ?? [];
    const isRegular = employmentCodes.length > 0 ? employmentCodes.some((c) => c.startsWith('1/')) : null;

    postings.push({
      sourceSite: 'jobkorea',
      externalId: job.legacyJobNo,
      title: job.title ?? '',
      company: job.postingCompanyName ?? job.companyName ?? '',
      location: null, // areaCodeList는 이미 위에서 필터링에 썼고, 사람이 읽을 지역명 코드표는 별도 조회 필요
      employmentType: employmentCodes.join(',') || null,
      isRegular,
      careerMin: null, // 서버 쿼리(careerMin/Max)로 이미 필터링됨 — 원문 경력값은 노출되지 않음
      careerMax: null,
      careerText: `${CAREER_MIN}~${CAREER_MAX}년 검색 조건으로 조회됨`,
      jdText: null,
      perkHints: job.benefitNameList ?? [],
      url: `https://www.jobkorea.co.kr/Recruit/GI_Read/${job.legacyJobNo}`,
      postedAt: job.createdAt ?? null,
    });
  }

  return { postings };
}

/** self.__next_f.push([1, "..."]) 안의 React Flight 텍스트를 모아 legacyJobNo가 있는 객체만 추출 */
function extractJobObjects(html: string): RawJob[] {
  const decoded = decodeFlightChunks(html);
  const jobs: RawJob[] = [];

  const marker = '{"id":"';
  let searchFrom = 0;
  while (true) {
    const start = decoded.indexOf(marker, searchFrom);
    if (start === -1) break;
    const end = findMatchingBrace(decoded, start);
    if (end === -1) {
      searchFrom = start + marker.length;
      continue;
    }
    const candidate = decoded.slice(start, end + 1);
    searchFrom = end + 1;
    try {
      const obj = JSON.parse(candidate) as RawJob;
      if (obj.legacyJobNo) jobs.push(obj);
    } catch {
      // 후보가 완전한 JSON 객체가 아니었음 — 다음 후보로 계속
    }
  }
  return jobs;
}

function decodeFlightChunks(html: string): string {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\((\[.*?\])\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]) as [number, string?];
      if (typeof parsed[1] === 'string') chunks.push(parsed[1]);
    } catch {
      // 이 청크는 건너뜀
    }
  }
  return chunks.join('');
}

/** text[start]가 '{'라고 가정하고 문자열 리터럴을 건너뛰며 짝이 맞는 '}' 위치를 찾는다 */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
