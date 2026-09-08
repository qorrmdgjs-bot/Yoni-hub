/**
 * 잡플래닛 회사 평점 조회 (채용공고가 아니라 "외적 환경" 참고 정보 전용).
 *
 * GET /search/companies?query=<회사명> — 로그인 불필요, 실검증 완료(2026-09).
 * Cloudflare가 앞에 있어 Referer/Accept-Language 없이 맨 UA만 보내면 403이 난다
 * (실검증 확인) — 아래 헤더 세트를 그대로 유지할 것.
 *
 * 응답 HTML 안에 `"company_id":...,"name":"...",...,"rate_total_avg":3.8,...,"tags":[...]`
 * 형태로 회사 카드 목록이 그대로 박혀 있어 정규식으로 바로 뽑을 수 있다(RSC 이스케이프
 * 없이 일반 텍스트로 내려옴). 회사명이 여러 개 매칭되면 정규화한 이름이 정확히
 * 일치하는 첫 카드를 쓰고, 없으면 첫 번째 카드를 근사치로 쓴다.
 *
 * 호출 쪽(크론 라우트)에서 jobplanet_ratings_cache로 캐싱해 같은 회사를 매 사이클
 * 반복 조회하지 않도록 한다 — 평점은 자주 안 바뀌고, 과도한 조회는 차단 위험을 키운다.
 */

import { normalizeCompany } from '@job/lib/company';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://www.jobplanet.co.kr/',
};

export interface JobplanetRating {
  rating: number;
  url: string;
  tags: string[];
}

interface CompanyCard {
  name: string;
  companyId: number;
  rating: number;
  tags: string[];
}

export async function fetchCompanyRating(companyName: string): Promise<JobplanetRating | null> {
  // 직접 조회가 되는 환경(로컬 등)에서는 그대로 쓰고, 차단당하면 리더 프록시로 넘어간다.
  let cards: CompanyCard[];
  try {
    cards = await fetchCardsDirect(companyName);
  } catch {
    cards = await fetchCardsViaReader(companyName);
  }

  if (cards.length === 0) return null;

  // 회사명이 정확히 같을 때만 채택한다. 잡플래닛 검색은 매칭이 없으면 인기 회사들을
  // 그냥 뱉기 때문에("그렌느" 검색 → 하림산업·ASML코리아…), 부분일치라도 허용하면
  // 엉뚱한 회사의 평점이 붙어 화면 전체의 신뢰도가 무너진다.
  // normalizeCompany가 (주)·㈜·주식회사·공백·문장부호를 지우므로 "주식회사 그렌느"와
  // "그렌느(주)"는 같은 것으로 취급되고, 그 외 이름이 다르면 평점 없음으로 둔다.
  const target = normalizeCompany(companyName);
  const best = cards.find((c) => normalizeCompany(c.name) === target);
  if (!best) return null;

  return {
    rating: best.rating,
    url: `https://www.jobplanet.co.kr/companies/${best.companyId}`,
    tags: best.tags,
  };
}

/**
 * 잡플래닛 검색창에 넣을 회사명을 다듬는다.
 *
 * 공고에 적힌 회사명을 그대로 검색하면 법인 표기 때문에 0건이 나오는 경우가 많다(실측):
 *   "㈜아이즈비전" → 0건 / "아이즈비전" → 2.8점
 *   "동양콘크리트산업㈜" → 0건 / "동양콘크리트산업" → 1.5점
 *   "주식회사 엠티데이타" → 0건
 * "(주)에이블리코퍼레이션"처럼 통과되는 표기도 있어 일괄로 떼는 편이 안전하다.
 * 매칭은 여전히 원본 이름으로 하므로(normalizeCompany) 검색만 느슨해질 뿐이다.
 */
function toSearchQuery(name: string): string {
  const cleaned = name
    .replace(/㈜|\(주\)|\(유\)|주식회사|유한회사|유한책임회사/g, ' ')
    .replace(/\([^)]*\)/g, ' ') // "(OlgodeunMuyeokCorp.)" 같은 병기 제거
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || name;
}

async function fetchCardsDirect(companyName: string): Promise<CompanyCard[]> {
  const res = await fetch(`https://www.jobplanet.co.kr/search/companies?query=${encodeURIComponent(toSearchQuery(companyName))}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`jobplanet http ${res.status}`);
  const html = await res.text();

  const cards = extractCompanyCards(html);
  // 200인데 카드가 하나도 안 잡히고 평점 필드 자체가 없으면 차단·챌린지 페이지를 받은 것이다.
  // "정말 없는 회사"(빈 배열)와 구분해서 에러로 올려야 프록시 폴백이 걸린다.
  if (cards.length === 0 && !html.includes('rate_total_avg')) {
    throw new Error(`jobplanet blocked or markup changed (len=${html.length})`);
  }
  return cards;
}

/**
 * 잡플래닛은 Cloudflare로 데이터센터 IP를 막는다 — Vercel에서 직접 부르면 403이 뜬다
 * (실측: 60건 시도 60건 403, 같은 요청이 로컬에서는 100% 200).
 * 그래서 공개 리더 프록시를 경유한다.
 *
 * `x-engine: direct`가 핵심이다. 이게 없으면 프록시가 헤드리스 브라우저로 페이지를
 * 렌더링해서 건당 16초씩 걸리는데, 우리가 필요한 값은 이미 원본 HTML 안에 들어 있어서
 * 렌더링이 전혀 필요 없다. direct + HTML로 받으면 건당 0.6~1.1초로 끝나고,
 * 응답이 원본 HTML이라 직접 조회와 같은 파서를 그대로 쓸 수 있다.
 *
 * 제3자 서비스라 언제든 느려지거나 막힐 수 있다 — 실패는 job_adapter_health에 남는다.
 */
async function fetchCardsViaReader(companyName: string): Promise<CompanyCard[]> {
  const target = `https://www.jobplanet.co.kr/search/companies?query=${encodeURIComponent(toSearchQuery(companyName))}`;
  const headers: Record<string, string> = { 'x-engine': 'direct', 'x-return-format': 'html' };
  // 키 없이도 동작하지만 분당 20건 안팎으로 제한된다. JINA_API_KEY를 넣으면 한도가
  // 크게 올라가서 백필이 훨씬 빨리 끝난다(무료 키로 충분).
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;

  const res = await fetch(`https://r.jina.ai/${target}`, { headers });
  if (!res.ok) throw new Error(`jobplanet reader http ${res.status}`);
  return extractCompanyCards(await res.text());
}

function extractCompanyCards(html: string): CompanyCard[] {
  const cards: CompanyCard[] = [];
  // tags는 없는 회사가 있어서 필수로 걸면 안 된다 — 예전 정규식은 tags를 요구하는 바람에
  // 평점이 멀쩡히 있는 회사(꽃길코리아 3.9 등)를 통째로 놓쳤다.
  const re = /"company_id":(\d+),"name":"([^"]+)"[\s\S]{0,600}?"rate_total_avg":([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tagsMatch = html.slice(m.index, m.index + 1200).match(/"tags":\[([^\]]*)\]/);
    const tags = tagsMatch
      ? tagsMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/^"|"$/g, ''))
          .filter(Boolean)
      : [];
    cards.push({ companyId: Number(m[1]), name: m[2], rating: Number(m[3]), tags });
  }
  return cards;
}
