'use client';

import Link from 'next/link';
import PastSleepInput from '@/components/PastSleepInput';

export default function SleepPastInputPage() {
  const handleSave = () => {};

  return (
    <div className="min-h-screen bg-white py-4 px-2 sm:py-8 sm:px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-indigo-700">과거 수면 입력</h1>
          <Link
            href="/sleep"
            className="px-3 py-2 sm:px-4 sm:py-2 bg-indigo-400 text-white rounded-lg hover:bg-indigo-500 text-sm sm:text-base"
          >
            달력으로 돌아가기
          </Link>
        </header>

        <PastSleepInput onSave={handleSave} />
      </div>
    </div>
  );
}
