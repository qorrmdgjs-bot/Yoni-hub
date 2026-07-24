import {
  AppDataSchema,
  COLLECTION_KEYS,
  emptyAppData,
  type AppData,
  type CollectionKey,
} from '@job/schema/entities';
import { assertChainIsContinuous, runMigrations } from '@job/schema/migrations';
import { SCHEMA_VERSION } from '@job/schema/version';
import { nowISO } from '@job/lib/date';
import { seedPlatformStatuses, PLATFORMS } from '@job/data/seed/platforms';
import { seedInterviewPreps } from '@job/data/seed/interviewQuestions';
import { classifyStorageError } from '@job/storage/quota';
import type { StorageRepository } from '@job/storage/types';
import { useAppStore } from './index';

/** 최초 실행 시 빈 화면이 뜨지 않도록 플랫폼·질문을 미리 채운다. */
export function seedInitialData(): AppData {
  return {
    ...emptyAppData(),
    platformStatuses: seedPlatformStatuses(),
    interviewPreps: seedInterviewPreps(),
  };
}

export type HydrateStatus = 'seeded' | 'loaded' | 'migrated' | 'recovered';

export interface HydrateResult {
  status: HydrateStatus;
  migrationsApplied: string[];
  warning?: string;
}

/**
 * 저장소 → 스토어. 절대 데이터를 지우지 않는다.
 * 검증에 실패해도 원본을 그대로 싣고 경고만 띄운다 —
 * "형식이 안 맞으니 초기화"는 사용자 입장에서 최악의 동작이다.
 */
export async function hydrate(repo: StorageRepository): Promise<HydrateResult> {
  assertChainIsContinuous();

  const stored = await repo.readAll();

  if (!stored) {
    const seeded = seedInitialData();
    try {
      await repo.replaceAll({ meta: { schemaVersion: SCHEMA_VERSION, updatedAt: nowISO() }, data: seeded });
    } catch {
      /* 저장 실패해도 메모리에서는 동작해야 한다 */
    }
    useAppStore.getState()._hydrated(seeded, repo.kind);
    return { status: 'seeded', migrationsApplied: [] };
  }

  // 저장된 것이 부분적일 수 있으므로 빈 구조 위에 덮는다.
  const raw: AppData = { ...emptyAppData(), ...stored.data };

  let migrated: unknown = raw;
  let applied: string[] = [];
  let warning: string | undefined;

  try {
    const result = runMigrations(raw, stored.meta.schemaVersion);
    migrated = result.data;
    applied = result.applied;
  } catch (e) {
    warning = `데이터 변환에 실패했습니다: ${e instanceof Error ? e.message : String(e)}. 저장된 내용을 그대로 불러왔습니다.`;
  }

  const parsed = AppDataSchema.safeParse(migrated);
  let data: AppData;
  let status: HydrateStatus;

  if (parsed.success) {
    data = parsed.data;
    status = applied.length > 0 ? 'migrated' : 'loaded';
  } else {
    // 검증 실패 — 지우지 않고 그대로 싣는다.
    data = migrated as AppData;
    status = 'recovered';
    warning ??=
      '저장된 데이터 일부가 예상 형식과 다릅니다. 데이터는 그대로 두었으니 먼저 JSON으로 내보내 백업하세요.';
  }

  // 앱 업데이트로 플랫폼이 추가되었을 수 있으므로 빠진 것만 채운다.
  const seededPlatforms = seedPlatformStatuses();
  for (const p of PLATFORMS) {
    if (!data.platformStatuses[p.id]) {
      const seed = seededPlatforms[p.id];
      if (seed) data.platformStatuses[p.id] = seed;
    }
  }

  useAppStore.getState()._hydrated(data, repo.kind, warning);
  return { status, migrationsApplied: applied, ...(warning ? { warning } : {}) };
}

