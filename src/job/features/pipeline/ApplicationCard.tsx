import { CalendarDays, CopyX, GripVertical, Plane, UserRound } from 'lucide-react';
import type { AppData, Application, Stage } from '@job/schema/entities';
import { CHANNEL_LABEL, CLOSED_REASON_LABEL, STAGE_LABEL } from '@job/schema/labels';
import { STAGES } from '@job/schema/entities';
import { dDay, formatKo } from '@job/lib/date';
import { cn } from '@job/lib/cn';
import { Badge } from '@job/components/ui';
import { stalenessFor } from '@job/store/selectors/insights';
import { duplicateCount } from './duplicateCheck';

/**
 * 단계 변경 드롭다운.
 * 데스크톱·모바일 모두 카드에 항상 노출한다 (hover 시 표시 금지).
 * 커스텀 팝오버가 아닌 네이티브 select — 모바일에서 이게 가장 쓰기 좋다.
 */
export function StageSelect({
  stage,
  onChange,
  className,
}: {
  stage: Stage;
  onChange: (next: Stage) => void;
  className?: string;
}) {
  return (
    <select
      value={stage}
      onChange={(e) => onChange(e.target.value as Stage)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="단계 변경"
      className={cn(
        'w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700',
        'focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none',
        className,
      )}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export function ApplicationCard({
  app,
  data,
  today,
  onOpen,
  onStageChange,
  dragHandle,
  dragging,
}: {
  app: Application;
  data: AppData;
  today: string;
  onOpen: () => void;
  onStageChange: (next: Stage) => void;
  dragHandle?: React.ReactNode;
  dragging?: boolean;
}) {
  const stale = stalenessFor(app, today, data.settings);
  const deadline = app.stage === 'interested' ? dDay(app.deadlineAt, today) : null;
  const dupes = duplicateCount(app, data);
  const event = dDay(app.nextEventAt, today);

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-2.5 shadow-sm transition-shadow',
        dragging ? 'opacity-40' : 'hover:shadow-md',
        stale?.level === 'danger' || dupes > 0 ? 'border-red-300' : 'border-slate-200',
      )}
    >
      <div className="flex items-start gap-1.5">
        {dragHandle}
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 cursor-pointer text-left"
          title="클릭하면 상세 정보"
        >
          <p className="truncate text-sm font-semibold text-slate-900">{app.company}</p>
          <p className="truncate text-xs text-slate-500">{app.position || '포지션 미입력'}</p>
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge tone="neutral">{CHANNEL_LABEL[app.channel]}</Badge>

        {dupes > 0 && (
          <Badge tone="red" title="같은 회사에 대한 다른 지원 건이나 헤드헌터 제안이 있습니다">
            <CopyX size={11} /> 중복 {dupes}
          </Badge>
        )}

        {deadline && (
          <Badge
            tone={deadline.tone === 'urgent' || deadline.tone === 'today' ? 'red' : deadline.tone === 'soon' ? 'orange' : 'slate'}
            title={`공고 마감 ${formatKo(app.deadlineAt)}`}
          >
            {deadline.label}
          </Badge>
        )}

        {stale && stale.level !== 'ok' && (
          <Badge tone={stale.level === 'danger' ? 'red' : 'amber'} title="마지막 연락 이후 경과일">
            {stale.label}
          </Badge>
        )}

        {app.viaSearchFirm && (
          <Badge
            tone="violet"
            title={
              app.recruiterContact ? `연락처 ${app.recruiterContact}` : '헤드헌터를 통해 진행 중입니다'
            }
          >
            <UserRound size={11} />
            {app.recruiterName
              ? `${app.recruiterName}${app.recruiterFirm ? ` · ${app.recruiterFirm}` : ''}`
              : '헤드헌터'}
          </Badge>
        )}

        {app.stage === 'closed' && app.closedReason && (
          <Badge tone="slate">{CLOSED_REASON_LABEL[app.closedReason]}</Badge>
        )}
      </div>

      {app.nextEventAt && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-600">
          <CalendarDays size={11} className="shrink-0 text-orange-500" />
          <span className="truncate">
            {formatKo(app.nextEventAt, 'M/d')} {app.nextEventNote || '일정'}
          </span>
          {event && event.days >= 0 && event.days <= 7 && (
            <span className="font-semibold text-orange-600">{event.label}</span>
          )}
          {app.needsLeave && (
            <span className="flex items-center gap-0.5 text-violet-600" title="연차 필요">
              <Plane size={10} /> 연차
            </span>
          )}
        </p>
      )}

      <div className="mt-2">
        <StageSelect stage={app.stage} onChange={onStageChange} />
      </div>
    </div>
  );
}

export function DragHandle() {
  return (
    <span className="mt-0.5 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing">
      <GripVertical size={14} />
    </span>
  );
}
