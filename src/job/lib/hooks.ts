import { useEffect, useState } from 'react';
import { todayISO } from './date';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** 마우스가 있는 기기인지. 터치 전용이면 드래그앤드롭 센서를 등록하지 않는다. */
export function useHasFinePointer(): boolean {
  return useMediaQuery('(pointer: fine)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

/**
 * '오늘'을 문자열로 반환하고 자정에 갱신한다.
 * D-day·무응답 경과일이 밤새 켜둔 탭에서 틀리지 않게 하는 장치.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 5, 0);
      timer = window.setTimeout(() => {
        setToday(todayISO());
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };
    schedule();

    // 탭을 다시 열었을 때도 즉시 맞춘다 (setTimeout은 절전 중 밀린다).
    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(todayISO());
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
}
