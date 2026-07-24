import type { AppData, Application } from '@job/schema/entities';

/**
 * 달력에 찍을 날짜별 이벤트.
 *
 * 파생값이므로 순수 함수로만 만든다 (스토어에 캐시하지 않는다 — 규칙 2).
 * 지원 건의 날짜 필드를 그대로 펼치기 때문에 지원 현황에서 날짜를 고치면
 * 홈 달력이 즉시 따라온다. 별도 '일정' 엔티티를 만들면 이 동기화가 깨진다.
 */

export type CalendarEventKind = 'deadline' | 'event' | 'applied';

export interface CalendarEvent {
  app: Application;
  kind: CalendarEventKind;
  /** 'yyyy-MM-dd' */
  date: string;
  label: string;
}

/** 같은 날 안에서의 표시 순서 — 급한 것부터 */
const KIND_ORDER: Record<CalendarEventKind, number> = { deadline: 0, event: 1, applied: 2 };

export const CALENDAR_KIND_LABEL: Record<CalendarEventKind, string> = {
  deadline: '마감',
  event: '일정',
  applied: '지원',
};

export function buildCalendarEvents(data: AppData): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();

  const push = (date: string | undefined, event: Omit<CalendarEvent, 'date'>) => {
    if (!date) return;
    const list = map.get(date);
    const entry: CalendarEvent = { ...event, date };
    if (list) list.push(entry);
    else map.set(date, [entry]);
  };

  for (const app of Object.values(data.applications)) {
    const closed = app.stage === 'closed';

    // 종료된 건의 마감일·다음 일정은 이미 의미가 없다. 달력만 어지럽힌다.
    if (!closed) {
      push(app.deadlineAt, { app, kind: 'deadline', label: '공고 마감' });
      push(app.nextEventAt, { app, kind: 'event', label: app.nextEventNote || '일정' });
    }
    // 지원일은 종료된 건도 남긴다 — "그 주에 몇 개나 넣었나"는 지나간 기록이라야 의미가 있다.
    push(app.appliedAt, { app, kind: 'applied', label: '지원함' });
  }

  for (const list of map.values()) {
    list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.app.company.localeCompare(b.app.company));
  }

  return map;
}