// ─────────────────────────────────────────────────────────────
// 자동 저장
// ─────────────────────────────────────────────────────────────
const DEBOUNCE_MS = 600;
/** 연속 입력 중에도 이 간격마다는 강제로 저장한다 */
const MAX_WAIT_MS = 3000;

/**
 * 수동 "저장" 버튼용. startAutosave가 켜져 있는 동안 현재 스냅샷을 즉시 저장하는
 * 함수를 여기에 등록해 두고, UI는 이 saveNow()만 호출한다.
 * (자동저장이 이미 돌지만, 사용자가 직접 저장하고 "저장됨"을 확인하고 싶을 때를 위한 것.)
 */
let registeredSaveNow: (() => Promise<void>) | null = null;

export function saveNow(): Promise<void> {
  return registeredSaveNow ? registeredSaveNow() : Promise.resolve();
}

export function startAutosave(repo: StorageRepository): () => void {
  const dirty = new Set<CollectionKey>();
  let debounceTimer: number | undefined;
  let maxWaitTimer: number | undefined;
  let writing = false;

  const clearTimers = () => {
    if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
    if (maxWaitTimer !== undefined) window.clearTimeout(maxWaitTimer);
    debounceTimer = undefined;
    maxWaitTimer = undefined;
  };

  const flush = async () => {
    clearTimers();
    if (dirty.size === 0 || writing) return;

    const keys = [...dirty];
    dirty.clear();
    writing = true;

    const { data, _setSaveState } = useAppStore.getState();
    const patch: Partial<AppData> = {};
    for (const key of keys) {
      (patch as Record<string, unknown>)[key] = data[key];
    }

    _setSaveState('saving');
    try {
      await repo.writeCollections(patch, { schemaVersion: SCHEMA_VERSION, updatedAt: nowISO() });
      _setSaveState('saved');
    } catch (error) {
      // 실패해도 아무것도 지우지 않는다. 메모리에는 데이터가 남아 있으므로
      // 사용자는 배너의 "지금 내보내기"로 탈출할 수 있다.
      keys.forEach((k) => dirty.add(k));
      _setSaveState('error', classifyStorageError(error));
    } finally {
      writing = false;
    }
  };

  const schedule = () => {
    if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => void flush(), DEBOUNCE_MS);
    if (maxWaitTimer === undefined) {
      maxWaitTimer = window.setTimeout(() => void flush(), MAX_WAIT_MS);
    }
  };

  /**
   * 수동 저장 — dirty 추적과 무관하게 전체 스냅샷을 통째로 쓴다.
   * "혹시 안 저장됐을까" 걱정 없이 한 번에 확실히 저장되도록.
   */
  const saveAllNow = async () => {
    clearTimers();
    if (writing) return;
    writing = true;
    dirty.clear();

    const { data, _setSaveState } = useAppStore.getState();
    const patch: Partial<AppData> = {};
    for (const key of COLLECTION_KEYS) {
      (patch as Record<string, unknown>)[key] = data[key];
    }

    _setSaveState('saving');
    try {
      await repo.writeCollections(patch, { schemaVersion: SCHEMA_VERSION, updatedAt: nowISO() });
      _setSaveState('saved');
    } catch (error) {
      COLLECTION_KEYS.forEach((k) => dirty.add(k));
      _setSaveState('error', classifyStorageError(error));
    } finally {
      writing = false;
    }
  };
  registeredSaveNow = saveAllNow;

  const unsubscribe = useAppStore.subscribe((state, prev) => {
    if (state.status !== 'ready') return;
    if (state.data === prev.data) return;
    for (const key of COLLECTION_KEYS) {
      if (state.data[key] !== prev.data[key]) dirty.add(key);
    }
    if (dirty.size > 0) schedule();
  });

  // beforeunload에서의 async 쓰기는 보장되지 않는다.
  // pagehide / visibilitychange가 실질적인 마지막 방어선.
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  const onPageHide = () => void flush();

  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    clearTimers();
    unsubscribe();
    if (registeredSaveNow === saveAllNow) registeredSaveNow = null;
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
  };
}
