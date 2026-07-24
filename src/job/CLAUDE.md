# CLAUDE.md

이 파일은 Job Finder를 수정할 때 참고하는 지침입니다.

> **📁 위치 안내 — 꼭 읽으세요.**
> Job Finder는 원래 별도 저장소(`job_finder`, Vite 앱)였고, 지금은 이 diet-daily 포털 안
> **`src/job/`** 폴더로 이식돼 `/job` 라우트로 서비스됩니다. **원본 job_finder 저장소는 Archive(보관)** 되었고,
> 앞으로 수정은 **여기(diet-daily) 한 곳에서만** 합니다.
>
> 아래 문서의 경로 표기는 원본 기준(`src/features/...`)이라, **이 저장소에서는 앞에 `src/job/`을 붙여** 읽으세요.
> 예: `src/features/pipeline/` → `src/job/features/pipeline/`, `src/store/` → `src/job/store/`.
> import alias도 원본은 `@/`였지만 여기서는 **`@job/`** 입니다 (예: `@job/store`, `@job/schema/entities`).
> 포털 통합 관련(마운트·스코프 CSS·나가기 버튼)은 `src/app/job/page.tsx`, `src/job/job.css`,
> `src/job/components/layout/AppShell.tsx`를 참고하세요.

이 파일은 이 저장소에서 작업할 때 Claude Code가 참고하는 지침입니다.

## 프로젝트

경영지원(재무/회계/세무/인사/총무) 경력직 **1인이 쓰는 개인용 이직 관리 웹앱**.
백엔드·로그인 없이 브라우저(IndexedDB)에만 저장합니다. 사용자는 비개발자이고 **PC와 휴대폰을 함께** 씁니다.

> **실사용자는 이 저장소를 만드는 사람이 아니라 그 배우자입니다.** 이런 도구에 익숙하지 않은 사람이 씁니다.
> 그래서 이 앱은 **기능을 더하는 것보다 덜어내는 쪽이 기본값**입니다. 화면은 숫자를 보여주는 게 아니라
> "지금 뭘 하면 되는지"를 먼저 보여줘야 하고, 메뉴·라벨에 업계 용어(파이프라인, CRM, 대시보드)를 쓰지 않습니다.
> 정보 블록을 추가하기 전에 **"이걸 보고 할 행동이 있나?"**를 먼저 물어보세요.

전체 기획은 [PLAN.md](PLAN.md), 검증 절차는 [docs/manual-qa.md](docs/manual-qa.md).

```bash
npm run dev        # http://localhost:5173 (server.host 켜져 있어 폰에서도 접속 가능)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + 프로덕션 빌드
```

## 스택

React 19 · Vite 7 · TypeScript(strict + `noUncheckedIndexedAccess`) · Tailwind v4(CSS-first, 설정 파일 없음)
zustand + immer · zod 4 · idb(IndexedDB) · @dnd-kit · react-router `createHashRouter` · date-fns

## 디렉토리

```
src/
├─ schema/      zod 스키마 = 타입·검증·마이그레이션의 단일 소스
├─ storage/     IndexedDB 저장소, 가져오기 preview/commit 분리
├─ store/       zustand 상태 + hydrate/autosave + selectors(파생값)
├─ features/    탭별 화면. feature 간 직접 import 금지 (store/lib/components 경유)
├─ components/  ui.tsx(공용 UI) + layout/AppShell
├─ data/seed/   플랫폼 가이드·면접 질문·이직 기준 (코드가 아닌 데이터로 분리)
└─ lib/         date, company, download, hooks, cn, id
```

---

## 🔒 깨면 안 되는 규칙

이 앱의 핵심 가치는 **개인 기록을 잃지 않는 것**입니다. 아래는 그걸 지탱하는 불변 조건입니다.

