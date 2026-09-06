import type { JobPosting, SiteAdapterResult } from './types';

/**
 * 리멤버는 로그인 뒤에만 채용 제안/공고 피드가 보인다 — 비로그인 조회가 원천적으로
 * 불가능해 CGV 엔드포인트를 알아낸 것과 같은 방식으로만 붙일 수 있다:
 *
 *   1. 본인 계정으로 리멤버에 로그인한 브라우저에서 DevTools > Network 탭을 연다.
 *   2. 채용 제안/공고 피드를 새로고침해 실제 API 요청을 찾는다(요청 URL, 필요한
 *      쿠키/헤더, 응답 JSON의 필드명 — 회사명, 공고 제목, 지역, 고용형태, 경력, 링크,
 *      공고 ID에 해당하는 키).
 *   3. 요청에 쓰인 세션 쿠키를 REMEMBER_SESSION_COOKIE 환경변수로(Vercel에) 등록한다.
 *      User-Agent도 응답에 영향을 준다면 REMEMBER_USER_AGENT도 함께 등록한다.
 *   4. 아래 fetchPostings()의 URL/헤더/파싱 로직을 캡처한 실제 요청에 맞춰 채운다.
 *
 * 세션은 언젠가 만료된다 — 만료되면 이 함수가 authFailed: true를 반환하도록 만들어
 * 두면(401·로그인 페이지 리다이렉트·빈 응답 등을 감지) 크론 라우트가 "리멤버 세션
 * 만료 — 갱신 필요" 알림을 한 번만 보낸다. 그때 다시 1~3번을 반복하면 된다.
 */

export async function fetchPostings(): Promise<SiteAdapterResult> {
  const sessionCookie = process.env.REMEMBER_SESSION_COOKIE;
  if (!sessionCookie) {
    // 아직 캡처된 세션이 없음 — 사람이 개입해야 하므로 인증 실패로 취급
    return { postings: [], authFailed: true };
  }

  // TODO: 실제 캡처한 요청으로 교체.
  // const res = await fetch('https://career.rememberapp.co.kr/api/...', {
  //   headers: {
  //     Cookie: sessionCookie,
  //     'User-Agent': process.env.REMEMBER_USER_AGENT ?? DEFAULT_UA,
  //   },
  // });
  // if (res.status === 401 || res.redirected) return { postings: [], authFailed: true };
  // ... 응답 파싱 후 JobPosting[]으로 매핑 ...

  const postings: JobPosting[] = [];
  return { postings };
}
