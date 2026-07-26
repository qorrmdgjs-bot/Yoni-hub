import { SleepData, SleepEntry, SleepSettings } from '@/types';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'well-sleep-data';

const defaultSettings: SleepSettings = {
  goalHours: 8,
};

const defaultData: SleepData = {
  entries: [],
  settings: defaultSettings,
};

export function loadSleepData(): SleepData {
  if (typeof window === 'undefined') return defaultData;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return defaultData;
    const parsed = JSON.parse(data);
    return {
      entries: parsed.entries || [],
      settings: { ...defaultSettings, ...parsed.settings },
    };
  } catch {
    return defaultData;
  }
}

export function saveSleepData(data: SleepData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addSleepEntry(entry: SleepEntry): void {
  const data = loadSleepData();
  const existingIndex = data.entries.findIndex(e => e.date === entry.date);
  if (existingIndex >= 0) {
    data.entries[existingIndex] = { ...data.entries[existingIndex], ...entry };
  } else {
    data.entries.push(entry);
  }
  data.entries.sort((a, b) => a.date.localeCompare(b.date));
  saveSleepData(data);

  // Supabase에 동기화
  syncEntryToSupabase(entry);
}

export function deleteSleepEntry(date: string): void {
  const data = loadSleepData();
  const nextEntries = data.entries.filter(e => e.date !== date);
  // 삭제할 항목이 없으면 아무 것도 하지 않음
  if (nextEntries.length === data.entries.length) return;
  data.entries = nextEntries;
  saveSleepData(data);

  // Supabase에서도 삭제
  syncDeleteFromSupabase(date);
}

export function updateSleepSettings(settings: Partial<SleepSettings>): void {
  const data = loadSleepData();
  data.settings = { ...data.settings, ...settings };
  saveSleepData(data);

  // Supabase에 동기화
  syncSettingsToSupabase(data.settings);
}

// --- Supabase 동기화 ---

async function syncEntryToSupabase(entry: SleepEntry) {
  try {
    await supabase
      .from('sleep_entries')
      .upsert(
        {
          date: entry.date,
          hours: entry.hours,
          note: entry.note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'date' }
      );
  } catch {
    // 네트워크 오류 시 로컬만 유지
  }
}

async function syncDeleteFromSupabase(date: string) {
  try {
    await supabase.from('sleep_entries').delete().eq('date', date);
  } catch {
    // 네트워크 오류 시 로컬만 유지
  }
}

async function syncSettingsToSupabase(settings: SleepSettings) {
  try {
    await supabase
      .from('sleep_settings')
      .update({
        goal_hours: settings.goalHours,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
  } catch {
    // 네트워크 오류 시 로컬만 유지
  }
}

// 앱 시작 시 Supabase에서 데이터 불러오기
export async function loadFromSupabase(): Promise<SleepData | null> {
  try {
    const [entriesRes, settingsRes] = await Promise.all([
      supabase.from('sleep_entries').select('*').order('date', { ascending: true }),
      supabase.from('sleep_settings').select('*').limit(1).single(),
    ]);

    if (entriesRes.error || settingsRes.error) return null;

    const entries: SleepEntry[] = (entriesRes.data || []).map((row: Record<string, unknown>) => ({
      date: row.date as string,
      hours: row.hours != null ? Number(row.hours) : null,
      note: (row.note as string | null) ?? null,
    }));

    const settings: SleepSettings = {
      goalHours: Number(settingsRes.data.goal_hours),
    };

    return { entries, settings };
  } catch {
    return null;
  }
}

// Supabase 데이터를 로컬에 병합 (서버 우선)
export async function syncFromSupabase(): Promise<SleepData> {
  const local = loadSleepData();
  const remote = await loadFromSupabase();

  if (!remote || remote.entries.length === 0) return local;

  // 서버 데이터를 기준으로 로컬에 없는 항목 병합
  const merged = { ...remote };
  const remoteDates = new Set(remote.entries.map(e => e.date));

  for (const localEntry of local.entries) {
    if (!remoteDates.has(localEntry.date)) {
      merged.entries.push(localEntry);
      // 로컬에만 있는 데이터 서버에 동기화
      syncEntryToSupabase(localEntry);
    }
  }

  merged.entries.sort((a, b) => a.date.localeCompare(b.date));
  saveSleepData(merged);
  return merged;
}
