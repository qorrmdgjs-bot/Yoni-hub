import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Trash2 } from 'lucide-react';
import {
  CHANNELS,
  CLOSED_REASONS,
  STAGES,
  type Application,
  type ApplicationId,
  type Channel,
  type ClosedReason,
  type Stage,
} from '@job/schema/entities';
import { CHANNEL_LABEL, CLOSED_REASON_LABEL, STAGE_LABEL } from '@job/schema/labels';
import { formatKo, formatKoDay } from '@job/lib/date';
import { useAppStore, type ApplicationInput } from '@job/store';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '@job/components/ui';
import { findDuplicates, type DuplicateReport } from './duplicateCheck';

interface Draft {
  company: string;
  position: string;
  channel: Channel;
  stage: Stage;
  closedReason: ClosedReason | '';
  closedNote: string;
  deadlineAt: string;
  appliedAt: string;
  lastContactAt: string;
  nextEventAt: string;
  nextEventNote: string;
  needsLeave: boolean;
  salaryCurrent: string;
  salaryDesired: string;
  salaryOffered: string;
  salaryNote: string;
  viaSearchFirm: boolean;
  resumeConsentAt: string;
  recruiterName: string;
  recruiterFirm: string;
  recruiterContact: string;
  jobUrl: string;
  jdText: string;
  memo: string;
}

const EMPTY_DRAFT: Draft = {
  company: '',
  position: '',
  channel: 'saramin',
  stage: 'interested',
  closedReason: '',
  closedNote: '',
  deadlineAt: '',
  appliedAt: '',
  lastContactAt: '',
  nextEventAt: '',
  nextEventNote: '',
  needsLeave: false,
  salaryCurrent: '',
  salaryDesired: '',
  salaryOffered: '',
  salaryNote: '',
  viaSearchFirm: false,
  resumeConsentAt: '',
  recruiterName: '',
  recruiterFirm: '',
  recruiterContact: '',
  jobUrl: '',
  jdText: '',
  memo: '',
};

function toDraft(app: Application): Draft {
  return {
    company: app.company,
    position: app.position,
    channel: app.channel,
    stage: app.stage,
    closedReason: app.closedReason ?? '',
    closedNote: app.closedNote ?? '',
    deadlineAt: app.deadlineAt ?? '',
    appliedAt: app.appliedAt ?? '',
    lastContactAt: app.lastContactAt ?? '',
    nextEventAt: app.nextEventAt ?? '',
    nextEventNote: app.nextEventNote ?? '',
    needsLeave: app.needsLeave ?? false,
    salaryCurrent: app.salaryCurrent ?? '',
    salaryDesired: app.salaryDesired ?? '',
    salaryOffered: app.salaryOffered ?? '',
    salaryNote: app.salaryNote ?? '',
    viaSearchFirm: app.viaSearchFirm ?? false,
    resumeConsentAt: app.resumeConsentAt ?? '',
    recruiterName: app.recruiterName ?? '',
    recruiterFirm: app.recruiterFirm ?? '',
    recruiterContact: app.recruiterContact ?? '',
    jobUrl: app.jobUrl ?? '',
    jdText: app.jdText ?? '',
    memo: app.memo ?? '',
  };
}

const trimmed = (v: string): string | undefined => (v.trim() ? v.trim() : undefined);

function toInput(d: Draft): ApplicationInput {
  return {
    company: d.company.trim(),
    position: d.position.trim(),
    channel: d.channel,
    stage: d.stage,
    closedReason: d.stage === 'closed' && d.closedReason ? d.closedReason : undefined,
    closedNote: d.stage === 'closed' ? trimmed(d.closedNote) : undefined,
    deadlineAt: trimmed(d.deadlineAt),
    appliedAt: trimmed(d.appliedAt),
    lastContactAt: trimmed(d.lastContactAt),
    nextEventAt: trimmed(d.nextEventAt),
    nextEventNote: trimmed(d.nextEventNote),
    needsLeave: d.needsLeave || undefined,
    salaryCurrent: trimmed(d.salaryCurrent),
    salaryDesired: trimmed(d.salaryDesired),
    salaryOffered: trimmed(d.salaryOffered),
    salaryNote: trimmed(d.salaryNote),
    viaSearchFirm: d.viaSearchFirm || undefined,
    resumeConsentAt: trimmed(d.resumeConsentAt),
    // 체크를 껐다고 지우지 않는다. 실수로 껐다 켜면 적어둔 연락처가 그대로 돌아와야 한다.
    recruiterName: trimmed(d.recruiterName),
    recruiterFirm: trimmed(d.recruiterFirm),
    recruiterContact: trimmed(d.recruiterContact),
    jobUrl: trimmed(d.jobUrl),
    jdText: trimmed(d.jdText),
    memo: trimmed(d.memo),
  };
}

