import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Plus, Search } from 'lucide-react';
import {
  CLOSED_REASONS,
  STAGES,
  type Application,
  type ApplicationId,
  type ClosedReason,
  type Stage,
} from '@job/schema/entities';
import { CLOSED_REASON_LABEL, STAGE_ACCENT, STAGE_LABEL } from '@job/schema/labels';
import { cn } from '@job/lib/cn';
import { useHasFinePointer, useIsDesktop, useToday } from '@job/lib/hooks';
import { useAppStore } from '@job/store';
import { Button, EmptyState, Field, Input, Modal, PageHeader, Select } from '@job/components/ui';
import { ApplicationCard, DragHandle } from './ApplicationCard';
import { ApplicationForm } from './ApplicationForm';

/** 가까운 일정 → 마감일 → 최근 수정 순 */
function sortApps(apps: Application[]): Application[] {
  return [...apps].sort((a, b) => {
    const ka = a.nextEventAt ?? a.deadlineAt ?? '9999-12-31';
    const kb = b.nextEventAt ?? b.deadlineAt ?? '9999-12-31';
    if (ka !== kb) return ka.localeCompare(kb);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function DraggableCard(props: {
  app: Application;
  children: (handle: React.ReactNode, dragging: boolean) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.app.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30 } : undefined}
      className="relative"
    >
      {props.children(
        <span {...listeners} {...attributes} className="touch-none">
          <DragHandle />
        </span>,
        isDragging,
      )}
    </div>
  );
}

function Column({
  stage,
  count,
  children,
}: {
  stage: Stage;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50/80 transition-colors',
        isOver ? 'border-slate-500 bg-blue-50' : 'border-slate-200',
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <span className={cn('h-2 w-2 rounded-full', STAGE_ACCENT[stage])} />
        <span className="text-sm font-semibold text-slate-800">{STAGE_LABEL[stage]}</span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
          {count}
        </span>
      </div>
      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

export function PipelinePage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const today = useToday();

  const data = useAppStore((s) => s.data);
  const moveApplication = useAppStore((s) => s.moveApplication);

  const hasFinePointer = useHasFinePointer();
  const isDesktop = useIsDesktop();

  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [mobileStage, setMobileStage] = useState<Stage>('applied');
  const [showClosed, setShowClosed] = useState(false);
  const [pendingClose, setPendingClose] = useState<ApplicationId | null>(null);
  const [closeReason, setCloseReason] = useState<ClosedReason>('rejected');

  const apps = useMemo(() => {
    const all = Object.values(data.applications);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (a) =>
        a.company.toLowerCase().includes(q) ||
        a.position.toLowerCase().includes(q) ||
        (a.memo ?? '').toLowerCase().includes(q),
    );
  }, [data.applications, query]);

  const byStage = useMemo(() => {
    const map = {} as Record<Stage, Application[]>;
    for (const stage of STAGES) map[stage] = [];
    for (const app of apps) map[app.stage]?.push(app);
    for (const stage of STAGES) map[stage] = sortApps(map[stage]);
    return map;
  }, [apps]);

  /**
   * 단계 변경의 단일 진입점.
   * 드래그앤드롭과 드롭다운이 둘 다 여기로 들어온다.
   */
  const changeStage = (id: ApplicationId, to: Stage) => {
    if (to === 'closed') {
      setPendingClose(id);
      setCloseReason('rejected');
      return;
    }
    moveApplication(id, to);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const to = event.over?.id;
    if (!to) return;
    const id = event.active.id as ApplicationId;
    const app = data.applications[id];
    if (!app || app.stage === to) return;
    changeStage(id, to as Stage);
  };

  // 터치 기기에서는 센서를 비운다.
  // 칸반 가로 스크롤과 드래그가 충돌해 스크롤이 먹통 되는 게 반쪽짜리 DnD보다 나쁘다.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const openDetail = (id: ApplicationId) => navigate(`/pipeline/${id}`);
  const closeModal = () => {
    setCreating(false);
    if (applicationId) navigate('/pipeline');
  };

  // 홈에서 '지원 건 추가'를 누르면 /pipeline/new 로 들어온다 — 탭을 옮기고 버튼을 또 누르지 않도록.
  const isNewRoute = applicationId === 'new';
  const selected = applicationId && !isNewRoute ? (data.applications[applicationId] ?? null) : null;
  const visibleStages = STAGES.filter((s) => s !== 'closed' || showClosed || byStage.closed.length > 0);

  const renderCard = (app: Application, handle?: React.ReactNode, dragging?: boolean) => (
    <ApplicationCard
      app={app}
      data={data}
      today={today}
      onOpen={() => openDetail(app.id)}
      onStageChange={(next) => changeStage(app.id, next)}
      {...(handle === undefined ? {} : { dragHandle: handle })}
      {...(dragging === undefined ? {} : { dragging })}
    />
  );

  return (
    <div className="flex h-full flex-col p-4">
      <PageHeader
        title="지원 현황"
        description={`총 ${Object.keys(data.applications).length}건 · 진행 중 ${
          Object.values(data.applications).filter((a) => a.stage !== 'closed' && a.stage !== 'interested').length
        }건`}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="회사·포지션 검색"
                className="w-44 py-1.5 pl-8 text-xs"
              />
            </div>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> 지원 건 추가
            </Button>
          </>
        }
      />

      {Object.keys(data.applications).length === 0 ? (
        <EmptyState
          title="아직 등록된 지원 건이 없습니다"
          description="관심 있는 공고를 먼저 '관심' 단계로 넣어두면 마감일 D-day가 표시됩니다."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> 첫 지원 건 추가
            </Button>
          }
        />
      ) : isDesktop ? (
        <>
          <DndContext sensors={hasFinePointer ? sensors : []} onDragEnd={onDragEnd}>
            <div className="thin-scroll flex flex-1 gap-3 overflow-x-auto pb-2">
              {visibleStages.map((stage) => (
                <Column key={stage} stage={stage} count={byStage[stage].length}>
                  {byStage[stage].map((app) => (
                    <DraggableCard key={app.id} app={app}>
                      {(handle, dragging) => renderCard(app, handle, dragging)}
                    </DraggableCard>
                  ))}
                  {byStage[stage].length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-slate-400">비어 있음</p>
                  )}
                </Column>
              ))}
            </div>
          </DndContext>
          <p className="mt-2 text-[11px] text-slate-400">
            {hasFinePointer
              ? '카드 왼쪽 손잡이를 끌어 옮기거나, 카드 아래 드롭다운으로 단계를 바꿀 수 있습니다.'
              : '카드 아래 드롭다운으로 단계를 변경하세요.'}
            {byStage.closed.length > 0 && !showClosed && (
              <button
                type="button"
                onClick={() => setShowClosed(true)}
                className="ml-2 underline underline-offset-2"
              >
                종료 {byStage.closed.length}건 보기
              </button>
            )}
          </p>
        </>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* 모바일: 칸반 대신 단계 탭 + 세로 리스트 */}
          <div className="thin-scroll -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setMobileStage(stage)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap',
                  mobileStage === stage
                    ? 'border-slate-900 bg-slate-900 font-medium text-white'
                    : 'border-slate-200 bg-white text-slate-600',
                )}
              >
                {STAGE_LABEL[stage]}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px]',
                    mobileStage === stage ? 'bg-white/20' : 'bg-slate-100',
                  )}
                >
                  {byStage[stage].length}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {byStage[mobileStage].map((app) => renderCard(app))}
            {byStage[mobileStage].length === 0 && (
              <p className="py-10 text-center text-xs text-slate-400">
                {STAGE_LABEL[mobileStage]} 단계에 지원 건이 없습니다.
              </p>
            )}
          </div>
        </div>
      )}

      {(creating || isNewRoute || selected) && (
        <ApplicationForm app={selected} open onClose={closeModal} />
      )}

      {/* 종료로 옮길 때는 사유를 반드시 받는다 — 나중에 통계의 근거가 된다 */}
      <Modal
        open={pendingClose !== null}
        onClose={() => setPendingClose(null)}
        title="종료 사유"
        size="sm"
        footer={
          <>
            <Button onClick={() => setPendingClose(null)}>취소</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingClose) moveApplication(pendingClose, 'closed', closeReason);
                setPendingClose(null);
              }}
            >
              종료 처리
            </Button>
          </>
        }
      >
        <Field label="어떻게 끝났나요?">
          <Select value={closeReason} onChange={(e) => setCloseReason(e.target.value as ClosedReason)}>
            {CLOSED_REASONS.map((r) => (
              <option key={r} value={r}>
                {CLOSED_REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <p className="mt-3 text-xs text-slate-500">
          불합격 통보 없이 연락이 끊긴 경우는 <strong>무응답 종료</strong>로 남겨두세요. 나중에
          플랫폼별 성과를 볼 때 실제 불합격과 구분됩니다.
        </p>
      </Modal>
    </div>
  );
}
