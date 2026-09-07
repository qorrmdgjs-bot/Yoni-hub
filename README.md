# Yoni-hub 🌱

일상을 기록하는 **미니 앱 3개**를 한 사이트에 모은 개인용 포털입니다.
첫 화면에서 앱을 고르면 각 기능으로 들어갑니다.

> **이름 안내**: 원래 다이어트 앱 하나로 시작해 저장소 이름이 `diet-daily`였는데,
> 수면·이직 앱이 더해져 `Yoni-hub`로 바꿨습니다.
> **접속 주소는 여전히 `https://diet-daily.vercel.app`** 입니다(Vercel 프로젝트 이름이라 그대로 둡니다 —
> 이미 쓰고 있는 주소이고, 브라우저에 저장된 데이터가 이 주소에 묶여 있기 때문).

## 담긴 앱 3개

| 앱 | 경로 | 하는 일 |
|---|---|---|
| 🦄 **Diet Daily** | `/dashboard` | 매일 체중을 기록하고 추이·예측을 확인 |
| 🌙 **Well-Sleep** | `/sleep` | 매일 수면시간을 기록하고 평균을 확인 |
| 💼 **Job Finder** | `/job` | 사람인·원티드·잡코리아·리멤버에서 조건에 맞는 채용공고가 뜨면 알림 |

랜딩 페이지(`/`)에서 세 앱을 카드로 고릅니다.

## 데이터 저장 방식 (중요)

- **핵심 기록은 모두 브라우저에 저장됩니다** — 로그인이 없고, 기기·브라우저마다 따로 저장됩니다.
  - 체중·수면 기록: `localStorage`
  - → **PC와 휴대폰의 데이터는 자동으로 동기화되지 않습니다.** 브라우저 데이터를 지우면 사라지므로 백업(내보내기)이 중요합니다.
  - → 접속 **주소가 바뀌면** 브라우저 저장 데이터는 새 주소에서 보이지 않습니다(그래서 URL은 그대로 둡니다).
- **AI 분석 기능**(다이어트·수면의 `/analysis`)과 **Job Finder(채용공고 알림)**는 서버를 씁니다 —
  Supabase + Anthropic API, GitHub Actions 30분 자동 체크 + ntfy 푸시(CGV IMAX 모니터와 같은 구조).

## 기술 스택

- **Next.js 16** (App Router) · **React 19** · TypeScript · **Tailwind CSS v4**
- recharts(차트) · date-fns(날짜) · next-themes(다크모드)
- Supabase + Anthropic SDK — AI 분석 기능 전용
- **Job Finder**는 사람인·원티드·잡코리아·리멤버(전부 비공식 API) + 잡플래닛(회사 평점)을
  주기적으로 조회해 조건에 맞는 새 공고를 Supabase에 기록하고 ntfy로 알린다(`src/job/`,
  `/job`). 리멤버만 로그인 토큰이 필요하고 나머지는 로그인 없이 동작한다.

## 폴더 구조

```
src/
├─ app/                  # Next.js 라우트
│  ├─ page.tsx           #   랜딩(앱 3개 선택 카드)
│  ├─ dashboard, input, graph, analysis, settings …   # Diet Daily
│  ├─ sleep/…            #   Well-Sleep
│  ├─ api/…              #   AI 분석 API, 채용공고/CGV 크론 (Supabase·Anthropic)
│  └─ job/page.tsx       #   Job Finder 알림 화면
├─ job/                  # Job Finder 소스
│  ├─ sites/             #   사이트별 어댑터(사람인·원티드·잡코리아·리멤버·잡플래닛)
│  ├─ criteria.ts         #   필터 기준 + "내가 다니고 싶은 회사" 참고 문구
│  └─ lib/company.ts     #   회사명 정규화(잡플래닛 캐시 키)
├─ lib, utils, components, constants, types   # 다이어트·수면·CGV·Job Finder 공용
```

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드
```

AI 분석 기능까지 로컬에서 돌리려면 `.env.local`에 다음이 필요합니다
(없어도 세 앱의 기본 기능과 빌드는 동작합니다):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
```

Job Finder(채용공고 알림)를 로컬에서 완전히 돌리려면 위 Supabase 값에 더해
[`supabase/job-alert-schema.sql`](./supabase/job-alert-schema.sql)을 대시보드에서 먼저 실행해야 한다.
사람인·원티드·잡코리아는 로그인·API 키 없이 바로 동작한다. 리멤버만 아래 환경변수가
필요하다(없으면 리멤버만 "인증 실패"로 표시되고 나머지 3개 사이트는 그대로 동작한다).
값이 만료되면 사용자가 리멤버에 로그인한 채 DevTools Network 탭에서 `job_postings/search`
요청의 `authorization` 헤더 값을 다시 캡처해 갱신해야 한다:

```
REMEMBER_AUTH_TOKEN=Token token=...   # 리멤버 로그인 후 DevTools로 캡처한 Authorization 헤더 값
```

## 배포

- GitHub `main`에 반영하면 Vercel이 자동 배포합니다 → `https://diet-daily.vercel.app`
- 환경변수는 Vercel 프로젝트 설정에 등록돼 있습니다(현재 Production 범위).
