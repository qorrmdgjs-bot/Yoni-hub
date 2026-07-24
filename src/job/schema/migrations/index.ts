import { SCHEMA_VERSION } from '../version';

/**
 * 마이그레이션 체인.
 *
 * 규칙:
 * 1. migrate 함수는 zod 스키마를 절대 import하지 않는다.
 *    스키마는 항상 최신 버전이라 과거 버전 데이터에 적용할 수 없다. any로 다룬다.
 * 2. from은 오름차순, 끊김 없이 연속이어야 한다 (assertChainIsContinuous로 검증).
 * 3. 로컬 부팅과 JSON 가져오기가 이 함수를 똑같이 통과한다.
 */
export interface Migration {
  from: number;
  to: number;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  migrate: (data: any) => any;
}

export const migrations: Migration[] = [
  {
    from: 1,
    to: 2,
    description: 'Application에 헤드헌터 정보(recruiterName·recruiterFirm·recruiterContact) 추가',
    // 전부 선택 필드라 v1 데이터를 그대로 통과시켜도 최신 스키마 검증을 통과한다.
    // 값을 만들어 넣지 않는 게 맞다 — 없던 정보를 지어내면 안 된다.
    migrate: (d) => d,
  },
  {
    from: 2,
    to: 3,
    description: 'Settings에 employed(재직 여부) 추가',
    // 필수 필드라 기존 데이터에 기본값을 넣어줘야 검증을 통과한다.
    // 기존 사용자는 '재직 중 이직'을 전제로 써 왔으므로 true가 안전한 기본값.
    // (퇴사한 사용자는 설정에서 끄면 된다 — 조용히 안내를 감추지 않는다.)
    migrate: (d) => ({
      ...d,
      settings: { ...(d.settings ?? {}), employed: true },
    }),
  },
];

export class MigrationError extends Error {}

export interface MigrationResult {
  data: unknown;
  applied: string[];
}

/** fromVersion 데이터를 SCHEMA_VERSION까지 끌어올린다. */
export function runMigrations(data: unknown, fromVersion: number): MigrationResult {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new MigrationError(`알 수 없는 스키마 버전입니다: ${String(fromVersion)}`);
  }
  if (fromVersion > SCHEMA_VERSION) {
    throw new MigrationError(
      `이 파일은 더 최신 버전(v${fromVersion})에서 만들어졌습니다. ` +
        `현재 앱은 v${SCHEMA_VERSION}까지만 읽을 수 있습니다. 앱을 업데이트한 뒤 다시 시도하세요.`,
    );
  }

  let current: unknown = data;
  let version = fromVersion;
  const applied: string[] = [];

  while (version < SCHEMA_VERSION) {
    const step = migrations.find((m) => m.from === version);
    if (!step) {
      throw new MigrationError(
        `v${version} → v${version + 1} 마이그레이션이 없습니다. 데이터를 변환할 수 없습니다.`,
      );
    }
    current = step.migrate(current);
    applied.push(`v${step.from}→v${step.to}: ${step.description}`);
    version = step.to;
  }

  return { data: current, applied };
}

/** 개발 중 실수를 잡는 자체 검사. 부팅 시 1회 호출. */
export function assertChainIsContinuous(): void {
  let expected = 1;
  for (const m of migrations) {
    if (m.from !== expected || m.to !== m.from + 1) {
      throw new MigrationError(
        `마이그레이션 체인이 끊겼습니다: v${m.from}→v${m.to} (v${expected}부터여야 함)`,
      );
    }
    expected = m.to;
  }
  if (migrations.length > 0 && expected !== SCHEMA_VERSION) {
    throw new MigrationError(
      `마이그레이션 체인이 v${expected}에서 끝났지만 SCHEMA_VERSION은 ${SCHEMA_VERSION}입니다.`,
    );
  }
}
