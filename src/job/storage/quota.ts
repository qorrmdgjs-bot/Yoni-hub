import type { StorageFailure } from './types';

/** 저장 실패 원인을 분류한다. quota는 사용자에게 다르게 안내해야 한다. */
export function classifyStorageError(error: unknown): StorageFailure {
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return {
        kind: 'quota',
        message: '브라우저 저장 공간이 가득 찼습니다. 지금 JSON으로 내보낸 뒤 정리하세요.',
      };
    }
    if (error.name === 'InvalidStateError' || error.name === 'SecurityError') {
      return {
        kind: 'unavailable',
        message: '브라우저가 저장소를 차단했습니다 (시크릿 모드일 수 있습니다).',
      };
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'unknown', message, error };
}

/**
 * 브라우저의 자동 삭제(eviction) 대상에서 제외해 달라고 요청한다.
 * 승인되면 사용자가 직접 지우기 전까지 데이터가 유지된다.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (usage === undefined || quota === undefined) return null;
    return { usage, quota };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
