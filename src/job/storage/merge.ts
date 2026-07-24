import {
  emptyAppData,
  type AppData,
  type PlatformStatus,
} from '@job/schema/entities';

/**
 * 두 AppData(예: 이 기기 로컬 + 클라우드)를 병합한다.
 *
 * 원칙: **어느 쪽 데이터도 잃지 않는다.** (규칙 1·4 — 개인 기록 보존, cascade 삭제 금지)
 * 폰과 PC에 각각 따로 입력해 둔 상태에서 처음 동기화할 때, 한쪽이 다른 쪽을
 * 덮어써 사라지는 일이 없어야 한다. 그래서 blind overwrite가 아니라 **id 기준 합집합**이다.
 *
 * 충돌(같은 id가 양쪽에 있음) 시:
 * - updatedAt이 있는 엔티티는 더 최신 것을 택한다.
 * - platformStatuses는 타임스탬프가 없으므로 체크 상태를 OR로 합친다(진행 상황 보존).
 * - settings는 타임스탬프가 없어, 전체적으로 더 최근에 수정된 쪽 것을 택한다.
 *
 * 트레이드오프: 한쪽에서 삭제한 항목이 다른 쪽에 남아 있으면 되살아난다.
 * 개인 기록 앱에서는 "잘못 되살리는 것"이 "잘못 지우는 것"보다 낫다.
 */

type WithUpdatedAt = { updatedAt: string };

function unionNewer<T extends WithUpdatedAt>(
  a: Record<string, T>,
  b: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [id, entity] of Object.entries(b)) {
    const cur = out[id];
    if (!cur || entity.updatedAt > cur.updatedAt) out[id] = entity;
  }
  return out;
}

function maxStr(a: string | undefined, b: string | undefined): string | undefined {
  if (a && b) return a > b ? a : b;
  return a ?? b;
}

function mergePlatforms(
  a: Record<string, PlatformStatus>,
  b: Record<string, PlatformStatus>,
): Record<string, PlatformStatus> {
  const out: Record<string, PlatformStatus> = { ...a };
  for (const [pid, s] of Object.entries(b)) {
    const cur = out[pid];
    if (!cur) {
      out[pid] = s;
      continue;
    }
    // 체크리스트를 item id 기준으로 합치고, 완료(done)는 OR — 어느 기기에서 체크했든 살린다.
    const byId = new Map(cur.checklist.map((i) => [i.id, { ...i }]));
    for (const item of s.checklist) {
      const existing = byId.get(item.id);
      if (!existing) byId.set(item.id, { ...item });
      else existing.done = existing.done || item.done;
    }
    out[pid] = {
      ...cur,
      checklist: [...byId.values()],
      lastProfileUpdate: maxStr(cur.lastProfileUpdate, s.lastProfileUpdate),
      memo: cur.memo || s.memo,
    };
  }
  return out;
}

/** 엔티티들의 updatedAt 중 가장 최신값. 어느 blob이 더 최근인지 판단용. */
export function latestTimestamp(d: AppData): string {
  let m = '';
  const collections = [
    d.applications,
    d.documents,
    d.recruiters,
    d.interviewPreps,
    d.interviewReviews,
  ];
  for (const coll of collections) {
    for (const e of Object.values(coll)) {
      if (e.updatedAt > m) m = e.updatedAt;
    }
  }
  return m;
}

export function mergeAppData(local: AppData, remote: AppData): AppData {
  // settings·platformStatuses의 기준(base)은 전체적으로 더 최근에 수정된 쪽.
  const base = latestTimestamp(local) >= latestTimestamp(remote) ? local : remote;

  return {
    ...emptyAppData(),
    applications: unionNewer(local.applications, remote.applications),
    documents: unionNewer(local.documents, remote.documents),
    recruiters: unionNewer(local.recruiters, remote.recruiters),
    interviewPreps: unionNewer(local.interviewPreps, remote.interviewPreps),
    interviewReviews: unionNewer(local.interviewReviews, remote.interviewReviews),
    platformStatuses: mergePlatforms(local.platformStatuses, remote.platformStatuses),
    settings: { ...base.settings },
  };
}
