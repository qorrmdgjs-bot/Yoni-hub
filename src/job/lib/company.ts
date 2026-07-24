/**
 * 회사명 정규화. 중복지원 감지의 기반이다.
 * "(주)한국전자", "한국전자 주식회사", "한국 전자"가 모두 같은 회사로 잡혀야 한다.
 */
export function normalizeCompany(name: string): string {
  return name
    .replace(/\(주\)|\(株\)|㈜|\(유\)|㈜|주식회사|유한회사|유한책임회사/g, '')
    .replace(/\b(co\.?|corp\.?|inc\.?|ltd\.?|llc|limited)\b/gi, '')
    .replace(/[\s.,·・\-_'"()[\]]/g, '')
    .toLowerCase();
}
