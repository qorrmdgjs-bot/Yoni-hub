import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CircleSlash, Download, Lock, Plane, Plus } from 'lucide-react';
import { PLATFORM_LABEL, STAGE_LABEL } from '@job/schema/labels';
import { formatKoDay } from '@job/lib/date';
import { useToday } from '@job/lib/hooks';
import { downloadText } from '@job/lib/download';
import { exportFilename, serializeExport } from '@job/storage/importExport';
import { useAppStore } from '@job/store';
import {
  backupStatus,
  computeSummary,
  listCriticalGaps,
  listMissedDeadlines,
  listStaleAlerts,
  listUpcoming,
} from '@job/store/selectors/insights';
import { buildCalendarEvents, CALENDAR_KIND_LABEL } from '@job/store/selectors/calendar';
import { Badge, Button, Card, PageHeader, SectionTitle } from '@job/components/ui';
import { MonthCalendar } from './MonthCalendar';

/**
 * 홈 화면.
 *
 * 원칙: **숫자가 아니라 할 일을 먼저 보여준다.**
 * "총 지원 12건"을 봐도 다음 행동이 떠오르지 않는다. "내일 면접"은 떠오른다.
 * 그래서 일정 → 경고 → 요약 숫자 순서다. 통계·그래프는 넣지 않는다
 * (지원 현황 탭을 열면 그대로 보이는 정보라 중복이고, 화면만 무거워진다).
 */