1. **`moveApplication()`이 단계 변경의 유일한 진입점**
   `src/features/pipeline/PipelinePage.tsx`의 `changeStage()` → store의 `moveApplication()`.
   드래그앤드롭과 드롭다운이 둘 다 여기로 들어옵니다. 단계 이력·`lastContactAt` 갱신이 한 곳에만 있어야
   두 경로의 동작이 어긋나지 않습니다. 새 경로(단축키, 일괄 변경 등)를 추가해도 반드시 이 함수를 호출하세요.

2. **파생값을 스토어에 저장하지 말 것**
   무응답 경과일, D-day, 퍼널 전환율 등은 전부 `store/selectors/insights.ts`의 순수 함수입니다.
   캐시하는 순간 가져오기·수동 편집 후 원본과 어긋나고, 그 불일치는 사용자가 알아채지 못합니다.
   '오늘'에 의존하는 계산은 **반드시 `today: string`을 인자로** 받습니다(`useToday()` 훅이 자정에 갱신).

3. **`previewImport()`는 순수 함수로 유지**
   스토어도 IndexedDB도 건드리지 않습니다. 부수효과는 전부 `commitImport()`에.
   이 분리 때문에 "잘못된 JSON을 넣어도 기존 데이터가 손상되지 않는다"가 구조적으로 보장됩니다.
   검증 통과 전에 저장소를 만지는 코드를 절대 넣지 마세요.

4. **삭제는 cascade 금지 — soft-unlink**
   문서를 지워도 지원 건은 남기고 `documentId`만 `undefined`로 만듭니다(store의 `deleteDocument` 참고).
   개인 기록 앱에서 연쇄 삭제는 최악의 동작입니다.

5. **마이그레이션 함수에서 zod 스키마를 import하지 말 것**
   스키마는 항상 최신 버전이라 과거 버전 데이터에 적용할 수 없습니다. `any` 변환만 하세요.

6. **스키마를 바꾸면 `SCHEMA_VERSION`을 올리고 마이그레이션을 추가**
   `src/schema/version.ts` + `src/schema/migrations/index.ts`. **현재 v3**
   (v1→v2 = Application에 헤드헌터 필드 추가(선택 필드라 변환 없음),
   v2→v3 = Settings에 `employed`(재직 여부) 추가. **필수 필드**라 기존 데이터에 `true`를 채워 넣습니다).
   `assertChainIsContinuous()`가 부팅 때 체인이 끊겼는지 검사합니다.
   *선택 필드 추가만 하는 경우에도* 기존 데이터가 검증을 통과하는지 확인하세요.

7. **날짜는 전 계층에서 문자열**
   날짜만 → `'yyyy-MM-dd'`, 타임스탬프 → full ISO. `Date` 객체를 스토어·IndexedDB에 넣지 마세요
   (IndexedDB는 Date를 살려주지만 JSON 내보내기에서 문자열이 되어 왕복 시 타입이 달라집니다).

8. **`companyNormalized`는 반드시 `normalizeCompany()`로 채울 것**
   중복지원 감지가 이 필드만 봅니다. `Application`은 store가 자동으로 채웁니다.
   지원 건을 만드는 새 경로를 추가하더라도 `createApplication()`을 거치게 해서 이 필드가 비지 않게 하세요.

9. **긴 텍스트 입력은 한글 IME 안전하게**
   인라인 편집은 `CommitInput` / `CommitTextarea`(로컬 state + blur 커밋)를 쓰세요.
   조합 중에 상위 상태로 커밋하면 커서가 튀고 글자가 깨집니다.
   모달 폼은 로컬 draft + 저장 버튼 방식이라 이 문제가 없습니다.

10. **터치 기기에서 DnD 센서를 등록하지 말 것**
    `PipelinePage`에서 `useHasFinePointer()`로 판정합니다.
    칸반 가로 스크롤과 드래그가 충돌해 스크롤이 먹통 되는 게 반쪽짜리 DnD보다 나쁩니다.
    모바일은 `md` 미만에서 단계 탭 + 세로 리스트로 전환됩니다.

