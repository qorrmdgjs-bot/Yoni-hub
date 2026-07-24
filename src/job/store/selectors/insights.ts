import {
  ACTIVE_STAGES,
  AWAITING_STAGES,
  type AppData,
  type Application,
  type PlatformId,
  type PlatformStatus,
  type Settings,
  type Stage,
} from '@job/schema/entities';
import { dDay, daysSince, isWithin, weekRange, type DDay } from '@job/lib/date';

/**
 * 파생 데이터는 전부 순수 함수로 계산하고 스토어에 절대 저장하지 않는다.
 * 캐시하는 순간 가져오기·수동 편집 후 원본과 어긋나고, 그 불일치는 사용자가 못 알아챈다.
 *
 * '오늘'에 의존하는 계산은 반드시 today를 인자로 받는다 (테스트 가능 + 자정 롤오버 대응).
 */

// ─────────────────────────────────────────────────────────────
// 무응답 추적
// ─────────────────────────────────────────────────────────────
export type StaleLevel = 'ok' | 'warn' | 'danger';

export interface Staleness {
  days: number;
  level: StaleLevel;
  label: string;
}

/** 지원 후 결과를 기다리는 단계에서만 경과일을 센다. */
export function stalenessFor(
  app: Application,
  today: string,
  settings: Settings,
): Staleness | null {
  if (!AWAITING_STAGES.includes(app.stage)) return null;

  const base = app.lastContactAt ?? app.appliedAt ?? app.createdAt.slice(0, 10);
  const days = daysSince(base, today);
  if (days === null || days < 0) return null;

  if (days >= settings.staleDangerDays) {
    return { days, level: 'danger', label: `${days}일 무응답` };
  }
  if (days >= settings.staleWarnDays) {
    return { days, level: 'warn', label: `${days}일 무응답` };
  }
  return { days, level: 'ok', label: `${days}일 경과` };
}

export interface StaleAlert {
  app: Application;
  staleness: Staleness;
}

/** 경고 이상인 것만, 오래된 순으로. */
export function listStaleAlerts(data: AppData, today: string): StaleAlert[] {
  const out: StaleAlert[] = [];
  for (const app of Object.values(data.applications)) {
    const s = stalenessFor(app, today, data.settings);
    if (s && s.level !== 'ok') out.push({ app, staleness: s });
  }
  return out.sort((a, b) => b.staleness.days - a.staleness.days);
}

// ─────────────────────────────────────────────────────────────
// 다가오는 일정 (면접 · 공고 마감)
// ─────────────────────────────────────────────────────────────
export interface UpcomingItem {
  app: Application;
  date: string;
  kind: 'event' | 'deadline';
  label: string;
  dday: DDay;
}

export function listUpcoming(data: AppData, today: string, withinDays = 21): UpcomingItem[] {
  const out: UpcomingItem[] = [];

  for (const app of Object.values(data.applications)) {
    if (app.stage === 'closed') continue;

    if (app.nextEventAt) {
      const d = dDay(app.nextEventAt, today);
      if (d && d.days >= 0 && d.days <= withinDays) {
        out.push({
          app,
          date: app.nextEventAt,
          kind: 'event',
          label: app.nextEventNote?.trim() || '일정',
          dday: d,
        });
      }
    }

    // 아직 지원 전인 건만 마감일이 의미가 있다.
    if (app.deadlineAt && app.stage === 'interested') {
      const d = dDay(app.deadlineAt, today);
      if (d && d.days >= 0 && d.days <= withinDays) {
        out.push({ app, date: app.deadlineAt, kind: 'deadline', label: '공고 마감', dday: d });
      }
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** 마감이 이미 지났는데 아직 관심 단계에 남아 있는 건 */
export function listMissedDeadlines(data: AppData, today: string): Application[] {
  return Object.values(data.applications).filter(
    (a) => a.stage === 'interested' && a.deadlineAt && a.deadlineAt < today,
  );
}

// ─────────────────────────────────────────────────────────────
// 요약 통계
// ─────────────────────────────────────────────────────────────
export interface Summary {
  total: number;
  active: number;
  interviewing: number;
  appliedThisWeek: number;
  weeklyTarget: number;
  offers: number;
  byStage: Record<Stage, number>;
}

const INTERVIEW_STAGES: readonly Stage[] = ['interview1', 'interview_final'];

export function computeSummary(data: AppData, today: string): Summary {
  const apps = Object.values(data.applications);
  const { start, end } = weekRange(today);

  const byStage = {} as Record<Stage, number>;
  for (const app of apps) {
    byStage[app.stage] = (byStage[app.stage] ?? 0) + 1;
  }

  return {
    total: apps.length,
    active: apps.filter((a) => ACTIVE_STAGES.includes(a.stage)).length,
    interviewing: apps.filter((a) => INTERVIEW_STAGES.includes(a.stage)).length,
    offers: apps.filter((a) => a.stage === 'offer' || a.stage === 'negotiation').length,
    appliedThisWeek: apps.filter((a) => isWithin(a.appliedAt, start, end)).length,
    weeklyTarget: data.settings.weeklyTargetApplications,
    byStage,
  };
}

// ─────────────────────────────────────────────────────────────
// 플랫폼 체크리스트 경고
// ─────────────────────────────────────────────────────────────
export interface CriticalGap {
  platformId: PlatformId;
  items: string[];
}

/** 현직 노출 차단 항목 중 미완료인 것 — 가장 먼저 처리해야 할 일 */
export function listCriticalGaps(data: AppData): CriticalGap[] {
  // 이미 퇴사했다면 현직에 들킬 일이 없다 — 이 경고 자체가 의미가 없다.
  if (!data.settings.employed) return [];
  const out: CriticalGap[] = [];
  for (const status of Object.values(data.platformStatuses)) {
    const items = status.checklist.filter((c) => c.critical && !c.done).map((c) => c.item);
    if (items.length > 0) out.push({ platformId: status.platformId, items });
  }
  return out;
}

export interface ChecklistProgress {
  done: number;
  total: number;
  criticalPending: number;
}

export function checklistProgress(status: PlatformStatus | undefined): ChecklistProgress {
  if (!status) return { done: 0, total: 0, criticalPending: 0 };
  return {
    done: status.checklist.filter((c) => c.done).length,
    total: status.checklist.length,
    criticalPending: status.checklist.filter((c) => c.critical && !c.done).length,
  };
}

/** 프로필을 마지막으로 갱신한 지 오래된 플랫폼 */
export function listStaleProfiles(data: AppData, today: string): PlatformId[] {
  const limit = data.settings.profileRefreshDays;
  const out: PlatformId[] = [];
  for (const status of Object.values(data.platformStatuses)) {
    if (status.checklist.length === 0) continue; // 리서치 도구는 대상 아님
    if (!status.lastProfileUpdate) continue;
    const days = daysSince(status.lastProfileUpdate, today);
    if (days !== null && days >= limit) out.push(status.platformId);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 백업 유도
// ─────────────────────────────────────────────────────────────
export interface BackupStatus {
  daysSinceExport: number | null;
  level: 'never' | 'ok' | 'warn';
}

/** 브라우저 데이터 삭제가 이 앱의 가장 현실적인 전손 시나리오다. */
export function backupStatus(data: AppData, today: string): BackupStatus {
  const last = data.settings.lastExportedAt;
  if (!last) return { daysSinceExport: null, level: 'never' };
  const days = daysSince(last.slice(0, 10), today);
  if (days === null) return { daysSinceExport: null, level: 'never' };
  return { daysSinceExport: days, level: days >= 7 ? 'warn' : 'ok' };
}
