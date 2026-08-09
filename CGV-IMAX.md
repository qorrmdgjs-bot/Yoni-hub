# CGV IMAX 오디세이 모니터

용산아이파크몰 IMAX 상영 알림 시스템 (Yoni-hub 4번째 앱)

## 현재 상태

| 항목 | 상태 |
|------|------|
| 배포 | Ready (diet-daily.vercel.app/cgv) |
| 자동 체크 | GitHub Actions 30분마다 |
| ntfy 토픽 | cgv-imax-odyssey 구독 완료 |
| Supabase | cgv_screenings 테이블 생성 완료 |

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
├─ CGV API 호출 (14일간, 용산 0013)
├─ IMAX 필터링
├─ Supabase 기존 기록 비교
├─ 새 상영 → ntfy 알림 + DB 저장
├─ ≥8석 → ntfy 알림 + 플래그
└─ <8석 → 플래그 리셋

## CGV API

- 엔드포인트: `GET cgv.co.kr/api/v1/booking/searchSchByMov`
- 파라미터: `coCd=A420`, `siteNo=0013`, `scnYmd=YYYYMMDD`, `movNo=30001323`, `rtctlScopCd=08`
- 필터: `scnsNm` 또는 `expoScnsNm`에 "IMAX" 포함
- IMAX관: 총 624석, 하루 6회 상영

## 화면 기능 (/cgv)

- **지금 확인하기** — 수동 CGV API 호출, 결과 3분기 (새 날짜 / 8석 확보 / 변동 없음)
- **CGV 예매 바로가기** — CGV 예매 페이지 바로 이동
- **테스트 알림 보내기** — ntfy 연결 확인용 테스트 알림
- **마지막 확인 시각** — 최근 체크 시점 표시
- **상영 카드** — 날짜, 시간, 관명, 잔여석 + 예매하기 링크

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/utils/cgv.ts` | CGV API 호출 + IMAX 필터링 |
| `src/utils/ntfy.ts` | ntfy.sh 알림 전송 |
| `src/app/api/cron/cgv-check/route.ts` | 체크 + 알림 + DB 저장 (핵심) |
| `src/app/api/cgv-test-ntfy/route.ts` | ntfy 테스트 알림 API |
| `src/app/cgv/page.tsx` | 모니터 UI 페이지 |
| `src/app/page.tsx` | 랜딩에 CGV IMAX 카드 (수정) |
| `vercel.json` | Cron 스케줄 (수정) |
| `.github/workflows/cgv-check.yml` | GitHub Actions 30분 자동 체크 |

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
링크
CGV IMAX 모니터
Yoni-hub 메인
GitHub Actions
ntfy 토픽
