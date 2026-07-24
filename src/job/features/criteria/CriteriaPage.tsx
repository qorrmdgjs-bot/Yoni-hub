import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Quote, Sparkles } from 'lucide-react';
import type { Stage } from '@job/schema/entities';
import { STAGE_LABEL } from '@job/schema/labels';
import { CRITERIA_GROUPS, CRITERIA_SUMMARY, type CriteriaGroup } from '@job/data/seed/criteria';
import { useAppStore } from '@job/store';
import { Card, PageHeader } from '@job/components/ui';

/**
 * 이직의 기준을 다시 확인하는 화면.
 *
 * 읽기 전용이다. 대신 맨 아래에 **지금 판단이 필요한 지원 건**을 붙여서,
 * 벽에 붙은 문구로 끝나지 않고 실제로 결정을 내릴 때 열어보는 화면이 되게 한다.
 */

/** 이 단계에 와 있으면 기준을 다시 꺼내 볼 때다 */
const DECIDING_STAGES: readonly Stage[] = ['interview_final', 'negotiation', 'offer'];

function GroupCard({ group, index }: { group: CriteriaGroup; index: number }) {
  const Icon = group.id === 'inner' ? Sparkles : Building2;
  const accent =
    group.id === 'inner'
      ? { ring: 'border-blue-200', chip: 'bg-blue-100 text-blue-700', mark: 'text-blue-500' }
      : { ring: 'border-emerald-200', chip: 'bg-emerald-100 text-emerald-700', mark: 'text-emerald-500' };

  return (
    <Card className={`p-4 sm:p-5 ${accent.ring}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 rounded-lg p-1.5 ${accent.chip}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">
            {index}. {group.title}
            <span className="ml-1.5 text-xs font-normal text-slate-500">{group.subtitle}</span>
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{group.why}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {group.items.map((item) => (
          <div key={item.mark} className="rounded-lg bg-slate-50 p-3">
            <p className="flex items-baseline gap-1.5 text-sm font-semibold text-slate-800">
              <span className={accent.mark}>{item.mark}</span>
              {item.title}
            </p>
            <ul className="mt-1.5 space-y-1">
              {item.points.map((point) => (
                <li key={point} className="flex gap-1.5 text-xs leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CriteriaPage() {
  const data = useAppStore((s) => s.data);

  const deciding = useMemo(
    () =>
      Object.values(data.applications)
        .filter((a) => DECIDING_STAGES.includes(a.stage))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.applications],
  );

  return (
    <div className="max-w-4xl space-y-4 p-4">
      <PageHeader
        title="내가 다니고 싶은 회사"
        description="흔들릴 때, 그리고 결정하기 직전에 다시 읽으세요."
      />

      {/* 한 문장 요약 — 이 화면에서 제일 중요한 것 */}
      <Card className="border-slate-900 bg-slate-900 p-5 sm:p-6">
        <Quote size={18} className="text-slate-500" />
        <p className="mt-2 text-base leading-relaxed font-medium text-white sm:text-lg">
          {CRITERIA_SUMMARY}
        </p>
      </Card>

      {CRITERIA_GROUPS.map((group, i) => (
        <GroupCard key={group.id} group={group} index={i + 1} />
      ))}

      {/* 기준이 실제로 쓰이는 순간 — 최종면접·처우협의·오퍼 */}
      {deciding.length > 0 && (
        <Card className="border-amber-300 p-4">
          <h2 className="text-sm font-semibold text-slate-800">지금 판단이 필요한 곳</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            위 기준에 비춰 보세요. 연봉 하나만 보고 정하면 나중에 후회하는 항목이 위에 있습니다.
          </p>
          <ul className="mt-3 space-y-1.5">
            {deciding.map((app) => (
              <li
                key={app.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2"
              >
                <Link
                  to={`/pipeline/${app.id}`}
                  className="text-sm font-medium text-slate-800 hover:underline"
                >
                  {app.company}
                </Link>
                <span className="text-xs text-slate-500">{app.position || '포지션 미입력'}</span>
                <span className="ml-auto text-xs font-medium text-amber-700">
                  {STAGE_LABEL[app.stage]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
