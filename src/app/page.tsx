'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-8 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-700 mb-2">무엇을 기록할까요?</h1>
        <p className="text-gray-400 mb-8">매일의 나를 기록해요 ✨</p>

        <div className="space-y-4">
          <Link
            href="/dashboard"
            className="block rounded-2xl p-6 bg-pink-50 border border-pink-100 shadow-md hover:bg-pink-100"
          >
            <div className="text-5xl mb-2">🦄</div>
            <p className="text-xl font-bold text-pink-700">Diet Daily</p>
            <p className="text-sm text-pink-400 mt-1">매일 체중을 기록하고 추이를 확인해요</p>
          </Link>

          <Link
            href="/sleep"
            className="block rounded-2xl p-6 bg-indigo-50 border border-indigo-100 shadow-md hover:bg-indigo-100"
          >
            <div className="text-5xl mb-2">🌙</div>
            <p className="text-xl font-bold text-indigo-700">Well-Sleep</p>
            <p className="text-sm text-indigo-400 mt-1">매일 수면시간을 기록하고 평균을 확인해요</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
