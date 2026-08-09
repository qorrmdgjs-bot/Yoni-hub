import { NextRequest, NextResponse } from 'next/server';
import { checkAllDates, formatDateKo, formatTime, type CgvScreening } from '@/utils/cgv';
import { sendNtfy } from '@/utils/ntfy';
import { supabase } from '@/lib/supabase';

const SITE_NO = '0013';
const SITE_NAME = '용산아이파크몰';
const SEATS_THRESHOLD = 8;

interface ExistingRow {
  screening_date: string;
  start_time: string;
  screen_name: string;
  free_seats: number;
  notified_8seats: boolean;
}

export async function GET(request: NextRequest) {
  const isManual = request.nextUrl.searchParams.get('manual') === 'true';
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!isManual && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const screenings = await checkAllDates(SITE_NO, 14);

    if (screenings.length === 0) {
      return NextResponse.json({ checked: 14, found: 0, newDates: 0, seatsAlerts: 0, seatsReset: 0 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('cgv_screenings')
      .select('screening_date, start_time, screen_name, free_seats, notified_8seats');

    if (fetchErr) {
      return NextResponse.json({ error: 'DB fetch failed', detail: fetchErr.message }, { status: 500 });
    }

    const existingMap = new Map<string, ExistingRow>();
    for (const r of (existing ?? []) as ExistingRow[]) {
      existingMap.set(`${r.screening_date}_${r.start_time}_${r.screen_name}`, r);
    }

    const newScreenings: CgvScreening[] = [];
    const seatsAvailable: CgvScreening[] = [];
    const seatsReset: CgvScreening[] = [];

    for (const s of screenings) {
      const key = `${s.date}_${s.startTime}_${s.screenName}`;
      const prev = existingMap.get(key);

      if (!prev) {
        newScreenings.push(s);
      } else {
        if (s.freeSeats >= SEATS_THRESHOLD && !prev.notified_8seats) {
          seatsAvailable.push(s);
        }
        if (s.freeSeats < SEATS_THRESHOLD && prev.notified_8seats) {
          seatsReset.push(s);
        }
      }
    }

    if (newScreenings.length > 0) {
      const { error: upsertErr } = await supabase.from('cgv_screenings').upsert(
        newScreenings.map((s) => ({
          screening_date: s.date,
          start_time: s.startTime,
          screen_name: s.screenName,
          movie_name: s.movieName,
          total_seats: s.totalSeats,
          free_seats: s.freeSeats,
          notified: true,
          notified_8seats: s.freeSeats >= SEATS_THRESHOLD,
        })),
        { onConflict: 'screening_date,start_time,screen_name' }
      );

      if (!upsertErr) {
        const lines = newScreenings.map(
          (s) => `${formatDateKo(s.date)} ${formatTime(s.startTime)} ${s.screenName} (${s.freeSeats}석)`
        );
        await sendNtfy(
          `🎬 오디세이 IMAX 새 날짜 ${newScreenings.length}건!`,
          `${SITE_NAME}\n\n${lines.join('\n')}\n\nhttps://cgv.co.kr/cnm/movieBook/movie`,
          5
        );
      }
    }

    if (seatsAvailable.length > 0) {
      for (const s of seatsAvailable) {
        await supabase
          .from('cgv_screenings')
          .update({ free_seats: s.freeSeats, total_seats: s.totalSeats, notified_8seats: true })
          .eq('screening_date', s.date)
          .eq('start_time', s.startTime)
          .eq('screen_name', s.screenName);
      }

      const lines = seatsAvailable.map(
        (s) => `${formatDateKo(s.date)} ${formatTime(s.startTime)} ${s.screenName} (${s.freeSeats}석)`
      );
      await sendNtfy(
        `🎟️ 오디세이 IMAX ${SEATS_THRESHOLD}석 이상 확보!`,
        `${SITE_NAME}\n\n${lines.join('\n')}\n\n지금 예매하세요!\nhttps://cgv.co.kr/cnm/movieBook/movie`,
        5
      );
    }

    for (const s of seatsReset) {
      await supabase
        .from('cgv_screenings')
        .update({ free_seats: s.freeSeats, total_seats: s.totalSeats, notified_8seats: false })
        .eq('screening_date', s.date)
        .eq('start_time', s.startTime)
        .eq('screen_name', s.screenName);
    }

    const handledKeys = new Set([
      ...newScreenings.map((s) => `${s.date}_${s.startTime}_${s.screenName}`),
      ...seatsAvailable.map((s) => `${s.date}_${s.startTime}_${s.screenName}`),
      ...seatsReset.map((s) => `${s.date}_${s.startTime}_${s.screenName}`),
    ]);
    const others = screenings.filter(
      (s) => !handledKeys.has(`${s.date}_${s.startTime}_${s.screenName}`) && existingMap.has(`${s.date}_${s.startTime}_${s.screenName}`)
    );
    if (others.length > 0) {
      await Promise.all(others.map((s) =>
        supabase
          .from('cgv_screenings')
          .update({ free_seats: s.freeSeats, total_seats: s.totalSeats })
          .eq('screening_date', s.date)
          .eq('start_time', s.startTime)
          .eq('screen_name', s.screenName)
      ));
    }

    return NextResponse.json({
      checked: 14,
      found: screenings.length,
      newDates: newScreenings.length,
      seatsAlerts: seatsAvailable.length,
      seatsReset: seatsReset.length,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Check failed', detail: String(err) }, { status: 500 });
  }
}
