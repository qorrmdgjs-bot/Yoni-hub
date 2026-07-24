import { Construction } from 'lucide-react';
import { Card, PageHeader } from '@job/components/ui';

/** 아직 안 만든 탭. 빈 화면 대신 무엇이 올지 명시한다. */
function ComingSoon({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="max-w-2xl p-4">
      <PageHeader title={title} description={description} />
      <Card className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Construction size={16} className="text-amber-500" /> Phase 2에서 구현 예정
        </p>
        <ul className="mt-3 space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
              <span className="text-slate-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function InterviewPage() {
  return (
    <ComingSoon
      title="면접"
      description="예상 질문에 답변을 미리 만들어 두고, 끝난 뒤 회고를 남깁니다."
      items={[
        '질문 은행 — 경영지원 직무 기본 질문 20개가 이미 준비되어 있습니다 (재무/회계/세무, 인사/총무, 공통, AI·디지털)',
        '질문마다 나의 답변 초안 작성·저장',
        '면접 회고 — 실제로 받은 질문, 잘한 점, 아쉬운 점, 다음 액션',
        '회고를 지원 건과 연결해 히스토리로 축적',
      ]}
    />
  );
}
