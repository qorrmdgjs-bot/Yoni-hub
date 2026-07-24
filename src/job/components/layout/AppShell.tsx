import { NavLink, Outlet } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  Check,
  CircleAlert,
  Compass,
  Download,
  Home,
  LayoutGrid,
  ListChecks,
  Loader2,
  MessageSquareText,
  Save,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@job/lib/cn';
import { useAppStore } from '@job/store';
import { downloadText } from '@job/lib/download';
import { saveNow } from '@job/store/persistence';
import { exportFilename, serializeExport } from '@job/storage/importExport';
import { Button } from '@job/components/ui';

/**
 * 포털(diet-daily) 안의 /job 으로 열렸는지 판정.
 * 이때만 "앱 선택으로 나가기" 버튼을 보여준다.
 * 독립 실행(job_finder 단독)에서는 경로가 '/'라 이 버튼이 뜨지 않는다.
 */
function useInPortal(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/job');
}

/** 수동 저장 버튼 — 평소에도 자동 저장되지만, 직접 저장하고 확인하고 싶을 때. */
function SaveButton() {
  const saveState = useAppStore((s) => s.saveState);
  return (
    <Button
      size="sm"
      variant="primary"
      onClick={() => void saveNow()}
      disabled={saveState === 'saving'}
      title="지금 저장합니다 (입력하면 평소에도 자동으로 저장됩니다)"
    >
      <Save size={13} /> 저장
    </Button>
  );
}

/**
 * 순서 = 실제 이직 진행 순서.
 * 준비(현직 노출 차단)를 두 번째에 두는 게 중요하다 — 재직 중 이직에서 가장 먼저,
 * 가장 급하게 해야 할 일인데 뒤쪽 탭에 있으면 마지막에 발견하게 된다.
 */
const NAV = [
  { to: '/dashboard', label: '홈', icon: Home },
  { to: '/criteria', label: '기준', icon: Compass },
  { to: '/platforms', label: '준비', icon: ListChecks },
  // short: 모바일 하단 탭바용. 6칸이라 한 칸이 좁아 두 줄로 깨지는 걸 막는다.
  { to: '/pipeline', label: '지원 현황', short: '지원', icon: Briefcase },
  { to: '/interview', label: '면접', icon: MessageSquareText },
  { to: '/settings', label: '설정', icon: SettingsIcon },
] as const;

function SaveIndicator() {
  const saveState = useAppStore((s) => s.saveState);
  if (saveState === 'saving') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-slate-500">
        <Loader2 size={12} className="animate-spin" /> 저장 중
      </span>
    );
  }
  if (saveState === 'saved') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-600">
        <Check size={12} /> 저장됨
      </span>
    );
  }
  if (saveState === 'error') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
        <CircleAlert size={12} /> 저장 실패
      </span>
    );
  }
  return null;
}

/**
 * 저장이 실패했을 때의 탈출구.
 * 메모리 상태에서 직접 JSON을 만들기 때문에 IndexedDB가 죽어 있어도 동작한다.
 */
function StorageBanner() {
  const saveFailure = useAppStore((s) => s.saveFailure);
  const repoKind = useAppStore((s) => s.repoKind);
  const loadWarning = useAppStore((s) => s.loadWarning);
  const markExported = useAppStore((s) => s.markExported);

  const emergencyExport = () => {
    downloadText(exportFilename(), serializeExport(useAppStore.getState().data));
    markExported();
  };

  const banners: { tone: 'red' | 'amber'; message: string; action?: boolean }[] = [];

  if (saveFailure) {
    banners.push({ tone: 'red', message: `브라우저 저장에 실패했습니다. ${saveFailure.message}`, action: true });
  }
  if (repoKind === 'memory') {
    banners.push({
      tone: 'red',
      message:
        '이 브라우저에서 저장소를 쓸 수 없습니다 (시크릿 모드일 수 있습니다). 새로고침하면 입력한 내용이 사라집니다.',
      action: true,
    });
  }
  if (loadWarning) {
    banners.push({ tone: 'amber', message: loadWarning, action: true });
  }

  if (banners.length === 0) return null;

  return (
    <div className="space-y-px">
      {banners.map((b, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-xs',
            b.tone === 'red' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-900',
          )}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{b.message}</span>
          {b.action && (
            <button
              type="button"
              onClick={emergencyExport}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold',
                b.tone === 'red' ? 'bg-white text-red-700' : 'bg-amber-800 text-white',
              )}
            >
              <Download size={12} /> 지금 내보내기
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function AppShell() {
  const markExported = useAppStore((s) => s.markExported);
  const inPortal = useInPortal();

  const quickExport = () => {
    downloadText(exportFilename(), serializeExport(useAppStore.getState().data));
    markExported();
  };

  return (
    <div className="flex min-h-full flex-col">
      <StorageBanner />

      <div className="flex flex-1">
        {/* 데스크톱 사이드바 */}
        <aside className="hidden w-52 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          {inPortal && (
            <a
              href="/"
              className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <LayoutGrid size={15} /> 앱 선택으로 나가기
            </a>
          )}
          <div className="px-4 py-5">
            <p className="text-sm font-bold text-slate-900">이직 파트너</p>
            <p className="mt-0.5 text-[11px] text-slate-500">경영지원 경력직 이직 관리</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-2">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-slate-900 font-medium text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-slate-200 p-3">
            <Button size="sm" className="w-full" onClick={quickExport}>
              <Download size={13} /> 백업 내보내기
            </Button>
          </div>
        </aside>

        {/* 본문 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4">
            <div className="flex items-center gap-2">
              {inPortal && (
                <a
                  href="/"
                  aria-label="앱 선택으로 나가기"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 md:hidden"
                >
                  <LayoutGrid size={16} /> 앱
                </a>
              )}
              <span className="text-sm font-bold text-slate-900 md:hidden">이직 파트너</span>
            </div>
            <div className="flex items-center gap-2">
              <SaveIndicator />
              <SaveButton />
            </div>
          </header>

          <main className="min-w-0 flex-1 pb-20 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>

      {/* 모바일 하단 탭바 */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] whitespace-nowrap',
                  isActive ? 'font-semibold text-slate-900' : 'text-slate-500',
                )
              }
            >
              <Icon size={18} />
              {'short' in item ? item.short : item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
