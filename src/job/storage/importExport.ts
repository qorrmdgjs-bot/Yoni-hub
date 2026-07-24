import { AppDataSchema, type AppData, type CollectionKey } from '@job/schema/entities';
import { EnvelopeSchema } from '@job/schema/envelope';
import { MigrationError, runMigrations } from '@job/schema/migrations';
import { APP_TAG, SCHEMA_VERSION } from '@job/schema/version';
import { nowISO, todayISO } from '@job/lib/date';
import type { PersistedSnapshot, StorageRepository } from './types';

/** 아이디로 관리되는 컬렉션 (settings는 싱글턴이라 제외) */
export const RECORD_KEYS = [
  'applications',
  'platformStatuses',
  'documents',
  'recruiters',
  'interviewPreps',
  'interviewReviews',
] as const satisfies readonly CollectionKey[];

export type RecordKey = (typeof RECORD_KEYS)[number];

export const RECORD_LABEL: Record<RecordKey, string> = {
  applications: '지원 건',
  platformStatuses: '플랫폼 체크리스트',
  documents: '경력기술서',
  recruiters: '헤드헌터',
  interviewPreps: '면접 질문',
  interviewReviews: '면접 회고',
};

// ─────────────────────────────────────────────────────────────
// 내보내기
// ─────────────────────────────────────────────────────────────
export function serializeExport(data: AppData): string {
  return JSON.stringify(
    { app: APP_TAG, schemaVersion: SCHEMA_VERSION, exportedAt: nowISO(), data },
    null,
    2,
  );
}

export function exportFilename(prefix = 'job-finder'): string {
  return `${prefix}-backup-${todayISO()}.json`;
}

// ─────────────────────────────────────────────────────────────
// 가져오기 — 미리보기(순수)와 커밋(부수효과)을 물리적으로 분리
// ─────────────────────────────────────────────────────────────
export type ImportStage = 'parse' | 'envelope' | 'version' | 'migrate' | 'validate';

export interface ImportPreviewOk {
  ok: true;
  /** 마이그레이션·검증을 모두 통과한 데이터 */
  data: AppData;
  sourceVersion: number;
  exportedAt: string;
  migrationsApplied: string[];
  counts: Record<RecordKey, { current: number; incoming: number }>;
  warnings: string[];
}

export interface ImportPreviewFail {
  ok: false;
  stage: ImportStage;
  errors: string[];
}

export type ImportPreview = ImportPreviewOk | ImportPreviewFail;

const STAGE_LABEL: Record<ImportStage, string> = {
  parse: 'JSON 형식 오류',
  envelope: '파일 형식 오류',
  version: '버전 오류',
  migrate: '데이터 변환 오류',
  validate: '데이터 검증 오류',
};

export function importStageLabel(stage: ImportStage): string {
  return STAGE_LABEL[stage];
}

/**
 * 완전 순수 함수. 스토어도 IndexedDB도 절대 건드리지 않는다.
 * 여기서 걸러지면 기존 데이터가 손상될 경로 자체가 없다.
 */