11. **저장 실패 시 아무것도 지우지 말 것**
    quota 초과 등에서 메모리 상태는 그대로 두고 경고 배너 + 원클릭 내보내기만 제공합니다
    (`AppShell`의 `StorageBanner`). 그 내보내기는 메모리에서 직접 만들기 때문에 IndexedDB가 죽어도 동작합니다.

---

## 현재 상태

탭은 **6개**이고, 순서가 곧 실제 이직 진행 순서입니다 (`components/layout/AppShell.tsx`의 `NAV`).
**기준(왜) → 준비(무엇을 먼저) → 지원 현황(어떻게 되고 있나) → 면접** 순서를 바꾸지 마세요.
특히 **준비가 앞쪽**에 있어야 합니다 — 재직 중 이직에서 현직 노출 차단이 가장 먼저 해야 할 일인데,
뒤쪽 탭에 있으면 마지막에 발견하게 됩니다.

| # | 탭 | 경로 | 파일 | 상태 |
|---|---|---|---|---|
| 1 | 홈 | `/dashboard` | `features/dashboard/DashboardPage.tsx` | ✅ 월 달력 · 챙겨야 할 것 · 요약 3칸 |
| 2 | 기준 | `/criteria` | `features/criteria/CriteriaPage.tsx` | ✅ 읽기 전용. 이직의 기준 + 지금 판단이 필요한 곳 |
| 3 | 준비 | `/platforms` | `features/platforms/PlatformsPage.tsx` | ✅ 8개 플랫폼, 현직 노출 차단 체크리스트(재직 중일 때만) |
| 4 | 지원 현황 | `/pipeline` | `features/pipeline/` | ✅ 9단계 칸반, DnD+드롭다운, 중복감지, 상세 모달, 헤드헌터 |
| 5 | 면접 | `/interview` | `features/ComingSoon.tsx` | ⏳ 미구현 (질문 20개는 이미 저장돼 있음) |
| 6 | 설정 | `/settings` | `features/settings/SettingsPage.tsx` | ✅ 내보내기·미리보기 가져오기·저장소 상태·알림 기준 |

모바일 하단 탭바는 6칸이라 좁습니다. 라벨이 두 줄로 깨지면 `NAV`에 `short`를 추가하세요
(현재 `지원 현황` → `지원` 하나만 씁니다).

**재직 여부(`settings.employed`)** — 이 앱은 '재직 중 이직'을 전제로 현직 노출 차단을 최우선 안내하지만,
이미 퇴사해 구직 중인 사용자에게는 그 안내가 전부 불필요합니다. 설정 ▸ 구직 상황에서 끕니다.
`false`면 홈의 '현직 노출 차단' 경고(`listCriticalGaps`가 빈 배열 반환)와 준비 탭의 자물쇠 항목·배너가
모두 사라집니다(체크리스트 항목 자체는 지우지 않고 평범한 항목으로 표시). 현직 노출 관련 UI를 새로 추가할 때는
반드시 이 플래그를 함께 확인하세요.

**기준 탭(`/criteria`)은 읽기 전용입니다 — 편집 기능을 넣지 마세요.**
사용자가 직접 정리한 이직 기준이고, 내용은 `data/seed/criteria.ts`에 있습니다.
앱 안에서 고칠 수 있게 만들면 마음이 흔들릴 때마다 문장을 고치게 되고, 그러면 기준으로서 기능하지 않습니다.
대신 화면 맨 아래에 **최종면접·처우협의·오퍼 단계의 지원 건**을 붙여, 벽에 붙은 문구로 끝나지 않고
실제로 결정을 내리는 순간에 열어보는 화면이 되게 했습니다. 문구 수정은 시드 파일을 직접 고칩니다.

