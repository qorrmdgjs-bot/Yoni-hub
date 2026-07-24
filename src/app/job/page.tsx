'use client';

import dynamic from 'next/dynamic';
import '../../job/job.css';

/**
 * Job Finder를 포털의 /job 라우트로 마운트한다.
 *
 * Job Finder는 Vite로 만든 hash 라우터 SPA라, 여기서는 통째로 클라이언트 전용으로 띄운다.
 * - ssr: false — IndexedDB·window 등 브라우저 전용 API를 서버에서 건드리지 않게 한다.
 * - 내부 라우팅은 hash(#/dashboard, #/pipeline …)라서 Next 라우터와 충돌하지 않는다.
 *   따라서 필요한 Next 라우트는 이 /job 하나뿐이다.
 */
const JobFinderApp = dynamic(() => import('../../job/App'), {
  ssr: false,
  loading: () => (
    <div className="jobfinder-root items-center justify-center text-slate-500">
      불러오는 중…
    </div>
  ),
});

export default function JobPage() {
  return (
    <div className="jobfinder-root">
      <JobFinderApp />
    </div>
  );
}
