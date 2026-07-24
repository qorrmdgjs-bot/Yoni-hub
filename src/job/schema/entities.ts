import { z } from 'zod';

/**
 * 타입의 단일 소스. 여기서 zod 스키마를 정의하고 z.infer로 타입을 뽑는다.
 * 손으로 쓴 interface를 따로 두면 검증 로직과 반드시 어긋난다.
 */

// ─────────────────────────────────────────────────────────────
// ID (branded) — 참조가 3종류라 평문 string이면 뒤바꿔 넣어도 컴파일이 통과한다
// ─────────────────────────────────────────────────────────────
const brandedId = <B extends string>() => z.string().min(1).brand<B>();

export const ApplicationIdSchema = brandedId<'ApplicationId'>();
export const CareerDocIdSchema = brandedId<'CareerDocId'>();
export const RecruiterIdSchema = brandedId<'RecruiterId'>();
export const InterviewPrepIdSchema = brandedId<'InterviewPrepId'>();
export const InterviewReviewIdSchema = brandedId<'InterviewReviewId'>();

export type ApplicationId = z.infer<typeof ApplicationIdSchema>;
export type CareerDocId = z.infer<typeof CareerDocIdSchema>;
export type RecruiterId = z.infer<typeof RecruiterIdSchema>;
export type InterviewPrepId = z.infer<typeof InterviewPrepIdSchema>;
export type InterviewReviewId = z.infer<typeof InterviewReviewIdSchema>;

// ─────────────────────────────────────────────────────────────
// 공용 원시값
// ─────────────────────────────────────────────────────────────
/** 'yyyy-MM-dd' */
export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'yyyy-MM-dd 형식이 아닙니다');
/** full ISO 타임스탬프 */
export const TimestampSchema = z.string().min(1);

// ─────────────────────────────────────────────────────────────
// 열거형
// ─────────────────────────────────────────────────────────────

/** 지원 파이프라인 9단계 (한국 채용 프로세스 기준) */
export const StageSchema = z.enum([
  'interested', // 관심 — 공고 스크랩, 아직 지원 전
  'applied', // 지원완료
  'doc_passed', // 서류통과
  'assessment', // 인적성 / 과제전형
  'interview1', // 1차 면접 (실무)
  'interview_final', // 임원 / 최종 면접
  'negotiation', // 처우협의 — 실제 연봉이 결정되는 구간
  'offer', // 오퍼 수령
  'closed', // 종료
]);
export type Stage = z.infer<typeof StageSchema>;
export const STAGES = StageSchema.options;

/** 진행 중으로 볼 단계 (대시보드·통계에서 사용) */
export const ACTIVE_STAGES: readonly Stage[] = [
  'applied',
  'doc_passed',
  'assessment',
  'interview1',
  'interview_final',
  'negotiation',
  'offer',
];

/** 무응답 경과일을 추적할 단계 — 지원 후 결과를 기다리는 구간 */
export const AWAITING_STAGES: readonly Stage[] = ['applied', 'doc_passed', 'assessment'];

export const ClosedReasonSchema = z.enum([
  'accepted', // 최종 합격 · 입사 확정
  'rejected', // 불합격 통보 받음
  'withdrawn', // 내가 지원 포기
  'ghosted', // 무응답으로 종료 (한국 채용에서 매우 흔함)
  'declined_offer', // 오퍼를 받았지만 거절
]);
export type ClosedReason = z.infer<typeof ClosedReasonSchema>;
export const CLOSED_REASONS = ClosedReasonSchema.options;

/** 지원 경로 */
export const ChannelSchema = z.enum([
  'saramin',
  'jobkorea',
  'wanted',
  'remember',
  'linkedin',
  'headhunter', // 서치펌 경유
  'direct', // 회사 채용 홈페이지 직접 지원
  'referral', // 지인 추천
  'other',
]);
export type Channel = z.infer<typeof ChannelSchema>;
export const CHANNELS = ChannelSchema.options;

/** 플랫폼 가이드 카드 (지원 채널 6 + 리서치 도구 2) */
export const PlatformIdSchema = z.enum([
  'remember',
  'linkedin',
  'wanted',
  'saramin',
  'jobkorea',
  'jobplanet',
  'creditjob',
  'dart',
]);
export type PlatformId = z.infer<typeof PlatformIdSchema>;
export const PLATFORM_IDS = PlatformIdSchema.options;