**없앤 탭 — 다시 만들지 마세요**
- **헤드헌터 CRM**: 지원 건 안으로 흡수했습니다. 헤드헌터 제안은 결국 '회사 하나 + 포지션 하나'라
  파이프라인 카드 그 자체입니다. 별도 탭을 두면 같은 회사를 CRM에 한 번, 지원 건에 또 한 번 입력해야 합니다.
  → `Application.recruiterName` / `recruiterFirm` / `recruiterContact` + 기존 `viaSearchFirm`.
  `ApplicationForm`에서 지원 경로를 `headhunter`로 고르면 `viaSearchFirm`이 자동으로 켜집니다
  (수동 체크에 의존하면 빠뜨렸을 때 중복지원 경고가 조용히 약해집니다).
- **문서 관리**: 경력기술서는 한글/워드로 씁니다. 앱 안에서 긴 본문을 편집하는 기능은 넣지 않습니다.
- 두 경로(`/recruiters`, `/documents`)는 `routes.tsx`에서 `/pipeline`으로 리다이렉트합니다.
- `CareerDoc` / `Recruiter` + `Proposal` 스키마와 store 액션은 **남겨뒀습니다**. 데이터를 지우면
  기존 백업 파일을 못 읽게 되기 때문입니다. `duplicateCheck.ts`도 `Recruiter.proposals`를 계속 스캔합니다
  (지금은 비어 있지만 예전 백업에는 들어 있을 수 있음).

**홈 화면의 설계 원칙** — 숫자가 아니라 할 일을 먼저 보여줍니다.
"총 지원 12건"을 봐도 다음 행동이 떠오르지 않지만 "내일 면접"은 떠오릅니다. 그래서
**월 달력 → 챙겨야 할 것 → 요약 3칸** 순서이고, 통계·그래프는 넣지 않습니다
(지원 현황 탭을 열면 그대로 보이는 정보라 중복입니다).
의도적으로 뺀 것: 주간 목표 진행바, 단계별 현황 막대그래프, 총 지원 건 수, 프로필 업데이트 권장 알림.

**홈 달력** (`features/dashboard/MonthCalendar.tsx` + `store/selectors/calendar.ts`)
- 지원 건의 **마감일·다음 일정·지원일**을 그대로 펼쳐 찍습니다. 별도 '일정' 엔티티를 만들지 마세요 —
  지원 현황에서 날짜를 고치면 달력이 즉시 따라와야 하는데, 별도 엔티티를 두면 이 동기화가 깨집니다.
- `buildCalendarEvents()`는 순수 함수입니다(파생값 캐시 금지, 규칙 2). 종료된 건은 마감·일정을 빼고
  지원일만 남깁니다("그 주에 몇 개 넣었나"는 지난 기록이라야 의미가 있음).
- **모바일은 점, 데스크톱은 회사명**으로 나눕니다(`sm:` 분기). 폰 셀은 회사명을 넣기엔 너무 좁습니다.
  날짜를 누르면 달력 아래에 그 날 일정이 뜨고, 아무것도 안 고르면 '곧 있을 일'(3주)이 뜹니다.
- 달력 그리드는 항상 일요일 시작 7의 배수입니다(`monthGridDays`, `src/lib/date.ts`).

---

## 다음 작업

### 면접 — `features/interview/InterviewPage.tsx` (남은 유일한 화면)

- 질문 은행: 카테고리 필터(재무/회계·인사/총무·공통·AI), 답변 초안 저장, 별표
  - `QUESTION_HINTS`를 답변 작성 가이드로 노출 (특히 `q-salary` — 처우협의에서 가장 자주 무너지는 질문)
- 질문 직접 추가/삭제
- 면접 회고 CRUD: 받은 질문 / 잘한 점 / 아쉬운 점 / 다음 액션, 지원 건 연결
- store 액션·스키마는 이미 다 있습니다: `upsertInterviewPrep` / `deleteInterviewPrep` /
  `upsertInterviewReview` / `deleteInterviewReview`, `InterviewPrep` / `InterviewReview`
