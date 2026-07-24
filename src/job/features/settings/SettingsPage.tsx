import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  ShieldAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { SCHEMA_VERSION } from '@job/schema/version';
import { cn } from '@job/lib/cn';
import { todayISO } from '@job/lib/date';
import { downloadText, readTextFile } from '@job/lib/download';
import { useAppStore } from '@job/store';
import { seedInitialData } from '@job/store/persistence';
import { getRepository } from '@job/storage/current';
import { formatBytes } from '@job/storage/quota';
import {
  commitImport,
  exportFilename,
  importStageLabel,
  previewImport,
  serializeExport,
  RECORD_KEYS,
  RECORD_LABEL,
  type ImportMode,
  type ImportPreview,
} from '@job/storage/importExport';
import { Button, Card, ConfirmDialog, Field, Input, PageHeader, SectionTitle } from '@job/components/ui';

function ImportPanel() {
  const data = useAppStore((s) => s.data);
  const replaceData = useAppStore((s) => s.replaceData);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>('replace');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setDone(false);
    const text = await readTextFile(file);
    // 완전 순수 — 여기서 실패해도 기존 데이터는 손도 대지 않는다.
    setPreview(previewImport(text, data));
  };

  const commit = async () => {
    if (!preview?.ok) return;
    setBusy(true);
    try {
      // 커밋 직전 현재 상태를 파일로 자동 백업한다.
      downloadText(`job-finder-before-import-${todayISO()}.json`, serializeExport(data));
      const next = await commitImport(preview, mode, data, getRepository());
      replaceData(next);
      setPreview(null);
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <SectionTitle>데이터 가져오기</SectionTitle>
      <p className="mb-3 text-xs leading-relaxed text-slate-600">
        내보낸 JSON 파일을 불러옵니다. 먼저 내용을 확인한 뒤에만 반영되며, 반영 직전 현재 데이터가
        자동으로 백업 파일로 저장됩니다.
      </p>

      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Upload size={14} /> JSON 파일 선택
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>

      {done && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={15} /> 가져오기가 완료되었습니다.
        </p>
      )}

      {preview && !preview.ok && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
            <XCircle size={15} /> {importStageLabel(preview.stage)}
          </p>
          <ul className="mt-1.5 space-y-1">
            {preview.errors.map((e, i) => (
              <li key={i} className="text-xs text-red-700">
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-medium text-red-800">
            기존 데이터는 아무것도 바뀌지 않았습니다.
          </p>
          <Button size="sm" className="mt-2" onClick={() => setPreview(null)}>
            닫기
          </Button>
        </div>
      )}

      {preview?.ok && (
        <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">가져오기 미리보기</p>
          <p className="mt-0.5 text-xs text-slate-500">
            파일 버전 v{preview.sourceVersion} · 내보낸 시각 {preview.exportedAt.slice(0, 16).replace('T', ' ')}
          </p>

          {preview.migrationsApplied.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {preview.migrationsApplied.map((m, i) => (
                <li key={i} className="text-xs text-blue-700">
                  변환 적용: {m}
                </li>
              ))}
            </ul>
          )}

          <table className="mt-2 w-full text-xs">
            <tbody>
              {RECORD_KEYS.map((key) => {
                const c = preview.counts[key];
                const changed = c.current !== c.incoming;
                return (
                  <tr key={key} className="border-b border-slate-200 last:border-0">
                    <td className="py-1 text-slate-600">{RECORD_LABEL[key]}</td>
                    <td className="py-1 text-right tabular-nums">
                      <span className="text-slate-500">{c.current}</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className={changed ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                        {mode === 'replace' ? c.incoming : '병합'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {preview.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 rounded bg-amber-100 p-2">
              {preview.warnings.map((w, i) => (
                <li key={i} className="text-[11px] text-amber-900">
                  ⚠ {w}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-1.5">
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="radio"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                className="mt-0.5 accent-slate-900"
              />
              <span>
                <strong>전체 교체</strong> — 현재 데이터를 지우고 파일 내용으로 바꿉니다. (다른
                기기에서 옮겨올 때)
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="radio"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                className="mt-0.5 accent-slate-900"
              />
              <span>
                <strong>병합</strong> — 같은 항목은 최근 수정본을 남기고, 없는 항목은 추가합니다.
              </span>
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <Button onClick={() => setPreview(null)}>취소</Button>
            <Button variant="primary" onClick={() => void commit()} disabled={busy}>
              {busy ? '적용 중…' : '이 내용으로 가져오기'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StoragePanel() {
  const repoKind = useAppStore((s) => s.repoKind);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void getRepository()
      .estimate()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  const percent = usage && usage.quota > 0 ? (usage.usage / usage.quota) * 100 : 0;

  return (
    <Card className="p-4">
      <SectionTitle>저장소 상태</SectionTitle>
      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-slate-500">저장 방식</dt>
          <dd className="font-medium text-slate-800">
            {repoKind === 'idb' ? 'IndexedDB (브라우저 내장)' : '메모리 (저장 안 됨)'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">데이터 버전</dt>
          <dd className="font-medium text-slate-800">v{SCHEMA_VERSION}</dd>
        </div>
        {usage && (
          <div className="flex justify-between">
            <dt className="text-slate-500">사용량</dt>
            <dd className="font-medium text-slate-800">
              {formatBytes(usage.usage)} / {formatBytes(usage.quota)} ({percent.toFixed(1)}%)
            </dd>
          </div>
        )}
      </dl>
      {usage && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={percent > 80 ? 'h-full bg-red-500' : 'h-full bg-slate-400'}
            style={{ width: `${Math.max(percent, 1)}%` }}
          />
        </div>
      )}
    </Card>
  );
}

export function SettingsPage() {
  const data = useAppStore((s) => s.data);
  const settings = data.settings;
  const updateSettings = useAppStore((s) => s.updateSettings);
  const markExported = useAppStore((s) => s.markExported);
  const resetAll = useAppStore((s) => s.resetAll);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');

  const exportNow = () => {
    downloadText(exportFilename(), serializeExport(data));
    markExported();
  };

  const doReset = async () => {
    const fresh = seedInitialData();
    resetAll(fresh);
    await getRepository().replaceAll({
      meta: { schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() },
      data: fresh,
    });
    setConfirmReset(false);
    setResetPhrase('');
  };

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };

  return (
    <div className="max-w-3xl space-y-4 p-4">
      <PageHeader title="설정" description="백업, 저장소 상태, 알림 기준을 관리합니다." />

      {/* 백업 */}
      <Card className="p-4">
        <SectionTitle>데이터 내보내기</SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          모든 데이터를 JSON 파일 하나로 저장합니다. 다른 기기로 옮기거나 백업할 때 사용하세요.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={exportNow}>
            <Download size={14} /> JSON 내보내기
          </Button>
          <span className="text-xs text-slate-500">
            마지막 내보내기:{' '}
            {settings.lastExportedAt
              ? settings.lastExportedAt.slice(0, 16).replace('T', ' ')
              : '없음'}
          </span>
        </div>
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
          <HardDrive size={13} className="mt-px shrink-0" />
          <span>
            데이터는 이 브라우저 안에만 있습니다. 브라우저 데이터를 삭제하거나 다른 PC·휴대폰에서
            접속하면 보이지 않습니다. <strong>주 1회 내보내기를 습관으로 만드세요.</strong>
          </span>
        </p>
      </Card>

      <ImportPanel />
      <StoragePanel />

      {/* 구직 상황 — 앱이 무엇을 안내할지가 여기서 갈린다 */}
      <Card className="p-4">
        <SectionTitle>구직 상황</SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          현재 재직 중이면 &lsquo;현직에 이직 사실이 새지 않게 하는&rsquo; 안내가 표시됩니다.
          이미 퇴사했다면 그 안내는 필요 없으니 끌 수 있습니다.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => updateSettings({ employed: true })}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              settings.employed
                ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900'
                : 'border-slate-200 hover:bg-slate-50',
            )}
          >
            <p className="text-sm font-semibold text-slate-900">재직 중 이직</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              현직 노출 차단 체크리스트와 경고를 표시합니다.
            </p>
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ employed: false })}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              !settings.employed
                ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900'
                : 'border-slate-200 hover:bg-slate-50',
            )}
          >
            <p className="text-sm font-semibold text-slate-900">퇴사 후 구직 중</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              현직 노출 관련 안내를 모두 숨깁니다.
            </p>
          </button>
        </div>
      </Card>

      {/* 알림 기준 */}
      <Card className="p-4">
        <SectionTitle>목표와 알림 기준</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="주간 지원 목표 (건)">
            <Input
              type="number"
              min={0}
              value={settings.weeklyTargetApplications}
              onChange={(e) =>
                updateSettings({ weeklyTargetApplications: num(e.target.value, 3) })
              }
            />
          </Field>
          <Field label="프로필 업데이트 권장 주기 (일)">
            <Input
              type="number"
              min={1}
              value={settings.profileRefreshDays}
              onChange={(e) => updateSettings({ profileRefreshDays: num(e.target.value, 30) })}
            />
          </Field>
          <Field label="무응답 주의 기준 (일)" hint="노란 배지가 뜨는 시점">
            <Input
              type="number"
              min={1}
              value={settings.staleWarnDays}
              onChange={(e) => updateSettings({ staleWarnDays: num(e.target.value, 14) })}
            />
          </Field>
          <Field label="무응답 경고 기준 (일)" hint="빨간 배지 · 종료 처리 제안">
            <Input
              type="number"
              min={1}
              value={settings.staleDangerDays}
              onChange={(e) => updateSettings({ staleDangerDays: num(e.target.value, 30) })}
            />
          </Field>
        </div>
      </Card>

      {/* 개인정보 */}
      <Card className="border-slate-300 bg-slate-50 p-4">
        <SectionTitle>개인정보 주의</SectionTitle>
        <ul className="space-y-1.5 text-xs leading-relaxed text-slate-700">
          <li className="flex gap-1.5">
            <ShieldAlert size={13} className="mt-px shrink-0 text-slate-500" />
            데이터는 이 브라우저에 저장되고, 폰·PC에서 함께 보이도록 클라우드(Supabase)에도
            동기화됩니다. 로그인은 없습니다.
          </li>
          <li className="flex gap-1.5">
            <ShieldAlert size={13} className="mt-px shrink-0 text-slate-500" />
            <span>
              <strong>주민등록번호, 계좌번호, 비밀번호, 현직 동료의 실명</strong>은 입력하지 마세요.
              내보낸 JSON 파일은 암호화되지 않은 평문입니다.
            </span>
          </li>
          <li className="flex gap-1.5">
            <ShieldAlert size={13} className="mt-px shrink-0 text-slate-500" />
            공용 PC에서는 사용하지 마시고, 백업 파일은 개인 저장소에만 보관하세요.
          </li>
        </ul>
      </Card>

      {/* 위험 구역 */}
      <Card className="border-red-300 p-4">
        <SectionTitle>
          <span className="flex items-center gap-1.5 text-red-700">
            <AlertTriangle size={14} /> 전체 데이터 초기화
          </span>
        </SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          모든 지원 건·문서·헤드헌터·회고가 삭제되고 플랫폼 체크리스트와 기본 면접 질문만 남습니다.
          되돌릴 수 없습니다.
        </p>
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          <Database size={14} /> 전체 초기화
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="정말 초기화할까요?"
        danger
        confirmLabel="초기화"
        message={
          <div className="space-y-3">
            <p>
              모든 데이터가 삭제됩니다. 먼저{' '}
              <button
                type="button"
                onClick={exportNow}
                className="font-semibold text-blue-600 underline underline-offset-2"
              >
                JSON으로 내보내기
              </button>
              를 권장합니다.
            </p>
            <Field label="확인을 위해 '초기화'를 입력하세요">
              <Input value={resetPhrase} onChange={(e) => setResetPhrase(e.target.value)} />
            </Field>
            {resetPhrase !== '초기화' && (
              <p className="text-xs text-slate-500">정확히 입력해야 초기화 버튼이 동작합니다.</p>
            )}
          </div>
        }
        onCancel={() => {
          setConfirmReset(false);
          setResetPhrase('');
        }}
        onConfirm={() => {
          if (resetPhrase === '초기화') void doReset();
        }}
      />
    </div>
  );
}
