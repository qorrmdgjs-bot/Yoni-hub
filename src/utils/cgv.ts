import { format, addDays } from 'date-fns';

export interface CgvScreening {
  date: string;
  startTime: string;
  endTime: string;
  screenName: string;
  movieName: string;
  totalSeats: number;
  freeSeats: number;
}

interface CgvApiItem {
  scnYmd?: string;
  scnsrtTm?: string;
  scnendTm?: string;
  scnsNm?: string;
  expoScnsNm?: string;
  movNm?: string;
  prodNm?: string;
  expoProdNm?: string;
  movkndDsplNm?: string;
  stcnt?: string | number;
  frSeatCnt?: string | number;
}

const MOV_NO = '30001323';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Referer': 'https://www.cgv.co.kr/cnm/movieBook',
  'Accept': 'application/json',
};

export async function fetchScreenings(siteNo: string, dateStr: string): Promise<CgvApiItem[]> {
  const url = `https://cgv.co.kr/api/v1/booking/searchSchByMov?coCd=A420&siteNo=${siteNo}&scnYmd=${dateStr}&movNo=${MOV_NO}&rtctlScopCd=08`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) return [];
  try {
    const json = await res.json();
    return json?.data ?? [];
  } catch {
    return [];
  }
}

export function filterImax(items: CgvApiItem[]): CgvScreening[] {
  return items
    .filter((item) => {
      const screen = `${item.scnsNm ?? ''} ${item.expoScnsNm ?? ''}`.toUpperCase();
      return screen.includes('IMAX');
    })
    .map((item) => ({
      date: item.scnYmd ?? '',
      startTime: item.scnsrtTm ?? '',
      endTime: item.scnendTm ?? '',
      screenName: (item.expoScnsNm ?? item.scnsNm ?? '').trim(),
      movieName: (item.expoProdNm ?? item.prodNm ?? item.movNm ?? '').trim(),
      totalSeats: Number(item.stcnt) || 0,
      freeSeats: Number(item.frSeatCnt) || 0,
    }));
}

export async function checkAllDates(siteNo: string, days: number = 14): Promise<CgvScreening[]> {
  const results: CgvScreening[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const dateStr = format(addDays(today, i), 'yyyyMMdd');
    try {
      const items = await fetchScreenings(siteNo, dateStr);
      results.push(...filterImax(items));
    } catch {
      // skip
    }
  }
  return results;
}

export function formatDateKo(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr;
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return dateStr;
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${Number(m)}/${Number(d)}(${days[date.getDay()]})`;
}

export function formatTime(timeStr: string): string {
  if (!timeStr || timeStr.length < 4) return timeStr;
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
}
