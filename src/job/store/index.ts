import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  emptyAppData,
  type AppData,
  type Application,
  type ApplicationId,
  type CareerDoc,
  type CareerDocId,
  type ClosedReason,
  type InterviewPrep,
  type InterviewPrepId,
  type InterviewReview,
  type InterviewReviewId,
  type PlatformId,
  type Recruiter,
  type RecruiterId,
  type Settings,
  type Stage,
} from '@job/schema/entities';
import { nowISO, todayISO } from '@job/lib/date';
import { createId } from '@job/lib/id';
import { normalizeCompany } from '@job/lib/company';
import type { StorageFailure } from '@job/storage/types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** 지원 건 입력값 — 파생 필드(id, 정규화 회사명, 히스토리, 타임스탬프)는 스토어가 채운다 */
export type ApplicationInput = Omit<
  Application,
  'id' | 'companyNormalized' | 'stageHistory' | 'createdAt' | 'updatedAt'
>;

export interface AppStore {
  data: AppData;
  status: 'loading' | 'ready';
  repoKind: 'idb' | 'memory' | null;
  /** 로컬 데이터가 스키마와 어긋났을 때의 경고 (데이터는 지우지 않는다) */
  loadWarning: string | null;
  saveState: SaveState;
  saveFailure: StorageFailure | null;

  // ── 내부 (persistence 계층 전용)
  _hydrated: (data: AppData, repoKind: 'idb' | 'memory', warning?: string) => void;
  _setSaveState: (state: SaveState, failure?: StorageFailure | null) => void;

  // ── 지원 건
  createApplication: (input: ApplicationInput) => ApplicationId;
  updateApplication: (id: ApplicationId, patch: Partial<ApplicationInput>) => void;
  deleteApplication: (id: ApplicationId) => void;
  /**
   * 단계 이동의 유일한 진입점.
   * 드래그앤드롭과 드롭다운이 둘 다 이 함수만 호출한다 —
   * 두 경로의 동작이 어긋나는 것을 원천 차단하기 위해서.
   */
  moveApplication: (id: ApplicationId, to: Stage, closedReason?: ClosedReason) => void;

  // ── 플랫폼 체크리스트
  toggleChecklistItem: (platformId: PlatformId, itemId: string) => void;
  addChecklistItem: (platformId: PlatformId, label: string) => void;
  removeChecklistItem: (platformId: PlatformId, itemId: string) => void;
  touchPlatformProfile: (platformId: PlatformId) => void;
  setPlatformMemo: (platformId: PlatformId, memo: string) => void;

  // ── 경력기술서 (Phase 2)
  upsertDocument: (doc: CareerDoc) => void;
  deleteDocument: (id: CareerDocId) => void;

  // ── 헤드헌터 (Phase 2)
  upsertRecruiter: (recruiter: Recruiter) => void;
  deleteRecruiter: (id: RecruiterId) => void;

  // ── 면접 (Phase 2)
  upsertInterviewPrep: (prep: InterviewPrep) => void;
  deleteInterviewPrep: (id: InterviewPrepId) => void;
  upsertInterviewReview: (review: InterviewReview) => void;
  deleteInterviewReview: (id: InterviewReviewId) => void;

  // ── 설정 / 데이터 관리
  updateSettings: (patch: Partial<Settings>) => void;
  markExported: () => void;
  replaceData: (data: AppData) => void;
  resetAll: (fresh: AppData) => void;
}

