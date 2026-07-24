import { z } from 'zod';
import { APP_TAG } from './version';

/**
 * 내보내기 JSON의 봉투.
 * app 태그가 있어야 다른 앱의 JSON을 잘못 가져오는 사고를 막을 수 있다.
 * data는 여기서 검증하지 않는다 — 마이그레이션을 먼저 통과시켜야 하기 때문.
 */
export const EnvelopeSchema = z.object({
  app: z.literal(APP_TAG),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  data: z.unknown(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;
