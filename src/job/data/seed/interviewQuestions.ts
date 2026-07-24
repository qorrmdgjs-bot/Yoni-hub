import type { InterviewPrep, InterviewPrepId, QuestionCategory } from '@job/schema/entities';
import { nowISO } from '@job/lib/date';

/**
 * 경영지원 경력직 면접 질문 기본 세트.
 * 실제 면접에서 반복적으로 나오는 것들 + 준비 없이 들어가면 무너지는 것들.
 */
interface SeedQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  hint?: string;
}

export const SEED_QUESTIONS: SeedQuestion[] = [
  // ── 재무 / 회계 / 세무
  {
    id: 'q-close-process',
    category: 'finance',
    question: '월결산 프로세스를 처음부터 끝까지 설명해 주세요.',
    hint: '마감 일정, 담당 범위, 검증 절차 순으로. 며칠에 마감하는지 숫자를 넣을 것.',
  },
  {
    id: 'q-close-improve',
    category: 'finance',
    question: '결산 마감일을 단축하거나 프로세스를 개선한 경험이 있나요?',
    hint: '가장 배점이 큰 질문. "D+10 → D+5로 단축" 같은 정량 성과로 답할 것.',
  },
  {
    id: 'q-tax-audit',
    category: 'finance',
    question: '세무조사 또는 세무 이슈에 대응한 경험을 말씀해 주세요.',
    hint: '어떤 자료를 준비했고 세무대리인과 어떻게 역할을 나눴는지.',
  },
  {
    id: 'q-tax-filing',
    category: 'finance',
    question: '직접 신고해 본 세목의 범위는 어디까지인가요? (부가세, 법인세, 원천세)',
  },
  {
    id: 'q-audit',
    category: 'finance',
    question: '외부감사 대응 경험이 있나요? 감사인이 주로 어떤 자료를 요구했나요?',
  },
  {
    id: 'q-erp',
    category: 'finance',
    question: 'ERP 도입이나 전환 프로젝트에 참여한 경험이 있나요?',
    hint: '중견기업 이상에서 자주 묻는다. 어떤 모듈을, 어떤 역할로.',
  },
  {
    id: 'q-standards',
    category: 'finance',
    question: '실무에서 판단이 어려웠던 회계처리 사례와 어떻게 결론 내렸는지 말씀해 주세요.',
  },

  // ── 인사 / 총무
  {
    id: 'q-hr-issue',
    category: 'hr',
    question: '인사노무 이슈를 처리한 사례를 말씀해 주세요.',
    hint: '징계, 권고사직, 근로시간 이슈 등. 결과보다 절차를 어떻게 지켰는지가 평가 포인트.',
  },
  {
    id: 'q-payroll',
    category: 'hr',
    question: '급여·4대보험·연말정산 실무를 어디까지 직접 하셨나요?',
  },
  {
    id: 'q-labor-law',
    category: 'hr',
    question: '근로기준법 개정이나 제도 변경에 대응해 사내 규정을 정비한 경험이 있나요?',
  },
  {
    id: 'q-ga',
    category: 'hr',
    question: '총무 업무 중 비용을 절감하거나 계약 조건을 개선한 사례가 있나요?',
  },

  // ── 공통 / 인성
  {
    id: 'q-why-leave',
    category: 'general',
    question: '이직을 결심하신 이유는 무엇인가요?',
    hint: '현 직장 험담은 금물. "무엇을 더 하고 싶은지"로 프레임을 바꿀 것.',
  },
  {
    id: 'q-salary',
    category: 'general',
    question: '희망 연봉은 얼마이고, 그 근거는 무엇인가요?',
    hint: '처우협의에서 가장 자주 무너지는 질문. 시세(크레딧잡) + 현재 연봉 + 담당 범위 확대를 근거로 준비할 것. 먼저 숫자를 던지지 말고 범위로 답하는 편이 안전하다.',
  },
  {
    id: 'q-priority',
    category: 'general',
    question:
      '소수 인원 조직에서 재무·인사·총무를 동시에 맡을 때 업무 우선순위를 어떻게 정하시겠어요?',
    hint: '스타트업·중소기업 경영지원 포지션의 단골 질문. 법정 기한이 있는 업무를 최우선에 두는 논리로.',
  },
  {
    id: 'q-cpa',
    category: 'general',
    question: '회계사 시험 준비 경험이 실무에 어떻게 도움이 되었나요?',
    hint: '"공부했다"가 아니라 "그 지식으로 무엇을 판단했다"로 연결할 것.',
  },
  {
    id: 'q-expect',
    category: 'general',
    question: '저희 회사에서 어떤 역할을 하고 싶으신가요?',
    hint: 'DART 재무제표와 채용 공고를 근거로 답하면 준비도가 드러난다.',
  },
  {
    id: 'q-conflict',
    category: 'general',
    question: '타 부서와 의견이 충돌했을 때 어떻게 해결하셨나요?',
    hint: '경영지원은 통제 부서라 반드시 나온다. 원칙을 지키면서 합의점을 찾은 사례로.',
  },
  {
    id: 'q-question-back',
    category: 'general',
    question: '(역질문) 저희에게 궁금한 점이 있으신가요?',
    hint: '팀 구성, 전임자 퇴사 사유, 결산 일정, 상급자 보고 라인. 준비 안 하면 준비 부족으로 읽힌다.',
  },

  // ── AI / 디지털
  {
    id: 'q-ai-tools',
    category: 'ai',
    question: '업무에 AI나 자동화 도구를 활용해 본 경험이 있나요?',
    hint: '경영지원 직군에서 확실한 차별화 포인트. Claude로 엑셀 데이터 분석·보고서 초안 자동화 등 구체 사례 + 절감한 시간.',
  },
  {
    id: 'q-excel',
    category: 'ai',
    question: '반복 업무를 자동화해 시간을 줄인 사례가 있나요?',
    hint: '엑셀 함수·매크로·쿼리 등. "월 O시간 절감"처럼 정량화할 것.',
  },
];

export function seedInterviewPreps(): Record<string, InterviewPrep> {
  const at = nowISO();
  const out: Record<string, InterviewPrep> = {};
  for (const q of SEED_QUESTIONS) {
    out[q.id] = {
      id: q.id as InterviewPrepId,
      question: q.question,
      category: q.category,
      createdAt: at,
      updatedAt: at,
      ...(q.hint === undefined ? {} : { myAnswer: '' }),
    };
  }
  return out;
}

/** 질문 id → 준비 힌트 (데이터가 아니라 가이드라 스토어에 넣지 않는다) */
export const QUESTION_HINTS: Record<string, string> = Object.fromEntries(
  SEED_QUESTIONS.filter((q) => q.hint).map((q) => [q.id, q.hint as string]),
);
