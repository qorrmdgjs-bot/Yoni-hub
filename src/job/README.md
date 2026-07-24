# Job Finder (`/job`)

경영지원 경력직의 **이직 관리 앱**. diet-daily 포털의 `/job` 라우트로 서비스됩니다.

- 실사용자는 비개발자입니다. 기능은 더하기보다 **덜어내는** 쪽이 기본값입니다.
- 데이터는 **브라우저 IndexedDB에만** 저장됩니다(포털의 다른 앱이 쓰는 Supabase 미사용).
- 원래 별도 저장소(`job_finder`)였고 지금은 **여기가 유일한 소스**입니다(원본은 Archive).

## 문서
- [CLAUDE.md](./CLAUDE.md) — 깨면 안 되는 규칙·구조·다음 작업 (**수정 전 필독**)
- [PLAN.md](./PLAN.md) — 기획·설계 의사결정
- [docs/manual-qa.md](./docs/manual-qa.md) — 눈으로 확인하는 검증 체크리스트

## 통합 구조 (포털 안에서 어떻게 도는가)
- `src/app/job/page.tsx` — `/job` 라우트. Job Finder를 클라이언트 전용(`ssr:false`)으로 마운트.
- `src/job/App.tsx` — 부팅(IndexedDB 하이드레이션) + hash 라우터.
- `src/job/job.css` — 포털의 손글씨 폰트·18px를 `/job`에서만 되돌리는 스코프 CSS.
- import alias는 `@job/*` (원본의 `@/*`에서 변경됨).