export function previewImport(fileText: string, current: AppData): ImportPreview {
  // 1) JSON 파싱
  let raw: unknown;
  try {
    raw = JSON.parse(fileText);
  } catch (e) {
    return {
      ok: false,
      stage: 'parse',
      errors: [
        'JSON을 읽지 못했습니다. 파일이 손상되었거나 이 앱에서 내보낸 파일이 아닙니다.',
        e instanceof Error ? e.message : String(e),
      ],
    };
  }

  // 2) 봉투 확인 — 다른 앱의 JSON을 잘못 넣는 사고 방지
  const envelope = EnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    return {
      ok: false,
      stage: 'envelope',
      errors: [
        '이 앱에서 내보낸 백업 파일이 아닙니다.',
        ...envelope.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      ],
    };
  }

  // 3) + 4) 버전 확인 및 마이그레이션
  let migrated: unknown;
  let applied: string[] = [];
  try {
    const result = runMigrations(envelope.data.data, envelope.data.schemaVersion);
    migrated = result.data;
    applied = result.applied;
  } catch (e) {
    return {
      ok: false,
      stage: e instanceof MigrationError ? 'version' : 'migrate',
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }

  // 5) 스키마 검증
  const parsed = AppDataSchema.safeParse(migrated);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`);
    const extra = parsed.error.issues.length - issues.length;
    return {
      ok: false,
      stage: 'validate',
      errors: [
        '파일 안의 데이터 구조가 올바르지 않습니다. 기존 데이터는 그대로 유지됩니다.',
        ...issues,
        ...(extra > 0 ? [`… 외 ${extra}건`] : []),
      ],
    };
  }

  const incoming = parsed.data;
  const counts = {} as ImportPreviewOk['counts'];
  for (const key of RECORD_KEYS) {
    counts[key] = {
      current: Object.keys(current[key]).length,
      incoming: Object.keys(incoming[key]).length,
    };
  }

  return {
    ok: true,
    data: incoming,
    sourceVersion: envelope.data.schemaVersion,
    exportedAt: envelope.data.exportedAt,
    migrationsApplied: applied,
    counts,
    warnings: findBrokenReferences(incoming),
  };
}

/** 끊어진 참조를 경고로만 알린다. 자동으로 지우지 않는다. */
export function findBrokenReferences(data: AppData): string[] {
  const warnings: string[] = [];
  let missingDoc = 0;
  let missingRecruiter = 0;
  let missingApp = 0;

  for (const app of Object.values(data.applications)) {
    if (app.documentId && !data.documents[app.documentId]) missingDoc += 1;
    if (app.recruiterId && !data.recruiters[app.recruiterId]) missingRecruiter += 1;
  }
  for (const review of Object.values(data.interviewReviews)) {
    if (review.applicationId && !data.applications[review.applicationId]) missingApp += 1;
  }

  if (missingDoc > 0) warnings.push(`지원 건 ${missingDoc}개가 존재하지 않는 경력기술서를 참조합니다.`);
  if (missingRecruiter > 0)
    warnings.push(`지원 건 ${missingRecruiter}개가 존재하지 않는 헤드헌터를 참조합니다.`);
  if (missingApp > 0) warnings.push(`면접 회고 ${missingApp}개가 존재하지 않는 지원 건을 참조합니다.`);

  return warnings;
}

export type ImportMode = 'replace' | 'merge';

/** updatedAt을 가진 컬렉션 — 병합 시 최신본을 남길 수 있다. */
const TIMESTAMPED_KEYS = [
  'applications',
  'documents',
  'recruiters',
  'interviewPreps',
  'interviewReviews',
] as const satisfies readonly RecordKey[];

/**
 * merge: 같은 id는 updatedAt이 최신인 쪽을 남긴다.
 * platformStatuses는 타임스탬프가 없으므로 가져온 쪽을 그대로 쓴다
 * (체크리스트는 "어느 쪽이 최신인지" 판단할 근거가 없어 임의 병합이 더 위험하다).
 */
export function mergeAppData(current: AppData, incoming: AppData): AppData {
  const out: AppData = { ...current, settings: incoming.settings };

  for (const key of TIMESTAMPED_KEYS) {
    const merged: Record<string, { updatedAt: string }> = { ...current[key] };
    for (const [id, entity] of Object.entries(incoming[key])) {
      const existing = merged[id];
      if (!existing || entity.updatedAt >= existing.updatedAt) merged[id] = entity;
    }
    // 컬렉션별 값 타입이 서로 달라 인덱스 접근으로는 좁혀지지 않는다.
    (out as Record<string, unknown>)[key] = merged;
  }

  out.platformStatuses = { ...current.platformStatuses, ...incoming.platformStatuses };

  return out;
}

/**
 * 부수효과 담당. previewImport를 통과한 결과만 받는다.
 * 저장소 쓰기는 단일 트랜잭션이라 실패 시 기존 데이터가 그대로 남는다.
 */
export async function commitImport(
  preview: ImportPreviewOk,
  mode: ImportMode,
  current: AppData,
  repo: StorageRepository,
): Promise<AppData> {
  const next = mode === 'replace' ? preview.data : mergeAppData(current, preview.data);
  const snapshot: PersistedSnapshot = {
    meta: { schemaVersion: SCHEMA_VERSION, updatedAt: nowISO() },
    data: next,
  };
  await repo.replaceAll(snapshot);
  return next;
}
