import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@job/components/layout/AppShell';
import { CriteriaPage } from '@job/features/criteria/CriteriaPage';
import { DashboardPage } from '@job/features/dashboard/DashboardPage';
import { PipelinePage } from '@job/features/pipeline/PipelinePage';
import { PlatformsPage } from '@job/features/platforms/PlatformsPage';
import { SettingsPage } from '@job/features/settings/SettingsPage';
import { InterviewPage } from '@job/features/ComingSoon';

/**
 * Hash 라우터를 쓰는 이유:
 * 백엔드가 없어 SPA fallback rewrite를 설정할 수 없는 정적 호스팅에서도
 * /pipeline 직접 진입 시 404가 나지 않는다.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'criteria', element: <CriteriaPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
      { path: 'pipeline/:applicationId', element: <PipelinePage /> },
      { path: 'platforms', element: <PlatformsPage /> },
      { path: 'interview', element: <InterviewPage /> },
      // 없어진 탭 — 예전 주소를 즐겨찾기해 뒀어도 빈 화면이 나오지 않게 한다.
      // 헤드헌터는 지원 건 안으로 흡수됐고, 문서 관리는 만들지 않기로 했다.
      { path: 'recruiters', element: <Navigate to="/pipeline" replace /> },
      { path: 'documents', element: <Navigate to="/pipeline" replace /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);
