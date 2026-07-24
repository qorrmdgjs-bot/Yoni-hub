import { NavLink, Outlet } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  Check,
  CircleAlert,
  Compass,
  Download,
  Home,
  ListChecks,
  Loader2,
  MessageSquareText,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@job/lib/cn';
import { useAppStore } from '@job/store';
import { downloadText } from '@job/lib/download';
import { exportFilename, serializeExport } from '@job/storage/importExport';
import { Button } from '@job/components/ui';

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
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:justify-end">
            <span className="text-sm font-bold text-slate-900 md:hidden">이직 파트너</span>
            <SaveIndicator />
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
