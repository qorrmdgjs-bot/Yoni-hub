import type { AppData } from '@job/schema/entities';
import type { PersistedMeta, PersistedSnapshot, StorageRepository } from './types';

/**
 * IndexedDB를 못 쓰는 환경(시크릿 모드, 저장소 차단)의 폴백.
 * 새로고침하면 데이터가 사라지므로 UI에서 반드시 경고 배너를 띄워야 한다.
 */
export class MemoryRepository implements StorageRepository {
  readonly kind = 'memory' as const;
  private meta: PersistedMeta | null = null;
  private data: Partial<AppData> = {};

  async init(): Promise<void> {
    /* no-op */
  }

  async readAll(): Promise<{ meta: PersistedMeta; data: Partial<AppData> } | null> {
    if (!this.meta) return null;
    return { meta: this.meta, data: this.data };
  }

  async writeCollections(patch: Partial<AppData>, meta: PersistedMeta): Promise<void> {
    this.data = { ...this.data, ...patch };
    this.meta = meta;
  }

  async replaceAll(next: PersistedSnapshot): Promise<void> {
    this.data = { ...next.data };
    this.meta = next.meta;
  }

  async estimate(): Promise<null> {
    return null;
  }
}
