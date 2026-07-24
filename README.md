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
| 💼 **Job Finder** | `/job` | 이직 지원 현황(파이프라인·면접·기준)을 한 곳에서 관리 |

랜딩 페이지(`/`)에서 세 앱을 카드로 고릅니다.

## 데이터 저장 방식 (중요)

- **핵심 기록은 모두 브라우저에 저장됩니다** — 로그인이 없고, 기기·브라우저마다 따로 저장됩니다.
  - 체중·수면 기록: `localStorage`
  - Job Finder(이직): `IndexedDB`
  - → **PC와 휴대폰의 데이터는 자동으로 동기화되지 않습니다.** 브라우저 데이터를 지우면 사라지므로 백업(내보내기)이 중요합니다.
  - → 접속 **주소가 바뀌면** 브라우저 저장 데이터는 새 주소에서 보이지 않습니다(그래서 URL은 그대로 둡니다).
- **AI 분석 기능**(다이어트·수면의 `/analysis`)만 서버를 씁니다 — Supabase + Anthropic API.

## 기술 스택

- **Next.js 16** (App Router) · **React 19** · TypeScript · **Tailwind CSS v4**
- recharts(차트) · date-fns(날짜) · next-themes(다크모드)
- Supabase + Anthropic SDK — AI 분석 기능 전용
- **Job Finder**는 원래 Vite로 만든 별도 앱을 이 저장소 `src/job/`으로 이식해 `/job`에 마운트했습니다
  (zustand · zod · idb · @dnd-kit · react-router-dom 사용).

## 폴더 구조

```
src/
├─ app/                  # Next.js 라우트
│  ├─ page.tsx           #   랜딩(앱 3개 선택 카드)
│  ├─ dashboard, input, graph, analysis, settings …   # Diet Daily
│  ├─ sleep/…            #   Well-Sleep
│  ├─ api/…              #   AI 분석 API (Supabase·Anthropic)
│  └─ job/page.tsx       #   Job Finder를 클라이언트 전용으로 마운트
├─ job/                  # Job Finder 소스 (이식본, 유일한 소스)
│  ├─ features, store, schema, storage, lib, components, data
│  ├─ job.css            #   /job에서만 폰트·크기를 되돌리는 스코프 CSS
│  ├─ CLAUDE.md, PLAN.md, README.md, docs/   # Job Finder 문서
├─ lib, utils, components, constants, types   # 다이어트·수면 공용
```

Job Finder를 수정하려면 [`src/job/`](./src/job/) 폴더를 보세요.
규칙·구조는 [`src/job/CLAUDE.md`](./src/job/CLAUDE.md)에 정리돼 있습니다.

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

## 배포

- GitHub `main`에 반영하면 Vercel이 자동 배포합니다 → `https://diet-daily.vercel.app`
- 환경변수는 Vercel 프로젝트 설정에 등록돼 있습니다(현재 Production 범위).
