import type { Channel, ClosedReason, PlatformId, QuestionCategory, Stage, Track } from './entities';

/** 화면에 쓰는 한국어 라벨과 색상 토큰. 데이터가 아니라 표현 계층. */

export const STAGE_LABEL: Record<Stage, string> = {
  interested: '관심',
  applied: '지원완료',
  doc_passed: '서류통과',
  assessment: '인적성/과제',
  interview1: '1차면접',
  interview_final: '임원/최종면접',
  negotiation: '처우협의',
  offer: '오퍼',
  closed: '종료',
};

/** 칸반 컬럼 헤더 색 (좌측 보더) */
export const STAGE_ACCENT: Record<Stage, string> = {
  interested: 'bg-slate-400',
  applied: 'bg-blue-500',
  doc_passed: 'bg-sky-500',
  assessment: 'bg-violet-500',
  interview1: 'bg-orange-400',
  interview_final: 'bg-orange-600',
  negotiation: 'bg-amber-500',
  offer: 'bg-emerald-500',
  closed: 'bg-slate-300',
};

export const CLOSED_REASON_LABEL: Record<ClosedReason, string> = {
  accepted: '합격 · 입사 확정',
  rejected: '불합격',
  withdrawn: '지원 포기',
  ghosted: '무응답 종료',
  declined_offer: '오퍼 거절',
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  saramin: '사람인',
  jobkorea: '잡코리아',
  wanted: '원티드',
  remember: '리멤버',
  linkedin: '링크드인',
  headhunter: '헤드헌터',
  direct: '직접 지원',
  referral: '지인 추천',
  other: '기타',
};

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  remember: '리멤버',
  linkedin: '링크드인',
  wanted: '원티드',
  saramin: '사람인',
  jobkorea: '잡코리아',
  jobplanet: '잡플래닛',
  creditjob: '크레딧잡',
  dart: 'DART 전자공시',
};

export const TRACK_LABEL: Record<Track, string> = {
  finance: '트랙 A · 재무/회계 전문가',
  generalist: '트랙 B · 경영지원 올라운더',
};

export const TRACK_SHORT: Record<Track, string> = {
  finance: '재무/회계',
  generalist: '올라운더',
};

export const QUESTION_CATEGORY_LABEL: Record<QuestionCategory, string> = {
  finance: '재무/회계/세무',
  hr: '인사/총무',
  general: '공통/인성',
  ai: 'AI·디지털',
};
