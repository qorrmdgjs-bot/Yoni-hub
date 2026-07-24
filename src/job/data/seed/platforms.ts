import type { PlatformId, PlatformStatus } from '@job/schema/entities';

/**
 * 플랫폼 가이드 기본 데이터.
 *
 * critical: true 인 체크리스트 항목은 "현직 노출 차단" 항목이다.
 * 재직 중 이직에서 현 직장에 이직 사실이 새는 경로가 바로 여기고,
 * 계정 생성보다 먼저 해야 하는 일이라 화면 최상단에 빨갛게 고정한다.
 */

export type PlatformKind = 'scout' | 'apply' | 'research';

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  kind: PlatformKind;
  url: string;
  summary: string;
  tips: string[];
  checklist: { id: string; item: string; critical?: boolean; hint?: string }[];
}

export const PLATFORM_KIND_LABEL: Record<PlatformKind, string> = {
  scout: '스카웃형',
  apply: '공고 지원형',
  research: '기업 리서치',
};

export const PLATFORM_KIND_STYLE: Record<PlatformKind, string> = {
  scout: 'bg-violet-100 text-violet-700',
  apply: 'bg-blue-100 text-blue-700',
  research: 'bg-slate-200 text-slate-700',
};

export const PLATFORMS: PlatformInfo[] = [
  {
    id: 'remember',
    name: '리멤버',
    kind: 'scout',
    url: 'https://career.rememberapp.co.kr',
    summary:
      '명함 기반 경력직 특화 플랫폼. 프로필을 등록해두면 헤드헌터와 기업 인사팀이 먼저 제안을 보낸다. 경영지원 경력직에게 가장 제안이 많이 들어오는 채널.',
    tips: [
      '제안 품질은 프로필 키워드가 좌우한다. 헤드헌터는 키워드로 인재를 검색하기 때문.',
      '"결산" 같은 뭉뚱그린 표현 대신 "월결산 D+5 마감", "법인세 신고", "4대보험 취득·상실", "세무조사 대응"처럼 구체적으로 적는다.',
      '제안이 와도 즉답하지 않는다. 회사명·JD·연봉 범위를 먼저 확인하고, 서치펌 경유면 이력서 제출 동의 전에 반드시 회사명을 확인할 것.',
      '같은 회사를 여러 서치펌이 동시에 제안하는 경우가 있다. 먼저 동의한 곳 하나만 진행해야 중복 접수로 걸러지지 않는다.',
    ],
    checklist: [
      {
        id: 'block-current',
        item: '현재 재직 회사에 프로필이 노출되지 않는지 확인',
        critical: true,
        hint: '설정에서 재직 중인 회사 차단 여부를 직접 확인하세요.',
      },
      { id: 'account', item: '계정 생성 · 명함 등록' },
      { id: 'career', item: '경력 상세 입력 (담당 업무를 키워드 중심으로)' },
      { id: 'resume', item: '경력기술서 첨부' },
      { id: 'scout-on', item: '이직 의향 / 제안 받기 ON' },
      { id: 'conditions', item: '희망 직무 · 연봉 · 지역 입력' },
    ],
  },
  {
    id: 'linkedin',
    name: '링크드인',
    kind: 'scout',
    url: 'https://www.linkedin.com',
    summary:
      '외국계·대기업·글로벌 기업 리크루터가 실제로 검색하는 채널. 국내 중소기업 공고는 적지만, 외국계 경영지원 포지션을 노린다면 대체 불가.',
    tips: [
      '헤드라인에 직무 키워드를 넣는다. "경영지원 6년 | 재무·회계·세무 | 결산/세무신고/인사노무"처럼.',
      '영문 프로필을 병행하면 외국계 리크루터 검색에 잡힌다. 직무명은 Finance & Accounting, HR & General Affairs 같은 표준 표현을 쓸 것.',
      '연결(Connection)이 적으면 검색 노출이 떨어진다. 같은 직군 종사자와 연결을 늘려두면 도움이 된다.',
    ],
    checklist: [
      {
        id: 'otw-recruiters-only',
        item: 'Open to Work를 "리크루터에게만"으로 설정',
        critical: true,
        hint: '공개 #OpenToWork 배지를 켜면 현 직장 동료·상사에게 그대로 보입니다.',
      },
      {
        id: 'mute-updates',
        item: '프로필 변경 알림 OFF',
        critical: true,
        hint: 'Settings ▸ Visibility ▸ Share profile updates with your network → OFF. 끄지 않으면 프로필을 고칠 때마다 동료 피드에 뜹니다.',
      },
      { id: 'account', item: '계정 생성 · 프로필 사진 등록' },
      { id: 'headline', item: '헤드라인 · 경력 상세 작성' },
      { id: 'english', item: '영문 프로필 병행 작성' },
      { id: 'conditions', item: '희망 직무 · 지역 설정' },
    ],
  },
  {
    id: 'wanted',
    name: '원티드',
    kind: 'apply',
    url: 'https://www.wanted.co.kr',
    summary:
      'IT·스타트업 중심. 초기 멤버로 재무+인사+총무를 통합 담당하는 경영지원 포지션이 많아 올라운더 트랙(트랙 B)의 강점이 그대로 먹히는 채널.',
    tips: [
      '스타트업 경영지원은 "혼자서 다 돌려본 경험"이 핵심 셀링포인트다. 트랙 B 경력기술서를 쓸 것.',
      '합격 보상금 제도가 있다. 지인 추천으로 지원하면 추천인과 보상을 나눈다.',
      '스타트업은 재무 상태가 중요하다. 지원 전 투자 단계(시리즈 A/B)와 런웨이를 확인할 것.',
    ],
    checklist: [
      {
        id: 'block-current',
        item: '프로필 공개 범위 확인 · 현재 회사 차단 설정',
        critical: true,
        hint: '이력서가 공개 상태면 현 직장 인사팀도 검색할 수 있습니다.',
      },
      { id: 'account', item: '계정 생성' },
      { id: 'resume', item: '이력서 등록' },
      { id: 'career-doc', item: '경력기술서 업로드' },
      { id: 'conditions', item: '희망 직무 · 연봉 · 지역 입력' },
      { id: 'match', item: '매칭 제안 받기 ON' },
    ],
  },
  {
    id: 'saramin',
    name: '사람인',
    kind: 'apply',
    url: 'https://www.saramin.co.kr',
    summary:
      '국내 공고 볼륨이 가장 크다. 중소·중견기업 경영지원 공고가 압도적으로 많아 지원 건수를 채우는 주력 채널.',
    tips: [
      '이력서를 공개하면 인재검색에 노출되어 기업 인사팀의 연락이 온다. 다만 열람제한 설정이 선행되어야 한다.',
      '공고 볼륨이 큰 만큼 마감일 관리가 중요하다. 스크랩만 해두고 놓치는 경우가 가장 많다.',
      '같은 공고가 잡코리아에도 올라오는 경우가 있다. 양쪽으로 중복 지원하지 않도록 주의.',
    ],
    checklist: [
      {
        id: 'block-current',
        item: '이력서 열람제한 기업에 현재 회사 + 계열사 + 모회사 등록',
        critical: true,
        hint: '이 설정을 안 하면 현 직장 인사팀이 인재검색에서 내 이력서를 그대로 봅니다. 계열사까지 반드시 함께 등록하세요.',
      },
      { id: 'account', item: '계정 생성' },
      { id: 'resume', item: '이력서 등록' },
      { id: 'career-doc', item: '경력기술서 업로드' },
      { id: 'open', item: '이력서 공개 설정 ON (열람제한 설정 후)' },
      { id: 'conditions', item: '희망 조건 입력 · 맞춤 공고 알림 설정' },
    ],
  },
  {
    id: 'jobkorea',
    name: '잡코리아',
    kind: 'apply',
    url: 'https://www.jobkorea.co.kr',
    summary:
      '사람인과 성격이 비슷하지만 공고가 완전히 겹치지는 않는다. 두 곳을 병행해야 놓치는 공고가 없다.',
    tips: [
      '사람인에 없는 공고가 있으므로 병행 사용이 기본이다.',
      '스크랩 + 맞춤 공고 알림을 켜두고 주 1회 몰아서 확인하는 리듬이 효율적이다.',
    ],
    checklist: [
      {
        id: 'block-current',
        item: '이력서 열람차단 기업에 현재 회사 + 계열사 등록',
        critical: true,
        hint: '사람인과 별개 설정입니다. 한쪽만 막으면 의미가 없습니다.',
      },
      { id: 'account', item: '계정 생성' },
      { id: 'resume', item: '이력서 등록' },
      { id: 'career-doc', item: '경력기술서 업로드' },
      { id: 'open', item: '이력서 공개 설정 ON (열람차단 설정 후)' },
      { id: 'alert', item: '맞춤 공고 알림 설정' },
    ],
  },
  {
    id: 'jobplanet',
    name: '잡플래닛',
    kind: 'research',
    url: 'https://www.jobplanet.co.kr',
    summary:
      '지원 채널이 아니라 기업 조사 도구다. 면접 확정 후 이 회사를 어떻게 볼지 판단하는 용도로 쓴다.',
    tips: [
      '면접 후기 게시판이 핵심이다. 실제로 나온 질문을 그대로 얻을 수 있어 준비 시간을 크게 줄인다.',
      '리뷰는 퇴사자 편향이 있다. 개별 리뷰보다 반복해서 나오는 키워드만 신뢰할 것.',
      '"경영지원", "재무팀" 같은 부서명으로 리뷰를 걸러 보면 내가 갈 팀의 실제 분위기가 보인다.',
    ],
    checklist: [],
  },
  {
    id: 'creditjob',
    name: '크레딧잡',
    kind: 'research',
    url: 'https://kreditjob.com',
    summary:
      '국민연금 데이터 기반 기업 평균연봉·입퇴사자 추이. 처우협의에 들어가기 전 반드시 확인해야 하는 시세 자료.',
    tips: [
      '처우협의 전에 이 회사 평균 연봉 대비 내 제안이 어디쯤인지 확인한다. 근거 없는 희망 연봉은 협상에서 바로 무너진다.',
      '입퇴사자 추이에서 대규모 퇴사 구간이 보이면 조직 개편이나 이슈가 있었다는 뜻이다. 면접에서 조직 상황을 물어볼 근거가 된다.',
      '평균연봉은 임원 급여가 섞여 왜곡되므로 직급 수준을 감안해서 볼 것.',
    ],
    checklist: [],
  },
  {
    id: 'dart',
    name: 'DART 전자공시',
    kind: 'research',
    url: 'https://dart.fss.or.kr',
    summary:
      '금융감독원 전자공시. 재무제표·감사보고서를 직접 볼 수 있다. 재무/회계 직군 지원자만 쓸 수 있는 가장 강력한 차별화 무기.',
    tips: [
      '지원 회사의 감사보고서를 읽고 면접에 들어가면 거의 확실히 인상을 남긴다. 경영지원 지원자 중 이걸 하는 사람은 드물다.',
      '확인 포인트: 매출·영업이익 추이 / 부채비율 / 감사의견(적정 여부) / 특수관계자 거래 / 계속기업 불확실성 문단.',
      '비상장사도 외부감사 대상이면 공시된다. 중견기업은 대부분 조회 가능하다.',
      '면접 질문 소재로 직결된다. "작년 매출이 크게 늘었는데 관리 인력 충원 계획이 있는지" 같은 질문은 재무제표를 봐야 나온다.',
    ],
    checklist: [],
  },
];

export const PLATFORM_MAP = new Map(PLATFORMS.map((p) => [p.id, p]));

/** 최초 실행 시 채워 넣을 플랫폼 체크리스트 상태 */
export function seedPlatformStatuses(): Record<string, PlatformStatus> {
  const out: Record<string, PlatformStatus> = {};
  for (const p of PLATFORMS) {
    out[p.id] = {
      platformId: p.id,
      checklist: p.checklist.map((c) => ({
        id: c.id,
        item: c.item,
        done: false,
        ...(c.critical === undefined ? {} : { critical: c.critical }),
        ...(c.hint === undefined ? {} : { hint: c.hint }),
      })),
    };
  }
  return out;
}
