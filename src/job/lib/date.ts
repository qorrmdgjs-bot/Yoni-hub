import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 날짜는 전 계층에서 문자열로만 다룬다.
 * - 날짜만: 'yyyy-MM-dd'  (지원일, 면접일, 마감일)
 * - 타임스탬프: full ISO   (createdAt, updatedAt)
 * Date 객체를 스토어/IndexedDB에 넣지 않는다 — JSON 왕복 시 타입이 달라진다.
 */

export type DateOnly = string;

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayISO(): DateOnly {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toDateOnly(d: Date): DateOnly {
  return format(d, 'yyyy-MM-dd');
}

/** 파싱 실패 시 null. 저장된 값이 손상되어도 화면이 죽지 않게. */
export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/** a - b (달력 기준 일수). 시분초는 무시한다. */
export function daysBetween(a: string, b: string): number | null {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return null;
  return differenceInCalendarDays(da, db);
}

/** target 기준 경과일. 오늘이면 0, 어제면 1. */
export function daysSince(target: string | undefined, today: string): number | null {
  if (!target) return null;
  return daysBetween(today, target);
}

export interface DDay {
  days: number;
  label: string;
  tone: 'past' | 'today' | 'urgent' | 'soon' | 'far';
}

/** 마감일 D-day. days > 0 이면 남은 일수. */
export function dDay(deadline: string | undefined, today: string): DDay | null {
  if (!deadline) return null;
  const days = daysBetween(deadline, today);
  if (days === null) return null;
  if (days < 0) return { days, label: `마감 ${-days}일 지남`, tone: 'past' };
  if (days === 0) return { days, label: 'D-DAY', tone: 'today' };
  if (days <= 3) return { days, label: `D-${days}`, tone: 'urgent' };
  if (days <= 7) return { days, label: `D-${days}`, tone: 'soon' };
  return { days, label: `D-${days}`, tone: 'far' };
}

export function formatKo(value: string | undefined, pattern = 'yyyy.MM.dd'): string {
  const d = parseDate(value);
  return d ? format(d, pattern, { locale: ko }) : '—';
}

/** '7월 23일 (수)' */
export function formatKoDay(value: string | undefined): string {
  return formatKo(value, 'M월 d일 (E)');
}

/** 월요일 시작 주간 범위. */
export function weekRange(today: string): { start: DateOnly; end: DateOnly } {
  const d = parseDate(today) ?? new Date();
  return {
    start: toDateOnly(startOfWeek(d, { weekStartsOn: 1 })),
    end: toDateOnly(endOfWeek(d, { weekStartsOn: 1 })),
  };
}

export function isWithin(value: string | undefined, start: string, end: string): boolean {
  if (!value) return false;
  return value >= start && value <= end;
}

// ─────────────────────────────────────────────────────────────
// 달력
// 'yyyy-MM' 형식의 월 앵커를 쓴다. 날짜가 문자열이라 같은 달 판정도 문자열 비교로 끝난다.
// ─────────────────────────────────────────────────────────────

/** 'yyyy-MM-dd' → 'yyyy-MM' */
export function monthOf(value: string): string {
  return value.slice(0, 7);
}

export function isInMonth(value: string, anchorMonth: string): boolean {
  return monthOf(value) === anchorMonth;
}

/** 'yyyy-MM' 앵커를 delta개월 이동. */
export function shiftMonth(anchorMonth: string, delta: number): string {
  const d = parseDate(`${anchorMonth}-01`);
  if (!d) return anchorMonth;
  return format(addMonths(d, delta), 'yyyy-MM');
}

/** '2026년 7월' */
export function formatKoMonth(anchorMonth: string): string {
  const d = parseDate(`${anchorMonth}-01`);
  return d ? format(d, 'yyyy년 M월', { locale: ko }) : anchorMonth;
}

/**
 * 달력 그리드에 그릴 날짜 목록.
 * 해당 월을 포함하는 주 전체(일요일 시작)를 채우므로 항상 7의 배수가 나온다.
 * 앞뒤로 다른 달 날짜가 섞이는데, 이건 `isInMonth()`로 흐리게 처리한다.
 */
export function monthGridDays(anchorMonth: string): DateOnly[] {
  const first = parseDate(`${anchorMonth}-01`);
  if (!first) return [];
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(first), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(first), { weekStartsOn: 0 }),
  }).map(toDateOnly);
}