/** 경력기술서 투트랙 */
export const TrackSchema = z.enum([
  'finance', // 재무/회계 전문가 — 재무팀·회계팀 지원용
  'generalist', // 경영지원 올라운더 — 스타트업·경영지원팀 지원용
]);
export type Track = z.infer<typeof TrackSchema>;

export const QuestionCategorySchema = z.enum(['finance', 'hr', 'general', 'ai']);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

// ─────────────────────────────────────────────────────────────
// Application — 파이프라인 카드
// ─────────────────────────────────────────────────────────────
export const StageHistoryEntrySchema = z.object({
  stage: StageSchema,
  at: TimestampSchema,
});
export type StageHistoryEntry = z.infer<typeof StageHistoryEntrySchema>;

export const ApplicationSchema = z.object({
  id: ApplicationIdSchema,
  company: z.string(),
  /** 중복지원 감지용 정규화 회사명 (㈜·주식회사·공백 제거, 소문자) */
  companyNormalized: z.string(),
  position: z.string(),
  channel: ChannelSchema,
  stage: StageSchema,
  closedReason: ClosedReasonSchema.optional(),
  closedNote: z.string().optional(),

  /** 공고 마감일 → D-day 배지 */
  deadlineAt: DateOnlySchema.optional(),
  appliedAt: DateOnlySchema.optional(),
  /** 무응답 경과일 기준점. 단계 이동 시 자동 갱신된다. */
  lastContactAt: DateOnlySchema.optional(),
  nextEventAt: DateOnlySchema.optional(),
  nextEventNote: z.string().optional(),
  /** 재직 중이므로 면접에 연차가 필요한지 표시 */
  needsLeave: z.boolean().optional(),

  // 연봉 3분할 — 하나로 합치면 처우협의 때 협상 근거가 사라진다
  salaryCurrent: z.string().optional(),
  salaryDesired: z.string().optional(),
  salaryOffered: z.string().optional(),
  salaryNote: z.string().optional(),

  documentId: CareerDocIdSchema.optional(),
  recruiterId: RecruiterIdSchema.optional(),
  /** 서치펌 경유 여부 — 중복지원 경고 판정에 사용 */
  viaSearchFirm: z.boolean().optional(),
  /** 서치펌에 이력서 제출을 동의한 날짜 */
  resumeConsentAt: DateOnlySchema.optional(),

  // 헤드헌터 정보를 지원 건 안에 둔다.
  // 별도 CRM 탭으로 빼면 같은 회사를 CRM에 한 번, 여기에 또 한 번 입력해야 한다.
  // 헤드헌터 제안은 결국 '회사 하나 + 포지션 하나'라 지원 건 그 자체다.
  recruiterName: z.string().optional(),
  recruiterFirm: z.string().optional(),
  recruiterContact: z.string().optional(),

  jobUrl: z.string().optional(),
  /** 공고 원문 붙여넣기 — 공고가 내려가면 다시 못 본다 */
  jdText: z.string().optional(),
  memo: z.string().optional(),

  stageHistory: z.array(StageHistoryEntrySchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Application = z.infer<typeof ApplicationSchema>;

// ─────────────────────────────────────────────────────────────
// PlatformStatus — 플랫폼별 등록 체크리스트
// ─────────────────────────────────────────────────────────────
export const ChecklistItemSchema = z.object({
  id: z.string(),
  item: z.string(),
  done: z.boolean(),
  /** 현직 노출 차단 항목. 미완료 시 빨간 강조 + 대시보드 경고 */
  critical: z.boolean().optional(),
  hint: z.string().optional(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const PlatformStatusSchema = z.object({
  platformId: PlatformIdSchema,
  checklist: z.array(ChecklistItemSchema),
  lastProfileUpdate: DateOnlySchema.optional(),
  memo: z.string().optional(),
});
export type PlatformStatus = z.infer<typeof PlatformStatusSchema>;

// ─────────────────────────────────────────────────────────────
// CareerDoc — 경력기술서/자소서 버전
// (DOM의 Document와 이름이 겹치지 않도록 CareerDoc으로 명명)
// ─────────────────────────────────────────────────────────────
export const CareerDocSchema = z.object({
  id: CareerDocIdSchema,
  title: z.string(),
  track: TrackSchema,
  version: z.string(),
  body: z.string(),
  memo: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type CareerDoc = z.infer<typeof CareerDocSchema>;

// ─────────────────────────────────────────────────────────────
// Recruiter — 헤드헌터 / 스카웃 CRM
// ─────────────────────────────────────────────────────────────
export const ProposalSchema = z.object({
  id: z.string(),
  company: z.string(),
  companyNormalized: z.string(),
  position: z.string(),
  salary: z.string().optional(),
  date: DateOnlySchema,
  result: z.string().optional(),
  applicationId: ApplicationIdSchema.optional(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

export const RecruiterSchema = z.object({
  id: RecruiterIdSchema,
  name: z.string(),
  firm: z.string().optional(),
  channel: z.string(),
  contact: z.string().optional(),
  firstContactAt: DateOnlySchema.optional(),
  /** 응답성 — 누구에게 먼저 연락할지 정하는 실질 근거 */
  responsiveness: z.enum(['high', 'mid', 'low']).optional(),
  memo: z.string().optional(),
  proposals: z.array(ProposalSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Recruiter = z.infer<typeof RecruiterSchema>;

// ─────────────────────────────────────────────────────────────
// 면접
// ─────────────────────────────────────────────────────────────
export const InterviewPrepSchema = z.object({
  id: InterviewPrepIdSchema,
  question: z.string(),
  category: QuestionCategorySchema,
  myAnswer: z.string().optional(),
  starred: z.boolean().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type InterviewPrep = z.infer<typeof InterviewPrepSchema>;

export const InterviewReviewSchema = z.object({
  id: InterviewReviewIdSchema,
  applicationId: ApplicationIdSchema.optional(),
  companyLabel: z.string(),
  date: DateOnlySchema,
  questionsAsked: z.string().optional(),
  wentWell: z.string().optional(),
  toImprove: z.string().optional(),
  nextAction: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type InterviewReview = z.infer<typeof InterviewReviewSchema>;

// ─────────────────────────────────────────────────────────────
// Settings (싱글턴)
// ─────────────────────────────────────────────────────────────
export const SettingsSchema = z.object({
  weeklyTargetApplications: z.number().int().min(0),
  /** 프로필 업데이트 권장 주기(일) */
  profileRefreshDays: z.number().int().min(1),
  /** 마지막으로 JSON 내보내기를 한 시각 — 백업 유도 배지의 근거 */
  lastExportedAt: TimestampSchema.nullable(),
  /** 무응답 경고 임계값(일) */
  staleWarnDays: z.number().int().min(1),
  staleDangerDays: z.number().int().min(1),
  /**
   * 재직 중인가.
   * 이 앱은 '재직 중 이직'을 전제로 현직 노출 차단을 최우선으로 안내한다.
   * 이미 퇴사해 구직 중이면 그 안내가 전부 불필요해지므로 이 플래그로 끈다.
   */
  employed: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  weeklyTargetApplications: 3,
  profileRefreshDays: 30,
  lastExportedAt: null,
  staleWarnDays: 14,
  staleDangerDays: 30,
  employed: true,
};

// ─────────────────────────────────────────────────────────────
// 전체 데이터
// ─────────────────────────────────────────────────────────────
export const AppDataSchema = z.object({
  applications: z.record(z.string(), ApplicationSchema),
  platformStatuses: z.record(z.string(), PlatformStatusSchema),
  documents: z.record(z.string(), CareerDocSchema),
  recruiters: z.record(z.string(), RecruiterSchema),
  interviewPreps: z.record(z.string(), InterviewPrepSchema),
  interviewReviews: z.record(z.string(), InterviewReviewSchema),
  settings: SettingsSchema,
});
export type AppData = z.infer<typeof AppDataSchema>;

export type CollectionKey = keyof AppData;

export const COLLECTION_KEYS = [
  'applications',
  'platformStatuses',
  'documents',
  'recruiters',
  'interviewPreps',
  'interviewReviews',
  'settings',
] as const satisfies readonly CollectionKey[];

export function emptyAppData(): AppData {
  return {
    applications: {},
    platformStatuses: {},
    documents: {},
    recruiters: {},
    interviewPreps: {},
    interviewReviews: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}
