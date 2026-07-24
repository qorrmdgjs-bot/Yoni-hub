import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppDataSchema, type AppData } from '@job/schema/entities';
import { runMigrations } from '@job/schema/migrations';
import { SCHEMA_VERSION } from '@job/schema/version';
import { nowISO } from '@job/lib/date';
import type { StorageRepository } from '@job/storage/types';
import { useAppStore } from '@job/store';
import { mergeAppData } from './merge';

/**
 * Job Finder 클라우드 동기화 (폰 ↔ PC).
 *
 * 다이어트·수면과 같은 Supabase 프로젝트를 쓴다. 다만 Job Finder 데이터는 한 덩어리(AppData)라
 * **행 하나(id=1)에 JSON으로 통째로** 저장한다.
 *
 * 설계 원칙 — **철저히 실패 안전(fail-safe)**:
 * - 환경변수가 없거나(로컬 개발 등) 테이블이 없거나 네트워크가 끊겨도, 모든 함수는 조용히 no-op이 되고
 *   Job Finder는 기존처럼 로컬(IndexedDB)만으로 정상 동작한다.
 * - 즉, 이 코드를 먼저 배포해도 안전하다. 사용자가 Supabase에 테이블을 만든 순간부터 동기화가 켜진다.
 */

const TABLE = 'job_finder_state';
const ROW_ID = 1;
const PUSH_DEBOUNCE_MS = 1500;

let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    client = url && key ? createClient(url, key) : null;
  } catch {
    client = null;
  }
  return client;
}

export function cloudEnabled(): boolean {
  return getClient() !== null;
}

/** 클라우드에서 현재 상태를 읽어 마이그레이션·검증까지 통과시킨다. 실패하면 null. */
async function fetchRemote(): Promise<AppData | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data, error } = await c
      .from(TABLE)
      .select('data, schema_version')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error || !data?.data) return null;

    const version = Number(data.schema_version) || 1;
    // 과거 버전 blob일 수 있으니 로컬과 동일한 마이그레이션 체인을 태운다.
    const migrated = runMigrations(data.data, version).data;
    const parsed = AppDataSchema.safeParse(migrated);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 현재 상태 전체를 클라우드에 올린다. 실패해도 로컬은 그대로. */
async function pushRemote(data: AppData): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c
      .from(TABLE)
      .upsert(
        { id: ROW_ID, data, schema_version: SCHEMA_VERSION, updated_at: nowISO() },
        { onConflict: 'id' },
      );
  } catch {
    /* 네트워크·권한 오류 시 로컬만 유지 */
  }
}

/**
 * 부팅 시 1회. 로컬과 클라우드를 **병합**해 어느 기기 데이터도 잃지 않게 한다.
 * - 클라우드가 비어 있으면 이 기기 데이터로 시드한다.
 * - 있으면 병합 결과를 스토어·로컬·클라우드 세 곳에 반영한다.
 */
export async function syncWithCloud(repo: StorageRepository): Promise<void> {
  if (!cloudEnabled()) return;

  const local = useAppStore.getState().data;
  const remote = await fetchRemote();

  if (!remote) {
    await pushRemote(local);
    return;
  }

  const merged = mergeAppData(local, remote);
  useAppStore.getState().replaceData(merged);
  try {
    await repo.replaceAll({
      meta: { schemaVersion: SCHEMA_VERSION, updatedAt: nowISO() },
      data: merged,
    });
  } catch {
    /* 로컬 저장 실패해도 메모리·클라우드에는 병합본이 있다 */
  }
  await pushRemote(merged);
}

/** 이후 데이터가 바뀔 때마다 클라우드에 밀어 올린다(디바운스). 반환값으로 구독 해제. */
export function startCloudPush(): () => void {
  if (!cloudEnabled()) return () => {};

  let timer: number | undefined;
  const unsubscribe = useAppStore.subscribe((state, prev) => {
    if (state.status !== 'ready') return;
    if (state.data === prev.data) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void pushRemote(useAppStore.getState().data);
    }, PUSH_DEBOUNCE_MS);
  });

  return () => {
    if (timer !== undefined) window.clearTimeout(timer);
    unsubscribe();
  };
}
