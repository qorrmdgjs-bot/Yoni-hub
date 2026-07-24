'use client';

import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createRepository, requestPersistentStorage } from '@job/storage';
import { setRepository } from '@job/storage/current';
import { hydrate, startAutosave } from '@job/store/persistence';
import { syncWithCloud, startCloudPush } from '@job/storage/cloud';
import { router } from '@job/routes';

type Boot = { phase: 'loading' } | { phase: 'ready' } | { phase: 'error'; message: string };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

  useEffect(() => {
    let stopAutosave: (() => void) | undefined;
    let stopCloudPush: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const repo = await createRepository();
        setRepository(repo);
        await hydrate(repo);
        if (cancelled) return;

        // 폰↔PC 동기화: 클라우드와 병합(어느 기기 데이터도 잃지 않음).
        // 실패해도(테이블·네트워크·환경변수 문제) 조용히 로컬로 계속 동작한다.
        try {
          await syncWithCloud(repo);
        } catch {
          /* 클라우드 문제로 앱 시작이 막히면 안 된다 */
        }
        if (cancelled) return;

        // 브라우저의 자동 삭제 대상에서 제외해 달라고 요청한다.
        void requestPersistentStorage();
        stopAutosave = startAutosave(repo);
        stopCloudPush = startCloudPush();
        setBoot({ phase: 'ready' });
      } catch (e) {
        if (!cancelled) {
          setBoot({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
        }
      }
    })();

    return () => {
      cancelled = true;
      stopAutosave?.();
      stopCloudPush?.();
    };
  }, []);

  if (boot.phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="mr-2 animate-spin" size={18} /> 불러오는 중…
      </div>
    );
  }

  if (boot.phase === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-300 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">앱을 시작하지 못했습니다</p>
          <p className="mt-2 text-xs text-red-700">{boot.message}</p>
          <p className="mt-3 text-xs text-slate-600">
            브라우저를 새로고침해 보시고, 계속 같은 문제가 나타나면 시크릿 모드가 아닌 일반 창에서
            열어 보세요.
          </p>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
