export type SourceSite = 'saramin' | 'wanted' | 'jobkorea' | 'remember';

export interface JobPosting {
  sourceSite: SourceSite;
  externalId: string;
  title: string;
  company: string;
  /** 사이트 원문 지역 표기 (예: "서울 강남구", "서울시 강남구 테헤란로70길 12") */
  location: string | null;
  /** 사이트 원문 고용형태 표기, 화면 표시용 */
  employmentType: string | null;
  /** 정규직 여부 확정 신호가 있으면 true/false, 사이트가 알려주지 않으면 null(관대하게 통과) */
  isRegular: boolean | null;
  /** 요구 경력 최소 연차. 신입/경력무관은 null(=0 취급) */
  careerMin: number | null;
  /** 요구 경력 최대 연차. 상한 없음/경력무관은 null(=무제한 취급) */
  careerMax: number | null;
  /** 원문 경력 표기, 화면 표시용 */
  careerText: string | null;
  /** 복리후생 키워드 감지용 원문(JD·소개·복지 텍스트) */
  jdText: string | null;
  /** 사이트가 이미 구조화된 복리후생 목록을 주는 경우(JobKorea 등) 그대로 보존 */
  perkHints: string[];
  url: string;
  postedAt: string | null;
}

export interface SiteAdapterResult {
  postings: JobPosting[];
  /** 인증 만료·키 무효 등 사람이 개입해야 하는 실패. true면 크론이 "갱신 필요" 알림을 1회만 보낸다 */
  authFailed?: boolean;
}
