import type { AppData, Application, ApplicationId } from '@job/schema/entities';
import { CHANNEL_LABEL, CLOSED_REASON_LABEL, STAGE_LABEL } from '@job/schema/labels';
import { normalizeCompany } from '@job/lib/company';
import { formatKo } from '@job/lib/date';

/**
 * 중복지원 감지.
 *
 * 서치펌이 A사에 이력서를 넣은 상태에서 본인이 직접 지원하면
 * 기업 인사팀이 중복 접수로 판단해 양쪽 다 걸러버리거나 서치펌과 분쟁이 생긴다.
 * 이직 활동에서 가장 흔한 자책골이라 반드시 잡아야 한다.
 *
 * 다만 **차단이 아니라 경고**다 — 같은 회사의 다른 포지션에 지원하는 것이
 * 정당한 경우가 실제로 있기 때문.
 */

export type DuplicateSeverity = 'high' | 'low';

export interface DuplicateHit {
  kind: 'application' | 'proposal';
  severity: DuplicateSeverity;
  title: string;
  detail: string;
  applicationId?: ApplicationId;
}

export interface DuplicateReport {
  hits: DuplicateHit[];
  /** 서치펌 경유 건과 겹치는가 — 가장 위험한 조합 */
  searchFirmConflict: boolean;
}

export function findDuplicates(
  company: string,
  data: AppData,
  excludeApplicationId?: ApplicationId,
): DuplicateReport {
  const key = normalizeCompany(company);
  if (!key) return { hits: [], searchFirmConflict: false };

  const hits: DuplicateHit[] = [];
  let searchFirmConflict = false;

  for (const app of Object.values(data.applications)) {
    if (app.id === excludeApplicationId) continue;
    if (app.companyNormalized !== key) continue;

    const closed = app.stage === 'closed';
    const viaFirm = app.viaSearchFirm || app.channel === 'headhunter';
    if (!closed && viaFirm) searchFirmConflict = true;

    const parts = [STAGE_LABEL[app.stage]];
    if (closed && app.closedReason) parts.push(CLOSED_REASON_LABEL[app.closedReason]);
    if (app.appliedAt) parts.push(`지원 ${formatKo(app.appliedAt)}`);
    parts.push(CHANNEL_LABEL[app.channel]);

    hits.push({
      kind: 'application',
      severity: closed ? 'low' : 'high',
      title: `${app.company} · ${app.position || '포지션 미입력'}`,
      detail: parts.join(' · '),
      applicationId: app.id,
    });
  }

  for (const recruiter of Object.values(data.recruiters)) {
    for (const proposal of recruiter.proposals) {
      if (proposal.companyNormalized !== key) continue;
      if (proposal.applicationId && proposal.applicationId === excludeApplicationId) continue;

      searchFirmConflict = true;
      hits.push({
        kind: 'proposal',
        severity: 'high',
        title: `${proposal.company} · ${proposal.position || '포지션 미입력'}`,
        detail: `${recruiter.name}${recruiter.firm ? ` (${recruiter.firm})` : ''} 제안 · ${formatKo(proposal.date)}`,
      });
    }
  }

  // 진행 중인 건을 먼저 보여준다.
  hits.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));

  return { hits, searchFirmConflict };
}

/** 칸반 카드에 상시 표시할 중복 배지 — 나중에 알아채도 대응할 수 있게. */
export function duplicateCount(app: Application, data: AppData): number {
  return findDuplicates(app.company, data, app.id).hits.filter((h) => h.severity === 'high').length;
}