/** 중복지원 경고 패널 — 차단이 아니라 경고다. */
function DuplicatePanel({ report }: { report: DuplicateReport }) {
  if (report.hits.length === 0) return null;
  const high = report.hits.filter((h) => h.severity === 'high');
  const low = report.hits.filter((h) => h.severity === 'low');

  return (
    <div
      className={
        high.length > 0
          ? 'rounded-lg border border-red-300 bg-red-50 p-3'
          : 'rounded-lg border border-slate-300 bg-slate-50 p-3'
      }
    >
      <p
        className={`flex items-center gap-1.5 text-sm font-semibold ${high.length > 0 ? 'text-red-700' : 'text-slate-700'}`}
      >
        <AlertTriangle size={14} />
        같은 회사 기록이 {report.hits.length}건 있습니다
      </p>

      <ul className="mt-2 space-y-1.5">
        {[...high, ...low].map((h, i) => (
          <li key={i} className="text-xs">
            <span className="font-medium text-slate-800">{h.title}</span>
            <span className="text-slate-500"> — {h.detail}</span>
            {h.severity === 'low' && (
              <Badge tone="slate" className="ml-1">
                종료됨
              </Badge>
            )}
          </li>
        ))}
      </ul>

      {report.searchFirmConflict && (
        <p className="mt-2 rounded bg-red-100 px-2 py-1.5 text-[11px] leading-relaxed text-red-800">
          <strong>서치펌 경유 건과 겹칩니다.</strong> 서치펌이 이미 이력서를 제출한 회사에 직접
          지원하면 기업 인사팀이 중복 접수로 판단해 양쪽 모두 걸러낼 수 있고, 서치펌과 분쟁이 생길
          수 있습니다. 먼저 서치펌에 진행 상황을 확인하세요.
        </p>
      )}
    </div>
  );
}

/** 진행 히스토리 타임라인 */
function HistoryTimeline({ app }: { app: Application }) {
  if (app.stageHistory.length === 0) return null;
  return (
    <ol className="space-y-1.5 border-l-2 border-slate-200 pl-3">
      {[...app.stageHistory].reverse().map((h, i) => (
        <li key={`${h.at}-${i}`} className="relative text-xs">
          <span className="absolute top-1.5 -left-[17px] h-2 w-2 rounded-full bg-slate-400" />
          <span className="font-medium text-slate-800">{STAGE_LABEL[h.stage]}</span>
          <span className="ml-2 text-slate-500">{formatKoDay(h.at.slice(0, 10))}</span>
        </li>
      ))}
    </ol>
  );
}

