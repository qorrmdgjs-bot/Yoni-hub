import { useState } from 'react';
import { AlertTriangle, ExternalLink, Lightbulb, Plus, RefreshCw, X } from 'lucide-react';
import type { PlatformStatus } from '@job/schema/entities';
import { cn } from '@job/lib/cn';
import { daysSince, formatKo } from '@job/lib/date';
import { useToday } from '@job/lib/hooks';
import { useAppStore } from '@job/store';
import { checklistProgress } from '@job/store/selectors/insights';
import {
  PLATFORMS,
  PLATFORM_KIND_LABEL,
  PLATFORM_KIND_STYLE,
  type PlatformInfo,
} from '@job/data/seed/platforms';
import { Badge, Button, Card, CommitInput, Checkbox, PageHeader, SectionTitle } from '@job/components/ui';

function PlatformCard({
  info,
  status,
  today,
  refreshDays,
  showCritical,
}: {
  info: PlatformInfo;
  status: PlatformStatus | undefined;
  today: string;
  refreshDays: number;
  /** 재직 중일 때만 현직 노출 차단 항목을 특별 취급(빨강·자물쇠·맨 위 고정)한다. */
  showCritical: boolean;
}) {
  const toggle = useAppStore((s) => s.toggleChecklistItem);
  const addItem = useAppStore((s) => s.addChecklistItem);
  const removeItem = useAppStore((s) => s.removeChecklistItem);
  const touch = useAppStore((s) => s.touchPlatformProfile);
  const setMemo = useAppStore((s) => s.setPlatformMemo);

  const [showTips, setShowTips] = useState(false);
  const [newItem, setNewItem] = useState('');

  const progress = checklistProgress(status);
  const isResearch = info.kind === 'research';
  // 퇴사 상태면 criticalPending은 세지 않는다.
  const criticalPending = showCritical ? progress.criticalPending : 0;

  const profileAge = status?.lastProfileUpdate ? daysSince(status.lastProfileUpdate, today) : null;
  const profileStale = profileAge !== null && profileAge >= refreshDays;

  // 재직 중일 때만 critical(현직 노출 차단) 항목을 맨 위로 고정한다.
  const items = [...(status?.checklist ?? [])].sort((a, b) => {
    if (!showCritical || !!a.critical === !!b.critical) return 0;
    return a.critical ? -1 : 1;
  });

  return (
    <Card className={cn('flex flex-col', criticalPending > 0 && 'border-red-300')}>
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-slate-900">{info.name}</h3>
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              PLATFORM_KIND_STYLE[info.kind],
            )}
          >
            {PLATFORM_KIND_LABEL[info.kind]}
          </span>
          {criticalPending > 0 && (
            <Badge tone="red">
              <AlertTriangle size={11} /> 노출 차단 {criticalPending}건 미완료
            </Badge>
          )}
          <a
            href={info.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            바로가기 <ExternalLink size={12} />
          </a>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">{info.summary}</p>

        <button
          type="button"
          onClick={() => setShowTips((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline underline-offset-2"
        >
          <Lightbulb size={12} /> 활용 포인트 {showTips ? '접기' : `${info.tips.length}개 보기`}
        </button>
        {showTips && (
          <ul className="mt-2 space-y-1.5 rounded-lg bg-amber-50 p-3">
            {info.tips.map((tip, i) => (
              <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-amber-900">
                <span className="text-amber-500">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isResearch && (
        <div className="flex-1 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              등록 체크리스트 {progress.done}/{progress.total}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          <ul className="space-y-1.5">
            {items.map((item) => {
              // 퇴사 상태면 critical 항목도 평범한 항목처럼 취급한다.
              const crit = showCritical && item.critical;
              return (
                <li
                  key={item.id}
                  className={cn(
                    'group rounded-lg px-2 py-1.5',
                    crit && !item.done && 'bg-red-50',
                    crit && item.done && 'bg-emerald-50',
                  )}
                >
                  <div className="flex items-start gap-1">
                    <Checkbox
                      checked={item.done}
                      onChange={() => toggle(info.id, item.id)}
                      className="flex-1"
                      label={
                        <span
                          className={cn(
                            'text-xs',
                            item.done ? 'text-slate-400 line-through' : 'text-slate-800',
                            crit && !item.done && 'font-semibold text-red-800',
                          )}
                        >
                          {crit && !item.done && '🔒 '}
                          {item.item}
                        </span>
                      }
                    />
                    {/* critical 항목은 시드 항목이라 재직 상태와 무관하게 삭제만 막는다. */}
                    {!item.critical && (
                      <button
                        type="button"
                        onClick={() => removeItem(info.id, item.id)}
                        aria-label="항목 삭제"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={13} className="text-slate-400 hover:text-red-500" />
                      </button>
                    )}
                  </div>
                  {item.hint && !item.done && crit && (
                    <p className="mt-0.5 pl-6 text-[11px] leading-relaxed text-red-700">
                      {item.hint}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newItem.trim()) return;
              addItem(info.id, newItem.trim());
              setNewItem('');
            }}
          >
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="항목 직접 추가"
              className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
            />
            <Button size="sm" type="submit" disabled={!newItem.trim()}>
              <Plus size={12} />
            </Button>
          </form>
        </div>
      )}

      {!isResearch && (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">
              프로필 최종 업데이트: {formatKo(status?.lastProfileUpdate)}
            </span>
            {profileStale && <Badge tone="amber">{profileAge}일 경과 · 업데이트 권장</Badge>}
            <Button size="sm" className="ml-auto" onClick={() => touch(info.id)}>
              <RefreshCw size={12} /> 오늘로 갱신
            </Button>
          </div>
          <CommitInput
            value={status?.memo ?? ''}
            onCommit={(v) => setMemo(info.id, v)}
            placeholder="메모 (계정 이메일, 설정 위치 등 — 비밀번호는 적지 마세요)"
            className="py-1.5 text-xs"
          />
        </div>
      )}
    </Card>
  );
}

export function PlatformsPage() {
  const today = useToday();
  const platformStatuses = useAppStore((s) => s.data.platformStatuses);
  const refreshDays = useAppStore((s) => s.data.settings.profileRefreshDays);
  const employed = useAppStore((s) => s.data.settings.employed);

  const channels = PLATFORMS.filter((p) => p.kind !== 'research');
  const research = PLATFORMS.filter((p) => p.kind === 'research');

  const criticalTotal = employed
    ? Object.values(platformStatuses).reduce(
        (n, s) => n + s.checklist.filter((c) => c.critical && !c.done).length,
        0,
      )
    : 0;

  return (
    <div className="p-4">
      <PageHeader
        title="준비"
        description={
          employed
            ? '채용 사이트마다 등록 상태와 현직 노출 차단을 점검합니다.'
            : '채용 사이트마다 등록 상태를 점검합니다.'
        }
      />

      {criticalTotal > 0 && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-red-800">
            <AlertTriangle size={15} /> 현직 노출 차단 설정 {criticalTotal}건이 남아 있습니다
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-red-700">
            재직 중 이직에서 현 직장에 이직 사실이 새는 가장 흔한 경로가 바로 이 설정들입니다. 계정
            생성이나 이력서 작성보다 <strong>먼저</strong> 처리하세요. 아래 자물쇠(🔒) 표시 항목이
            해당됩니다.
          </p>
        </div>
      )}

      <SectionTitle>지원 채널</SectionTitle>
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        {channels.map((info) => (
          <PlatformCard
            key={info.id}
            info={info}
            status={platformStatuses[info.id]}
            today={today}
            refreshDays={refreshDays}
            showCritical={employed}
          />
        ))}
      </div>

      <SectionTitle>
        기업 리서치 도구
        <span className="ml-2 text-xs font-normal text-slate-500">지원 채널이 아닙니다</span>
      </SectionTitle>
      <div className="grid gap-3 lg:grid-cols-2">
        {research.map((info) => (
          <PlatformCard
            key={info.id}
            info={info}
            status={platformStatuses[info.id]}
            today={today}
            refreshDays={refreshDays}
            showCritical={employed}
          />
        ))}
      </div>
    </div>
  );
}
