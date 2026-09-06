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
  const res = await fetch(`https://www.jobplanet.co.kr/search/companies?query=${encodeURIComponent(companyName)}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`jobplanet http ${res.status}`);
  const html = await res.text();

  const cards = extractCompanyCards(html);
  if (cards.length === 0) return null;

  const target = normalizeCompany(companyName);
  const exact = cards.find((c) => normalizeCompany(c.name) === target);
  const best = exact ?? cards[0];

  return {
    rating: best.rating,
    url: `https://www.jobplanet.co.kr/companies/${best.companyId}`,
    tags: best.tags,
  };
}

function extractCompanyCards(html: string): CompanyCard[] {
  const cards: CompanyCard[] = [];
  const re =
    /"company_id":(\d+),"name":"([^"]+)"[\s\S]{0,400}?"rate_total_avg":([\d.]+)[\s\S]{0,200}?"tags":\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tags = m[4]
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
    cards.push({ companyId: Number(m[1]), name: m[2], rating: Number(m[3]), tags });
  }
  return cards;
}