export function ApplicationForm({
  app,
  open,
  onClose,
}: {
  app: Application | null;
  open: boolean;
  onClose: () => void;
}) {
  const data = useAppStore((s) => s.data);
  const createApplication = useAppStore((s) => s.createApplication);
  const updateApplication = useAppStore((s) => s.updateApplication);
  const moveApplication = useAppStore((s) => s.moveApplication);
  const deleteApplication = useAppStore((s) => s.deleteApplication);

  const [draft, setDraft] = useState<Draft>(() => (app ? toDraft(app) : EMPTY_DRAFT));
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showJd, setShowJd] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const duplicates = useMemo(
    () => findDuplicates(draft.company, data, app?.id),
    [draft.company, data, app?.id],
  );

  const canSave = draft.company.trim().length > 0;

  const persist = () => {
    const input = toInput(draft);
    if (app) {
      const stageChanged = draft.stage !== app.stage;
      // 단계 변경은 반드시 moveApplication을 거친다 (히스토리·최근 연락일 기록).
      const { stage: _stage, ...rest } = input;
      void _stage;
      updateApplication(app.id, rest);
      if (stageChanged) {
        moveApplication(app.id, draft.stage, input.closedReason);
      }
    } else {
      createApplication(input);
    }
    onClose();
  };

  const handleSave = () => {
    if (!canSave) return;
    // 새 지원 건이고 진행 중인 중복이 있으면 한 번 더 확인받는다.
    if (!app && duplicates.hits.some((h) => h.severity === 'high')) {
      setConfirmDuplicate(true);
      return;
    }
    persist();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={app ? `${app.company || '지원 건'} 상세` : '지원 건 추가'}
        footer={
          <>
            {app && (
              <Button
                variant="ghost"
                className="mr-auto text-red-600 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} /> 삭제
              </Button>
            )}
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave}>
              저장
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DuplicatePanel report={duplicates} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="회사명" required>
              <Input
                value={draft.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="예: 한국전자"
                autoFocus={!app}
              />
            </Field>
            <Field label="포지션">
              <Input
                value={draft.position}
                onChange={(e) => set('position', e.target.value)}
                placeholder="예: 재무팀 과장 (결산·세무)"
              />
            </Field>
            <Field label="지원 경로">
              <Select
                value={draft.channel}
                onChange={(e) => {
                  const channel = e.target.value as Channel;
                  // 경로가 헤드헌터면 서치펌 경유가 맞다. 체크를 따로 하게 두면
                  // 빠뜨렸을 때 중복지원 경고가 조용히 약해진다.
                  setDraft((d) => ({
                    ...d,
                    channel,
                    viaSearchFirm: channel === 'headhunter' ? true : d.viaSearchFirm,
                  }));
                }}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="현재 단계">
              <Select value={draft.stage} onChange={(e) => set('stage', e.target.value as Stage)}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {draft.stage === 'closed' && (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
              <Field label="종료 사유">
                <Select
                  value={draft.closedReason}
                  onChange={(e) => set('closedReason', e.target.value as ClosedReason | '')}
                >
                  <option value="">선택하세요</option>
                  {CLOSED_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {CLOSED_REASON_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="사유 메모">
                <Input
                  value={draft.closedNote}
                  onChange={(e) => set('closedNote', e.target.value)}
                  placeholder="예: 연봉 조건 미달로 거절"
                />
              </Field>
            </div>
          )}

          {/* 일정 */}
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">일정</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="공고 마감일" hint="관심 단계에서 D-day 표시">
                <Input
                  type="date"
                  value={draft.deadlineAt}
                  onChange={(e) => set('deadlineAt', e.target.value)}
                />
              </Field>
              <Field label="지원일">
                <Input
                  type="date"
                  value={draft.appliedAt}
                  onChange={(e) => set('appliedAt', e.target.value)}
                />
              </Field>
              <Field label="최근 연락일" hint="무응답 경과일의 기준">
                <Input
                  type="date"
                  value={draft.lastContactAt}
                  onChange={(e) => set('lastContactAt', e.target.value)}
                />
              </Field>
              <Field label="다음 일정">
                <Input
                  type="date"
                  value={draft.nextEventAt}
                  onChange={(e) => set('nextEventAt', e.target.value)}
                />
              </Field>
              <Field label="일정 내용" className="sm:col-span-2">
                <Input
                  value={draft.nextEventNote}
                  onChange={(e) => set('nextEventNote', e.target.value)}
                  placeholder="예: 1차 면접 14:00 (본사 3층)"
                />
              </Field>
            </div>
            <Checkbox
              className="mt-2"
              checked={draft.needsLeave}
              onChange={(v) => set('needsLeave', v)}
              label={<span className="text-xs text-slate-600">이 일정에 연차가 필요함</span>}
            />
          </fieldset>

          {/* 연봉 — 3분할이어야 처우협의에서 협상 근거가 된다 */}
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">연봉</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="현재 연봉">
                <Input
                  value={draft.salaryCurrent}
                  onChange={(e) => set('salaryCurrent', e.target.value)}
                  placeholder="예: 4,800"
                />
              </Field>
              <Field label="희망 연봉">
                <Input
                  value={draft.salaryDesired}
                  onChange={(e) => set('salaryDesired', e.target.value)}
                  placeholder="예: 5,500~6,000"
                />
              </Field>
              <Field label="제안받은 연봉">
                <Input
                  value={draft.salaryOffered}
                  onChange={(e) => set('salaryOffered', e.target.value)}
                  placeholder="예: 5,300"
                />
              </Field>
            </div>
            <Field label="성과급 · 복지 · 협상 메모" className="mt-3">
              <Textarea
                rows={2}
                value={draft.salaryNote}
                onChange={(e) => set('salaryNote', e.target.value)}
                placeholder="예: 성과급 최대 200%, 사이닝보너스 협의 가능, 식대 별도"
              />
            </Field>
          </fieldset>

          {/* 헤드헌터 — 별도 탭 대신 지원 건 안에서 관리한다 */}
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">헤드헌터</legend>
            <Checkbox
              checked={draft.viaSearchFirm}
              onChange={(v) => set('viaSearchFirm', v)}
              label={<span className="text-xs text-slate-700">헤드헌터(서치펌)를 통해 진행</span>}
            />
            {draft.viaSearchFirm && (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="헤드헌터 이름">
                    <Input
                      value={draft.recruiterName}
                      onChange={(e) => set('recruiterName', e.target.value)}
                      placeholder="예: 김OO 부장"
                    />
                  </Field>
                  <Field label="서치펌">
                    <Input
                      value={draft.recruiterFirm}
                      onChange={(e) => set('recruiterFirm', e.target.value)}
                      placeholder="예: OO서치"
                    />
                  </Field>
                  <Field label="연락처">
                    <Input
                      value={draft.recruiterContact}
                      onChange={(e) => set('recruiterContact', e.target.value)}
                      placeholder="예: 010-0000-0000 / 카톡"
                    />
                  </Field>
                </div>
                <Field
                  label="이력서 제출 동의일"
                  className="mt-3 max-w-xs"
                  hint="동의한 날짜를 남겨두면 중복 제출 분쟁 시 근거가 됩니다."
                >
                  <Input
                    type="date"
                    value={draft.resumeConsentAt}
                    onChange={(e) => set('resumeConsentAt', e.target.value)}
                  />
                </Field>
              </>
            )}
          </fieldset>

          {/* 공고 */}
          <Field label="공고 URL">
            <div className="flex gap-2">
              <Input
                value={draft.jobUrl}
                onChange={(e) => set('jobUrl', e.target.value)}
                placeholder="https://…"
              />
              {draft.jobUrl.trim() && (
                <a
                  href={draft.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-50"
                  title="새 탭에서 열기"
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </Field>

          <div>
            <button
              type="button"
              onClick={() => setShowJd((v) => !v)}
              className="text-xs font-medium text-slate-600 underline underline-offset-2"
            >
              {showJd ? '공고 원문 접기' : '공고 원문 붙여넣기 (공고가 내려가면 다시 못 봅니다)'}
            </button>
            {showJd && (
              <Textarea
                className="mt-2"
                rows={8}
                value={draft.jdText}
                onChange={(e) => set('jdText', e.target.value)}
                placeholder="채용 공고 본문을 그대로 붙여넣으세요. 면접 준비할 때 다시 씁니다."
              />
            )}
          </div>

          <Field label="메모">
            <Textarea
              rows={3}
              value={draft.memo}
              onChange={(e) => set('memo', e.target.value)}
              placeholder="면접관 이름, 분위기, 확인할 것 등"
            />
          </Field>

          {app && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">진행 히스토리</p>
              <HistoryTimeline app={app} />
              <p className="mt-2 text-[11px] text-slate-400">
                등록 {formatKo(app.createdAt.slice(0, 10))} · 수정{' '}
                {formatKo(app.updatedAt.slice(0, 10))}
              </p>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDuplicate}
        title="중복지원 확인"
        danger
        confirmLabel="그래도 추가"
        message={
          <>
            <p className="font-medium text-slate-900">
              {draft.company}에 대한 진행 중인 기록이 이미 있습니다.
            </p>
            <p className="mt-2 text-slate-600">
              서치펌 경유 건과 직접 지원이 겹치면 기업 인사팀이 중복 접수로 판단해 양쪽 모두 걸러낼
              수 있습니다. 정말 추가하시겠습니까?
            </p>
          </>
        }
        onCancel={() => setConfirmDuplicate(false)}
        onConfirm={() => {
          setConfirmDuplicate(false);
          persist();
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="지원 건 삭제"
        danger
        confirmLabel="삭제"
        message={`"${app?.company ?? ''}" 지원 건을 삭제합니다. 연결된 면접 회고는 남지만 연결이 끊깁니다. 되돌릴 수 없습니다.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (app) deleteApplication(app.id as ApplicationId);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}