/** 누르면 지원 현황으로 넘어가는 요약 숫자 한 칸 */
function StatTile({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'orange' | 'green' }) {
  const ring = {
    blue: 'border-blue-200 bg-blue-50/60',
    orange: 'border-orange-200 bg-orange-50/60',
    green: 'border-emerald-200 bg-emerald-50/60',
  }[tone];

  return (
    <Link
      to="/pipeline"
      className={`rounded-xl border bg-white p-3.5 transition-colors hover:border-slate-400 ${ring}`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
    </Link>
  );
}

export function DashboardPage() {
  const today = useToday();
  const data = useAppStore((s) => s.data);
  const moveApplication = useAppStore((s) => s.moveApplication);
  const markExported = useAppStore((s) => s.markExported);

  /** null이면 달력 아래에 '다가오는 일정'을, 날짜가 있으면 그 날 일정을 보여준다. */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const summary = useMemo(() => computeSummary(data, today), [data, today]);
  const upcoming = useMemo(() => listUpcoming(data, today), [data, today]);
  const calendarEvents = useMemo(() => buildCalendarEvents(data), [data]);
  const selectedEvents = selectedDate ? (calendarEvents.get(selectedDate) ?? []) : [];
  const stale = useMemo(() => listStaleAlerts(data, today), [data, today]);
  const criticalGaps = useMemo(() => listCriticalGaps(data), [data]);
  const missed = useMemo(() => listMissedDeadlines(data, today), [data, today]);
  const backup = useMemo(() => backupStatus(data, today), [data, today]);

  const exportNow = () => {
    downloadText(exportFilename(), serializeExport(data));
    markExported();
  };

  const hasAlerts =
    criticalGaps.length > 0 || stale.length > 0 || missed.length > 0 || backup.level !== 'ok';

  const addButton = (
    <Link
      to="/pipeline/new"
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
    >
      <Plus size={15} /> 지원 건 추가
    </Link>
  );

  const isEmpty = summary.total === 0;

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title={formatKoDay(today)}
        description="오늘 챙길 것만 모았습니다."
        actions={addButton}
      />

      {/* 1. 달력 — 지원 현황에 넣은 날짜가 그대로 여기에 뜬다 */}
      <Card className="p-3 sm:p-4">
        <MonthCalendar
          events={calendarEvents}
          today={today}
          selected={selectedDate}
          onSelect={setSelectedDate}
        />

        <div className="mt-3 border-t border-slate-200 pt-3">
          {selectedDate ? (
            <>
              <SectionTitle
                right={
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="text-[11px] font-medium text-slate-500 underline underline-offset-2"
                  >
                    다가오는 일정 보기
                  </button>
                }
              >
                {formatKoDay(selectedDate)}
              </SectionTitle>
              {selectedEvents.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">이 날은 아무 일정도 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedEvents.map((e, i) => (
                    <li
                      key={`${e.app.id}-${e.kind}-${i}`}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2"
                    >
                      <Badge
                        tone={e.kind === 'deadline' ? 'red' : e.kind === 'event' ? 'orange' : 'slate'}
                      >
                        {CALENDAR_KIND_LABEL[e.kind]}
                      </Badge>
                      <Link
                        to={`/pipeline/${e.app.id}`}
                        className="text-xs font-medium text-slate-800 hover:underline"
                      >
                        {e.app.company}
                      </Link>
                      <span className="text-xs text-slate-600">{e.label}</span>
                      {e.kind === 'event' && e.app.needsLeave && (
                        <Badge tone="violet">
                          <Plane size={10} /> 연차
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <SectionTitle>
                <span className="flex items-center gap-1.5">
                  <CalendarClock size={14} /> 곧 있을 일
                </span>
              </SectionTitle>
              {isEmpty ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <p className="text-xs text-slate-500">
                    지원 건을 추가하면 지원일·마감일·면접일이 위 달력에 표시됩니다.
                  </p>
                  {addButton}
                </div>
              ) : upcoming.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  3주 이내 예정된 일정이 없습니다.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {upcoming.map((item, i) => (
                    <li
                      key={`${item.app.id}-${item.kind}-${i}`}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2"
                    >
                      <Badge
                        tone={
                          item.dday.tone === 'today' || item.dday.tone === 'urgent'
                            ? 'red'
                            : item.dday.tone === 'soon'
                              ? 'orange'
                              : 'slate'
                        }
                      >
                        {item.dday.label}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatKoDay(item.date)}</span>
                      <Link
                        to={`/pipeline/${item.app.id}`}
                        className="text-xs font-medium text-slate-800 hover:underline"
                      >
                        {item.app.company}
                      </Link>
                      <span className="text-xs text-slate-600">{item.label}</span>
                      {item.kind === 'deadline' && <Badge tone="slate">공고 마감</Badge>}
                      {item.app.needsLeave && (
                        <Badge tone="violet">
                          <Plane size={10} /> 연차
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Card>

      {/* 2. 챙겨야 할 것 — 정말 위험한 것만. 잘게 쪼개면 오히려 안 읽힌다. */}
      {hasAlerts && (
        <Card className="border-amber-300 p-4">
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-600" /> 챙겨야 할 것
            </span>
          </SectionTitle>

          <div className="space-y-3">
            {criticalGaps.length > 0 && (
              <div className="rounded-lg bg-red-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                  <Lock size={12} /> 현직에 이직 사실이 새어나갈 수 있습니다
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {criticalGaps.map((g) => (
                    <li key={g.platformId} className="text-[11px] text-red-700">
                      <strong>{PLATFORM_LABEL[g.platformId]}</strong> — {g.items.join(', ')}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/platforms"
                  className="mt-2 inline-block text-[11px] font-semibold text-red-800 underline underline-offset-2"
                >
                  준비 탭에서 처리하기 →
                </Link>
              </div>
            )}

            {stale.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <CircleSlash size={12} /> 오래 연락이 없는 곳
                </p>
                <ul className="space-y-1">
                  {stale.slice(0, 6).map(({ app, staleness }) => (
                    <li
                      key={app.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
                    >
                      <Link
                        to={`/pipeline/${app.id}`}
                        className="text-xs font-medium text-slate-800 hover:underline"
                      >
                        {app.company}
                      </Link>
                      <span className="text-[11px] text-slate-500">{STAGE_LABEL[app.stage]}</span>
                      <Badge tone={staleness.level === 'danger' ? 'red' : 'amber'}>
                        {staleness.label}
                      </Badge>
                      {staleness.level === 'danger' && (
                        <Button
                          size="sm"
                          className="ml-auto"
                          onClick={() => moveApplication(app.id, 'closed', 'ghosted')}
                          title="사실상 탈락으로 보고 종료 처리합니다"
                        >
                          무응답 종료
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {missed.length > 0 && (
              <p className="text-xs text-slate-600">
                <strong className="text-slate-800">마감이 지난 관심 공고 {missed.length}건</strong> —{' '}
                {missed
                  .slice(0, 3)
                  .map((a) => a.company)
                  .join(', ')}
                {missed.length > 3 && ' 외'}
              </p>
            )}

            {backup.level !== 'ok' && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2">
                <span className="text-xs text-amber-900">
                  {backup.level === 'never'
                    ? '아직 한 번도 백업하지 않았습니다.'
                    : `마지막 백업 후 ${backup.daysSinceExport}일 지났습니다.`}{' '}
                  브라우저 데이터를 지우면 모두 사라집니다.
                </span>
                <Button size="sm" className="ml-auto" onClick={exportNow}>
                  <Download size={12} /> 지금 백업
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 3. 한눈에 — 누르면 지원 현황으로. 데이터가 없으면 0만 늘어놓게 되니 숨긴다. */}
      {!isEmpty && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="진행 중" value={summary.active} tone="blue" />
          <StatTile label="면접 진행" value={summary.interviewing} tone="orange" />
          <StatTile label="처우협의 · 오퍼" value={summary.offers} tone="green" />
        </div>
      )}
    </div>
  );
}
