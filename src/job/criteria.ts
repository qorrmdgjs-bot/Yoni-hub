import type { JobPosting } from '@job/sites/types';

/**
 * 채용공고 알림의 필터 기준. 전부 사용자가 직접 정한 값이라 코드가 아니라
 * 상수로 분리해 둔다 — 조건이 바뀌면 이 파일만 고치면 된다. 화면에도 이 값들을
 * 그대로 보여준다(값을 두 곳에 따로 적으면 반드시 어긋난다).
 */

export const KEYWORDS = ['회계', '경영지원'];
export const ALLOWED_LOCATIONS = ['강남구', '서초구'];
export const CAREER_MIN = 5;
export const CAREER_MAX = 6;

/** 공고 텍스트에서 감지할 "좋은 복리후생" 키워드 — 알림에 참고 태그로만 표시, 필터 아님 */
export const PERK_KEYWORDS = [
  '재택근무',
  '유연근무',
  '자율출퇴근',
  '주4.5일',
  '주 4.5일',
  '리프레시 휴가',
  '안식휴가',
  '정시퇴근',
  '스톡옵션',
  '동호회',
  '워라밸',
];

/** 잡플래닛 평점 → 추천 등급. 2점 미만은 알림에서 제외(사용자가 확정한 기본값) */
export type RecommendTier = 'strong' | 'normal' | 'excluded' | null;

export function tierFromRating(rating: number | null): RecommendTier {
  if (rating === null) return null; // 평점 정보 없음 — 제외하지 않음
  if (rating >= 3) return 'strong';
  if (rating >= 2) return 'normal';
  return 'excluded';
}

/**
 * 직무·지역·고용형태·경력 하드 필터.
 *
 * 키워드는 제목+JD 텍스트에 대한 부분일치라, JD 텍스트를 못 받아온 사이트(잡코리아 등)의
 * 공고는 제목에 "회계"/"경영지원"이 literal하게 없으면 걸러진다 — 놓치는 쪽(false negative)이
 * 엉뚱한 알림(false positive)보다 낫다는 판단.
 */
export function matchesCriteria(p: JobPosting): boolean {
  const haystack = `${p.title} ${p.jdText ?? ''}`;
  if (!KEYWORDS.some((k) => haystack.includes(k))) return false;

  const location = p.location ?? '';
  if (location && !locationAllowed(location)) return false;
  // location이 아예 없는 사이트(예: 잡코리아는 코드로만 걸러 텍스트가 없음)는 이미
  // 어댑터 단에서 지역 필터를 마쳤다고 보고 여기서는 통과시킨다.

  if (p.isRegular === false) return false; // 명시적으로 정규직이 아니면 제외

  // 상시채용은 실제로 사람을 급히 뽑는 공고가 아니라 상시 게시물에 가까워 제외한다.
  // 사이트가 명시한 경우만 걸린다 — alwaysOpen 주석 참고.
  if (p.alwaysOpen) return false;

  if (!careerOverlaps(p.careerMin, p.careerMax)) return false;

  return true;
}

/**
 * 근무지가 **전부** 허용 지역인지. 강남구 공고에 다른 지역이 함께 붙어 있으면 제외한다
 * (사용자 요청 — 강남구·서초구만 출퇴근 가능하므로 "강남 외 1곳"은 지원 대상이 아니다).
 *
 * 여러 지역을 한 필드에 담는 건 잡코리아(", " 구분)와 리멤버("; " 구분)뿐이지만,
 * 구분자는 사이트가 바꿀 수 있어 흔한 것들을 다 나눠 본다.
 */
