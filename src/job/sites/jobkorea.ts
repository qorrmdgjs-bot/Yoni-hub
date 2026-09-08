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
 * 지역/고용형태 코드는 같은 페이지 안에 코드표가 통째로 내려온다(실검증):
 * area I010=강남구, I150=서초구 / employment 1=정규직(코드가 "1/..."로 시작).
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
  jobOrIndustryCodeList?: string[];
  benefitNameList?: string[];
  applicationPeriod?: { start?: string; end?: string };
}

interface CodeNode {
  code?: string | number;
  displayName?: string;
  originName?: string;
  items?: CodeNode[];
}

export async function fetchPostings(): Promise<SiteAdapterResult> {
  // 공고에는 직무가 코드로만 들어 있어서(예: 1000207) 이름표가 따로 필요하다.
  const jobCategoryNames = await fetchJobCategoryNames();

  const byLegacyId = new Map<string, RawJob>();
  const areaNames = new Map<string, string>();

  for (const kw of KEYWORDS) {
    const url =
      `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(kw)}` +
      `&tabType=recruit&careerType=2&careerMin=${CAREER_MIN}&careerMax=${CAREER_MAX}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`jobkorea http ${res.status}`);

    const decoded = decodeFlightChunks(await res.text());
    for (const [code, name] of extractAreaNames(decoded)) areaNames.set(code, name);
    for (const job of extractJobObjects(decoded)) {
      if (job.legacyJobNo) byLegacyId.set(job.legacyJobNo, job);
    }
  }

  const postings: JobPosting[] = [];
  for (const job of byLegacyId.values()) {
    if (!job.legacyJobNo) continue;

    const areaCodes = job.areaCodeList ?? [];
    if (!areaCodes.some((c) => AREA_CODES.includes(c))) continue; // 서버 쿼리로 못 거른 지역 필터

    const employmentCodes = job.employmentTypeCodeList ?? [];
    const isRegular = employmentCodes.length > 0 ? employmentCodes.some((c) => c.startsWith('1/')) : null;

    // 잡코리아 검색은 제목이 아니라 직무·JD 기준으로 걸리기 때문에 제목에는 키워드가
    // 없는 공고가 대부분이다("종근당 수시채용" 같은 것). 제목만 보고 거르면 실제로
    // 회계 직무를 뽑는 공고까지 전부 탈락한다(실측: 9건 중 9건 탈락). 그래서 공고에
    // 붙은 직무 분류 이름을 같이 넘겨 공통 필터가 판단할 수 있게 한다.
    const jobNames = (job.jobOrIndustryCodeList ?? [])
      .map((code) => jobCategoryNames.get(String(code)))
      .filter((name): name is string => !!name);

    postings.push({
      sourceSite: 'jobkorea',
      externalId: job.legacyJobNo,
      title: job.title ?? '',
      company: job.postingCompanyName ?? job.companyName ?? '',
      location: areaCodes
        .map((c) => areaNames.get(c))
        .filter((name): name is string => !!name)
        .join(', ') || null,
      // 코드("1/0")를 그대로 화면에 내보내지 않는다.
      employmentType: isRegular === true ? '정규직' : null,
      isRegular,
      careerMin: null, // 서버 쿼리(careerMin/Max)로 이미 필터링됨 — 원문 경력값은 노출되지 않음
      careerMax: null,
      careerText: null,
      jdText: jobNames.join(' ') || null,
      perkHints: job.benefitNameList ?? [],
      url: `https://www.jobkorea.co.kr/Recruit/GI_Read/${job.legacyJobNo}`,
      postedAt: job.createdAt ?? null,
      expiresAt: job.applicationPeriod?.end ?? null,
    });
  }

  return { postings };
}

/** 직무 코드 → 이름 (예: 1000207 → 회계담당자). 트리 구조라 재귀로 편다. */
async function fetchJobCategoryNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const res = await fetch('https://www.jobkorea.co.kr/Search/api/codes/jobClassification', { headers: HEADERS });
  if (!res.ok) return map; // 이름표가 없으면 제목만으로 판단 — 조용히 넘어간다

  const walk = (nodes: CodeNode[]) => {
    for (const node of nodes) {
      const name = node.displayName || node.originName;
      if (node.code != null && name) map.set(String(node.code), name);
      if (node.items?.length) walk(node.items);
    }
  };
  walk((await res.json()) as CodeNode[]);
  return map;
}

/** 페이지에 같이 실려 오는 지역 코드표에서 코드 → 지역명을 뽑는다(I010 → 강남구). */
function extractAreaNames(decoded: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /"code":"([A-Z]\d+)","parentCode":"[^"]*","originName":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(decoded))) map.set(m[1], m[2]);
  return map;
}

function extractJobObjects(decoded: string): RawJob[] {
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
