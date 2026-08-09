import { NextResponse } from 'next/server';
import { sendNtfy } from '@/utils/ntfy';

export async function GET() {
  const ok = await sendNtfy(
    '🔔 테스트 알림',
    'CGV IMAX 모니터 연결 확인!\nntfy 정상 동작 중입니다. 🎬',
    3
  );
  return NextResponse.json({ sent: ok });
}