export const useAppStore = create<AppStore>()(
  immer((set) => ({
    data: emptyAppData(),
    status: 'loading',
    repoKind: null,
    loadWarning: null,
    saveState: 'idle',
    saveFailure: null,

    _hydrated: (data, repoKind, warning) =>
      set((s) => {
        s.data = data;
        s.status = 'ready';
        s.repoKind = repoKind;
        s.loadWarning = warning ?? null;
      }),

    _setSaveState: (state, failure) =>
      set((s) => {
        s.saveState = state;
        s.saveFailure = failure ?? null;
      }),

    // ── 지원 건 ────────────────────────────────────────────────
    createApplication: (input) => {
      const id = createId() as ApplicationId;
      const at = nowISO();
      set((s) => {
        s.data.applications[id] = {
          ...input,
          id,
          companyNormalized: normalizeCompany(input.company),
          stageHistory: [{ stage: input.stage, at }],
          createdAt: at,
          updatedAt: at,
        };
      });
      return id;
    },

    updateApplication: (id, patch) =>
      set((s) => {
        const app = s.data.applications[id];
        if (!app) return;
        Object.assign(app, patch);
        if (patch.company !== undefined) {
          app.companyNormalized = normalizeCompany(patch.company);
        }
        app.updatedAt = nowISO();
      }),

    deleteApplication: (id) =>
      set((s) => {
        delete s.data.applications[id];
        // 면접 회고는 지우지 않는다. 연쇄 삭제는 개인 기록 앱에서 최악이다.
        for (const review of Object.values(s.data.interviewReviews)) {
          if (review.applicationId === id) review.applicationId = undefined;
        }
        for (const recruiter of Object.values(s.data.recruiters)) {
          for (const p of recruiter.proposals) {
            if (p.applicationId === id) p.applicationId = undefined;
          }
        }
      }),

    moveApplication: (id, to, closedReason) =>
      set((s) => {
        const app = s.data.applications[id];
        if (!app) return;
        if (app.stage === to && app.closedReason === closedReason) return;

        const at = nowISO();
        const today = todayISO();

        app.stage = to;
        app.stageHistory.push({ stage: to, at });
        app.updatedAt = at;
        // 단계가 움직였다 = 최근 연락이 있었다. 무응답 카운터를 리셋한다.
        app.lastContactAt = today;

        if (to === 'applied' && !app.appliedAt) app.appliedAt = today;

        if (to === 'closed') {
          if (closedReason) app.closedReason = closedReason;
        } else {
          app.closedReason = undefined;
          app.closedNote = undefined;
        }
      }),

    // ── 플랫폼 체크리스트 ──────────────────────────────────────
    toggleChecklistItem: (platformId, itemId) =>
      set((s) => {
        const item = s.data.platformStatuses[platformId]?.checklist.find((c) => c.id === itemId);
        if (item) item.done = !item.done;
      }),

    addChecklistItem: (platformId, label) =>
      set((s) => {
        const status = s.data.platformStatuses[platformId];
        if (!status) return;
        status.checklist.push({ id: createId(), item: label, done: false });
      }),

    removeChecklistItem: (platformId, itemId) =>
      set((s) => {
        const status = s.data.platformStatuses[platformId];
        if (!status) return;
        status.checklist = status.checklist.filter((c) => c.id !== itemId);
      }),

    touchPlatformProfile: (platformId) =>
      set((s) => {
        const status = s.data.platformStatuses[platformId];
        if (status) status.lastProfileUpdate = todayISO();
      }),

    setPlatformMemo: (platformId, memo) =>
      set((s) => {
        const status = s.data.platformStatuses[platformId];
        if (status) status.memo = memo;
      }),

    // ── Phase 2 엔티티 ────────────────────────────────────────
    upsertDocument: (doc) =>
      set((s) => {
        s.data.documents[doc.id] = { ...doc, updatedAt: nowISO() };
      }),
    deleteDocument: (id) =>
      set((s) => {
        delete s.data.documents[id];
        // soft-unlink: 지원 건은 남기고 참조만 끊는다
        for (const app of Object.values(s.data.applications)) {
          if (app.documentId === id) app.documentId = undefined;
        }
      }),

    upsertRecruiter: (recruiter) =>
      set((s) => {
        s.data.recruiters[recruiter.id] = { ...recruiter, updatedAt: nowISO() };
      }),
    deleteRecruiter: (id) =>
      set((s) => {
        delete s.data.recruiters[id];
        for (const app of Object.values(s.data.applications)) {
          if (app.recruiterId === id) app.recruiterId = undefined;
        }
      }),

    upsertInterviewPrep: (prep) =>
      set((s) => {
        s.data.interviewPreps[prep.id] = { ...prep, updatedAt: nowISO() };
      }),
    deleteInterviewPrep: (id) =>
      set((s) => {
        delete s.data.interviewPreps[id];
      }),

    upsertInterviewReview: (review) =>
      set((s) => {
        s.data.interviewReviews[review.id] = { ...review, updatedAt: nowISO() };
      }),
    deleteInterviewReview: (id) =>
      set((s) => {
        delete s.data.interviewReviews[id];
      }),

    // ── 설정 / 데이터 관리 ────────────────────────────────────
    updateSettings: (patch) =>
      set((s) => {
        Object.assign(s.data.settings, patch);
      }),

    markExported: () =>
      set((s) => {
        s.data.settings.lastExportedAt = nowISO();
      }),

    replaceData: (data) =>
      set((s) => {
        s.data = data;
      }),

    resetAll: (fresh) =>
      set((s) => {
        s.data = fresh;
      }),
  })),
);

/** React 밖에서 현재 데이터를 읽어야 할 때 (자동저장, 내보내기) */
export function getAppData(): AppData {
  return useAppStore.getState().data;
}
