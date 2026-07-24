import { IdbRepository, isIdbAvailable } from './idbRepository';
import { MemoryRepository } from './memoryRepository';
import type { StorageRepository } from './types';

export * from './types';
export { classifyStorageError, requestPersistentStorage, estimateStorage, formatBytes } from './quota';

/** IndexedDB를 우선 시도하고, 못 쓰면 메모리 폴백으로 앱이 죽지 않게 한다. */
export async function createRepository(): Promise<StorageRepository> {
  if (await isIdbAvailable()) {
    try {
      const repo = new IdbRepository();
      await repo.init();
      return repo;
    } catch {
      /* 아래 폴백으로 */
    }
  }
  const fallback = new MemoryRepository();
  await fallback.init();
  return fallback;
}
