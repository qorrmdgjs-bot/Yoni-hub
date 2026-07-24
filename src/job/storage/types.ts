import type { AppData } from '@job/schema/entities';

export interface PersistedMeta {
  schemaVersion: number;
  updatedAt: string;
}

export interface PersistedSnapshot {
  meta: PersistedMeta;
  data: AppData;
}

export type StorageFailure =
  | { kind: 'quota'; message: string }
  | { kind: 'unavailable'; message: string } // 시크릿 모드, IDB 차단
  | { kind: 'unknown'; message: string; error: unknown };

export interface StorageRepository {
  readonly kind: 'idb' | 'memory';
  init(): Promise<void>;
  /** 저장된 것이 없으면 null (최초 실행) */
  readAll(): Promise<{ meta: PersistedMeta; data: Partial<AppData> } | null>;
  /** 변경된 컬렉션만 meta와 함께 단일 트랜잭션으로 기록 */
  writeCollections(patch: Partial<AppData>, meta: PersistedMeta): Promise<void>;
  /** 가져오기·초기화 전용 — 단일 트랜잭션 내 전체 교체 */
  replaceAll(next: PersistedSnapshot): Promise<void>;
  estimate(): Promise<{ usage: number; quota: number } | null>;
}