- 면접 질문 20개 + 힌트가 `data/seed/interviewQuestions.ts`에 있고 첫 실행 시 저장됩니다

### 그 다음 (급하지 않음)

- `storage/snapshots.ts` — 자동 백업 링버퍼 5개 + 복원 UI (마이그레이션·가져오기 직전 자동 생성)
- `src/store/integrity.ts` — 하이드레이션 직후 끊어진 참조 검사(경고만, 자동 삭제 금지)
- 퍼널 전환율 · 플랫폼별 성과 분석 (`store/selectors/`에 자리 있음) — 어느 채널이 실제로 먹히는지
  ⚠️ 단, 홈에 올리지 말 것. 보고 나서 할 행동이 없는 정보입니다
- 오퍼 비교 테이블 (오퍼 2개 이상일 때 가중치 점수)
- 면접 준비 자료 인쇄 스타일
- 번들 코드 스플리팅 (현재 560KB / gzip 178KB — 개인용이라 급하지 않음)

---

## Git / GitHub

- 저장소 초기화 완료. 기본 브랜치 `main`, 첫 커밋 `04e4208` (Phase 1 전체)
- remote: `origin` → https://github.com/qorrmdgjs-bot/job_finder.git
- **아직 push하지 않았습니다.** 첫 push는 `git push -u origin main`
- 커밋 작성자는 이 저장소에만 로컬 설정되어 있습니다
  (`qorrmdgjs-bot <qorrmdgjs-bot@users.noreply.github.com>`).
  GitHub 잔디에 반영되지 않으면 Settings ▸ Emails의 정확한 noreply 주소
  (`12345678+qorrmdgjs-bot@users.noreply.github.com` 형태)로 `git config user.email`을 바꾸세요.
- `.gitattributes`로 줄바꿈을 LF로 통일했습니다. 커밋 전 `git status`로 `dist`가 빠졌는지 확인하세요.
- 리포지토리는 **private 권장** — 코드 자체에는 개인정보가 없지만(데이터는 전부 브라우저에 저장),
  개인 이직 활동용 도구라는 맥락이 공개되지 않는 편이 낫습니다.

**Vercel 배포** (폰에서 URL로 바로 쓰려면)
- GitHub 연결 후 import. 빌드 명령 `npm run build`, 출력 디렉토리 `dist` (기본값 그대로)
- hash 라우터를 쓰므로 SPA rewrite 설정이 필요 없습니다
- 배포해도 PC와 폰의 데이터는 각자 브라우저에 따로 저장됩니다 (JSON 수동 이동 필요)

---

## 개발 환경 주의 — OneDrive

프로젝트가 OneDrive 동기화 폴더 안에 있어 **파일 잠금 문제가 실제로 발생합니다.**

- 관찰된 증상: `dist`가 이미 있는 상태에서 `npm run build` 시 `✓ modules transformed`까지만 나오고
  종료 코드 9로 실패. → `Remove-Item -Recurse -Force dist; npm run build`로 해결
- Vite 캐시(`cacheDir`)는 `vite.config.ts`에서 시스템 임시 폴더로 이미 빼두어 dev 서버는 영향 없음
- 근본 해결: 프로젝트를 `C:\dev\job_finder` 등 OneDrive 밖으로 이동
  (경로의 한글·공백 `OneDrive - DPLANEX` 문제도 함께 해소)

## 검증

브라우저 UI(DnD, 모바일 레이아웃, IME)는 코드로 확인할 수 없으므로
`docs/manual-qa.md`의 체크리스트를 사용자에게 안내하세요.
데이터 안전 로직(가져오기 방어, 중복감지, 날짜 계산)은 순수 함수라 노드에서 직접 실행해 검증할 수 있습니다
— esbuild로 `--alias:@=./src` 번들 후 실행하면 됩니다.
