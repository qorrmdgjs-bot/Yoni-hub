import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { COLLECTION_KEYS, type AppData, type CollectionKey } from '@job/schema/entities';
import { estimateStorage } from './quota';
import type { PersistedMeta, PersistedSnapshot, StorageRepository } from './types';

const DB_NAME = 'job-finder';
const DB_VERSION = 1;
const META_KEY = 'meta';

interface JobFinderDB extends DBSchema {
  meta: { key: string; value: PersistedMeta };
  /** 컬렉션당 레코드 1개. 지원건을 고칠 때 문서 본문까지 다시 쓰지 않기 위함. */
  collections: { key: string; value: unknown };
}

/**
 * IndexedDB 구현.
 *
 * localStorage를 쓰지 않는 이유:
 * - 5MB 초과 시 setItem이 던지는 예외를 놓치면 그 시점부터 조용히 저장이 안 된다
 * - 동기 API라 저장할 때마다 JSON.stringify(전체)가 메인 스레드를 블로킹한다
 * - IndexedDB는 트랜잭션이 원자적이라 "가져오기 실패로 기존 데이터 손상"이 구조적으로 불가능하다
 */
export class IdbRepository implements StorageRepository {
  readonly kind = 'idb' as const;
  private db: IDBPDatabase<JobFinderDB> | null = null;

  async init(): Promise<void> {
    this.db = await openDB<JobFinderDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections');
      },
    });
  }

  private require(): IDBPDatabase<JobFinderDB> {
    if (!this.db) throw new Error('IdbRepository.init()이 먼저 호출되어야 합니다.');
    return this.db;
  }

  async readAll(): Promise<{ meta: PersistedMeta; data: Partial<AppData> } | null> {
    const db = this.require();
    const tx = db.transaction(['meta', 'collections'], 'readonly');
    const meta = await tx.objectStore('meta').get(META_KEY);
    if (!meta) {
      await tx.done;
      return null;
    }

    const store = tx.objectStore('collections');
    const data: Record<string, unknown> = {};
    for (const key of COLLECTION_KEYS) {
      const value = await store.get(key);
      if (value !== undefined) data[key] = value;
    }
    await tx.done;

    return { meta, data: data as Partial<AppData> };
  }

  async writeCollections(patch: Partial<AppData>, meta: PersistedMeta): Promise<void> {
    const db = this.require();
    const tx = db.transaction(['meta', 'collections'], 'readwrite');
    const store = tx.objectStore('collections');
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) await store.put(value, key);
    }
    await tx.objectStore('meta').put(meta, META_KEY);
    await tx.done;
  }

  /** 전체 교체. 실패하면 트랜잭션이 통째로 롤백되어 기존 데이터가 남는다. */
  async replaceAll(next: PersistedSnapshot): Promise<void> {
    const db = this.require();
    const tx = db.transaction(['meta', 'collections'], 'readwrite');
    const store = tx.objectStore('collections');
    await store.clear();
    for (const key of COLLECTION_KEYS) {
      await store.put(next.data[key as CollectionKey], key);
    }
    await tx.objectStore('meta').put(next.meta, META_KEY);
    await tx.done;
  }

  estimate(): Promise<{ usage: number; quota: number } | null> {
    return estimateStorage();
  }
}

/** IndexedDB를 쓸 수 있는 환경인지 가볍게 확인한다. */
export async function isIdbAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  try {
    const probe = await openDB('job-finder-probe', 1, {
      upgrade(db) {
        db.createObjectStore('t');
      },
    });
    probe.close();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('job-finder-probe');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    return true;
  } catch {
    return false;
  }
}
