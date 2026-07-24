import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@job/lib/cn';
import { formatKoMonth, isInMonth, monthGridDays, monthOf, shiftMonth } from '@job/lib/date';
import type { CalendarEvent, CalendarEventKind } from '@job/store/selectors/calendar';

/**
 * 홈의 월 달력.
 *
 * 모바일에서 셀 하나가 50px도 안 되기 때문에 회사명을 넣을 수 없다.
 * 그래서 **폰은 점, 데스크톱은 회사명**으로 갈랐다. 폰에서는 날짜를 눌러
 * 아래 목록에서 확인한다 — 휴대폰 달력 앱이 다 이렇게 동작해서 따로 배울 게 없다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const KIND_STYLE: Record<CalendarEventKind, { dot: string; text: string }> = {
  deadline: { dot: 'bg-red-500', text: 'text-red-600' },
  event: { dot: 'bg-orange-500', text: 'text-orange-600' },
  applied: { dot: 'bg-slate-400', text: 'text-slate-500' },
};

export function MonthCalendar({
  events,
  today,
  selected,
  onSelect,
}: {
  events: Map<string, CalendarEvent[]>;
  today: string;
  selected: string | null;
  onSelect: (date: string | null) => void;
}) {
  const [anchor, setAnchor] = useState(() => monthOf(today));

  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const isCurrentMonth = anchor === monthOf(today);

  const goToday = () => {
    setAnchor(monthOf(today));
    onSelect(null);
  };

  return (
    <div>
      {/* 월 이동 */}
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setAnchor((m) => shiftMonth(m, -1))}
          aria-label="이전 달"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[6.5rem] text-center text-sm font-bold text-slate-900 tabular-nums">
          {formatKoMonth(anchor)}
        </span>
        <button
          type="button"
          onClick={() => setAnchor((m) => shiftMonth(m, 1))}
          aria-label="다음 달"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <ChevronRight size={16} />
        </button>
        {!(isCurrentMonth && selected === null) && (
          <button
            type="button"
            onClick={goToday}
            className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            오늘
          </button>
        )}
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 border-b border-slate-200 pb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              'text-center text-[11px] font-medium',
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500',
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const dayEvents = events.get(date) ?? [];
          const inMonth = isInMonth(date, anchor);
          const isToday = date === today;
          const isSelected = date === selected;
          const weekday = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(isSelected ? null : date)}
              aria-label={`${date} ${dayEvents.length}건`}
              aria-pressed={isSelected}
              className={cn(
                'min-h-[3.25rem] border-b border-slate-100 p-1 text-left transition-colors sm:min-h-[5.5rem]',
                isSelected ? 'bg-slate-900/5 ring-1 ring-slate-900 ring-inset' : 'hover:bg-slate-50',
                !inMonth && 'opacity-35',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums',
                  isToday
                    ? 'bg-slate-900 font-bold text-white'
                    : weekday === '일'
                      ? 'text-red-500'
                      : weekday === '토'
                        ? 'text-blue-500'
                        : 'text-slate-600',
                )}
              >
                {Number(date.slice(8, 10))}
              </span>

              {/* 폰 — 점만 */}
              <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {dayEvents.slice(0, 4).map((e, i) => (
                  <span
                    key={`${e.app.id}-${e.kind}-${i}`}
                    className={cn('h-1.5 w-1.5 rounded-full', KIND_STYLE[e.kind].dot)}
                  />
                ))}
              </span>

              {/* 데스크톱 — 회사명 */}
              <span className="mt-0.5 hidden flex-col gap-px sm:flex">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <span
                    key={`${e.app.id}-${e.kind}-${i}`}
                    className={cn('truncate text-[11px] leading-tight', KIND_STYLE[e.kind].text)}
                    title={`${e.app.company} · ${e.label}`}
                  >
                    {e.kind === 'deadline' ? '마감 ' : e.kind === 'applied' ? '지원 ' : ''}
                    {e.app.company}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{dayEvents.length - 3}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> 공고 마감
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> 면접·일정
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> 지원한 날
        </span>
      </div>
    </div>
  );
}