export function locationAllowed(location: string): boolean {
  const segments = location
    .split(/[;,/·\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return false;

  let hasAllowed = false;
  for (const seg of segments) {
    // 서울 밖 광역 단위가 먼저다 — "경기 경기전체"처럼 구/시/군 접미사가 없는 표기는
    // 아래 hasOtherDistrict로는 안 잡힌다.
    if (OTHER_REGIONS.some((r) => seg.includes(r))) return false;

    if (ALLOWED_LOCATIONS.some((l) => seg.includes(l))) {
      hasAllowed = true;
      continue;
    }
    // 허용 지역이 아닌데 구/시/군 이름이 적혀 있으면 "다른 지역이 추가로" 있는 것.
    if (hasOtherDistrict(seg)) return false;
    // 그 외(예: "서울"만 적힌 조각, 도로명 조각)는 판단 보류 — 다른 조각에 맡긴다.
  }

  return hasAllowed;
}

/**
 * 서울 밖 광역 지자체 이름. 사람인은 "경기 경기전체", 잡코리아는 "경기도"·"충청북도"처럼
 * 구/시/군 단위가 아닌 표기를 쓰는데, 이게 붙어 있으면 근무지가 강남·서초로 한정되지 않는다.
 * (실제로 킴스인더스트리 "서울전체 , 강남구 , 경기 경기전체"가 이 규칙 없이 통과했다.)
 */
const OTHER_REGIONS = [
  '경기',
  '인천',
  '부산',
  '대구',
  '광주',
  '대전',
  '울산',
  '세종',
  '강원',
  '충북',
  '충남',
  '충청',
  '전북',
  '전남',
  '전라',
  '경북',
  '경남',
  '경상',
  '제주',
  '전국',
];

/** "성남시"·"마포구"처럼 구/시/군 단위 지명이 들어 있는지. 광역시 이름 자체는 지명으로 안 친다 */
function hasOtherDistrict(segment: string): boolean {
  const METRO_NAMES = ['서울시', '서울특별시'];
  for (const m of segment.matchAll(/[가-힣]{2,}(?:구|시|군)(?![가-힣])/g)) {
    if (!METRO_NAMES.includes(m[0])) return true;
  }
  return false;
}

function careerOverlaps(min: number | null, max: number | null): boolean {
  const lo = min ?? 0;
  const hi = max ?? Infinity;
  return lo <= CAREER_MAX && hi >= CAREER_MIN;
}

/** jdText + 사이트가 이미 구조화해 준 perkHints(예: 잡코리아 benefitNameList)를 합쳐 태깅 */
export function detectPerkTags(p: JobPosting): string[] {
  const text = p.jdText ?? '';
  const found = new Set<string>(p.perkHints);
  for (const k of PERK_KEYWORDS) {
    if (text.includes(k)) found.add(k);
  }
  return [...found];
}

/** 알림·화면에 그대로 노출할 추천 사유 문장 조립 */
export function buildReason(
  p: JobPosting,
  rating: number | null,
  tier: RecommendTier,
  perkTags: string[],
): string {
  const parts: string[] = [];
  const matchedKeyword = KEYWORDS.find((k) => p.title.includes(k) || (p.jdText ?? '').includes(k));
  if (matchedKeyword) parts.push(`${matchedKeyword} 직무`);
  if (p.location) parts.push(p.location);
  if (p.employmentType) parts.push(p.employmentType);
  if (p.careerText) parts.push(p.careerText);

  if (rating !== null) {
    const tierLabel = tier === 'strong' ? '강력추천' : tier === 'normal' ? '추천' : tier === 'excluded' ? '비추천' : '';
    parts.push(`잡플래닛 ${rating.toFixed(1)}점${tierLabel ? `(${tierLabel})` : ''}`);
  } else {
    parts.push('잡플래닛 평점 정보 없음');
  }

  if (perkTags.length > 0) parts.push(`복리후생: ${perkTags.join(', ')}`);

  return parts.join(' · ');
}

/**
 * "내가 다니고 싶은 회사" — 이직의 기준(정성적, 기계 판별 불가).
 * 예전 src/job/data/seed/criteria.ts를 그대로 보존해 화면 하단 참고용으로 옮겼다.
 */
export interface Criterion {
  mark: string;
  title: string;
  points: string[];
}

export interface CriteriaGroup {
  id: 'inner' | 'outer';
  title: string;
  subtitle: string;
  why: string;
  items: Criterion[];
}

export const CRITERIA_SUMMARY =
  '존경할 수 있는 리더와 좋은 동료 속에서 재무·회계 전문성을 키우며 성장하고, ' +
  '성과에 맞는 보상을 받으면서 건강한 문화와 쾌적한 환경에서 오래 일할 수 있는 회사.';

export const CRITERIA_GROUPS: CriteriaGroup[] = [
  {
    id: 'inner',
    title: '내적 가치',
    subtitle: '성장과 보람',
    why: '연봉이 같아도 몇 년 뒤의 내가 달라지는 부분입니다. 면접에서 반드시 확인하세요.',
    items: [
      {
        mark: '①',
        title: '더 나은 회사',
        points: [
          '장기적으로 성장하는 회사',
          '구성원을 존중하고 신뢰하는 회사',
          '회사의 비전과 방향성에 공감할 수 있는 회사',
        ],
      },
      {
        mark: '②',
        title: '함께 성장하는 동료',
        points: ['실력 있고 협업이 잘 되는 동료', '서로 배우고 도와주는 문화', '긍정적인 에너지를 주는 사람들과 함께 일하는 환경'],
      },
      {
        mark: '③',
        title: '배울 수 있는 리더',
        points: ['존경할 수 있는 임원과 상사', '업무뿐 아니라 사고방식까지 배울 수 있는 리더', '피드백을 통해 성장할 수 있는 조직'],
      },
      {
        mark: '④',
        title: '나 자신의 성장',
        points: ['새로운 업무를 지속적으로 경험', '전문성을 키울 수 있는 환경', '이전보다 더 나은 사람이 되고 있다는 확신'],
      },
      {
        mark: '⑤',
        title: '합당한 보상',
        points: ['성과에 맞는 연봉과 보상', '경제적 여유를 만들 수 있는 급여 수준', '노력한 만큼 인정받는 회사'],
      },
    ],
  },
  {
    id: 'outer',
    title: '외적 환경',
    subtitle: '근무 만족도',
    why: '매일 반복되기 때문에 작아 보여도 오래 다닐 수 있느냐를 실제로 가릅니다.',
    items: [
      {
        mark: '①',
        title: '문화',
        points: ['불필요한 야근이 없는 문화', '정시 퇴근이 자연스러운 조직', '업무와 개인 생활의 균형을 존중하는 회사'],
      },
      {
        mark: '②',
        title: '근무환경',
        points: ['깨끗하고 쾌적한 사무실', '관리가 잘 된 건물', '업무에 집중할 수 있는 공간'],
      },
      {
        mark: '③',
        title: '위치',
        points: ['출퇴근이 너무 멀지 않은 곳', '생활권 안에서 이동 가능한 거리', '너무 집과 붙어 있지는 않은 적당한 거리'],
      },
      {
        mark: '④',
        title: '업무',
        points: [
          '재무·회계 중심의 전문성을 살릴 수 있는 업무',
          '경영지원 전반을 이해하면서도 재무·회계 역량을 핵심으로 활용할 수 있는 역할',
          '숫자를 기반으로 회사의 의사결정에 기여하는 업무',
        ],
      },
    ],
  },
];
