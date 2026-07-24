import type { StorageRepository } from './types';

/**
 * 부팅 시 결정된 저장소를 React 밖에서도 쓰기 위한 참조.
 * (가져오기 커밋, 자동저장 등이 컴포넌트 트리 밖에서 동작해야 한다)
 */
let current: StorageRepository | null = null;

export function setRepository(repo: StorageRepository): void {
  current = repo;
}

export function getRepository(): StorageRepository {
  if (!current) throw new Error('저장소가 아직 준비되지 않았습니다.');
  return current;
}
