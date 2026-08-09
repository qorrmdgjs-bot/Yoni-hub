# CGV IMAX 오디세이 모니터

용산아이파크몰 IMAX 상영 알림 시스템 (Yoni-hub 4번째 앱)

## 현재 상태

| 항목 | 상태 |
|------|------|
| 배포 | Ready (diet-daily.vercel.app/cgv) |
| 자동 체크 | GitHub Actions 30분마다 |
| Vercel Cron | 하루 1회 백업 (Hobby 플랜) |
| ntfy 토픽 | cgv-imax-odyssey |
| Supabase | jejomunoscgnozdgojcj 프로젝트 |
| 체크 범위 | 오늘부터 30일간 |

## 알림 조건

### 1. 새 날짜 오픈
용산아이파크몰에 오디세이 IMAX 상영이 새로 편성되면 ntfy 알림.
이전에 없던 날짜/시간이 추가될 때만 발송 (중복 없음).

### 2. 8석 이상 확보
기존 상영 중 잔여석이 8석 이상이 되면 알림.
취소표로 좌석이 풀렸을 때 감지.
8석 미만으로 떨어지면 리셋 → 재확보 시 재알림.

## 동작 구조
GitHub Actions (30분마다)
└─▶ Vercel API /api/cron/cgv-check
├─ CGV API 호출 (30일간, 용산 0013)
├─ IMAX 필터링
├─ Supabase 기존 기록 비교
├─ 새 상영 → ntfy 알림 + DB 저장
├─ ≥8석 → ntfy 알림 + 플래그
└─ <8석 → 플래그 리셋

## CGV API

- 엔드포인트: `GET cgv.co.kr/api/v1/booking/searchSchByMov`
- 파라미터:
  - `coCd=A420` (회사 코드)
  - `siteNo=0013` (용산아이파크몰)
  - `scnYmd=YYYYMMDD` (상영 날짜)
  - `movNo=30001323` (오디세이 영화 번호)
  - `rtctlScopCd=08` (조회 범위)
- 필터: `scnsNm` 또는 `expoScnsNm`에 "IMAX" 포함
- 응답: `json.data` 배열, `stcnt`/`frSeatCnt`는 문자열이므로 Number() 변환
- IMAX관 정보: 총 624석, 하루 6회 상영 (07:30, 11:00, 14:30, 18:00, 21:30, 25:00)

## 화면 기능 (/cgv)

- **지금 확인하기** — 수동 CGV API 호출, 결과 3분기 (새 날짜 / 8석 확보 / 변동 없음)
- **CGV 예매 바로가기** — CGV 예매 페이지 바로 이동
- **테스트 알림 보내기** — ntfy 연결 확인용 테스트 알림
- **마지막 확인 시각** — 최근 체크 시점 표시
- **상영 카드** — 날짜, 시간, 관명, 잔여석 + 예매하기 링크

## 파일 구조

| 파일 | 역할 | 상태 |
|------|------|------|
| `src/utils/cgv.ts` | CGV API 호출 + IMAX 필터링 | NEW |
| `src/utils/ntfy.ts` | ntfy.sh 알림 전송 | NEW |
| `src/app/api/cron/cgv-check/route.ts` | 체크 + 알림 + DB 저장 (핵심) | NEW |
| `src/app/api/cgv-test-ntfy/route.ts` | ntfy 테스트 알림 API | NEW |
| `src/app/cgv/page.tsx` | 모니터 UI 페이지 | NEW |
| `src/app/page.tsx` | 랜딩에 CGV IMAX 카드 | MOD |
| `vercel.json` | Vercel Cron 스케줄 | MOD |
| `.github/workflows/cgv-check.yml` | GitHub Actions 30분 자동 체크 | NEW |

## Supabase 테이블

```sql
CREATE TABLE cgv_screenings (
  id serial PRIMARY KEY,
  screening_date text NOT NULL,
  start_time text NOT NULL,
  screen_name text NOT NULL,
  movie_name text NOT NULL,
  total_seats int,
  free_seats int,
  first_seen_at timestamptz DEFAULT now(),
  notified boolean DEFAULT false,
  notified_8seats boolean DEFAULT false
);
CREATE UNIQUE INDEX ON cgv_screenings(screening_date, start_time, screen_name);
ALTER TABLE cgv_screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON cgv_screenings FOR ALL TO anon USING (true) WITH CHECK (true);
환경변수 (Vercel)
변수	설명
NEXT_PUBLIC_SUPABASE_URL	Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY	Supabase anon 공개 키
ANTHROPIC_API_KEY	Claude API 키 (AI 분석용)
NTFY_TOPIC	ntfy 토픽명
자동 체크 (GitHub Actions)
30분마다 실행 (*/30 * * * *)
월 ~1,440분 사용 (무료 한도 2,000분)
초과 시 자동 정지 (과금 없음)
수동 실행: Actions 탭 → Run workflow
트러블슈팅 기록
문제	원인	해결
API 응답 0건	searchMovScnInfo 사용	searchSchByMov + movNo=30001323으로 변경
DB fetch failed (schema cache)	잘못된 Supabase 프로젝트에 테이블 생성	올바른 프로젝트(jejomunoscgnozdgojcj)에 재생성
Invalid API key	Vercel 환경변수가 이전 프로젝트 키	현재 프로젝트의 publishable key로 교체
Vercel Cron 거부	5분 간격은 Hobby 플랜 불가	하루 1회로 변경 + GitHub Actions 30분 보완
수동 체크 401	CRON_SECRET 인증	?manual=true 파라미터로 우회
22일까지만 표시	14일간만 체크	30일로 확장
링크
CGV IMAX 모니터
Yoni-hub 메인
GitHub Actions
ntfy 토픽
GitHub 레포
Supabase 대시보드
