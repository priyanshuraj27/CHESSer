'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Game } from '@/types/chess';
import GameReviewer from '@/components/GameReviewer';

function ReviewContent() {
  console.log('🔄 [REVIEW PAGE] ReviewContent component rendered');
  const searchParams = useSearchParams();
  console.log('🔍 [REVIEW PAGE] Search params:', searchParams.toString());
  
  const gameData = searchParams.get('game');
  console.log('📥 [REVIEW PAGE] Raw gameData received:', gameData ? 'Present' : 'Missing');
  console.log('📏 [REVIEW PAGE] GameData length:', gameData?.length || 0);

  if (!gameData) {
    console.log('❌ [REVIEW PAGE] No game data found in URL parameters');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Game Not Found</h1>
          <p className="text-gray-600">No game data provided for review.</p>
        </div>
      </div>
    );
  }

  try {
    console.log('🔓 [REVIEW PAGE] Decoding game data...');
    const decodedData = atob(gameData);
    const game: Game = JSON.parse(decodedData);
    console.log('✅ [REVIEW PAGE] Game loaded for review');
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Game Review</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">White:</span>
                <span className="ml-2 text-gray-900">{game.white.username} ({game.white.rating || 'Unrated'})</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Black:</span>
                <span className="ml-2 text-gray-900">{game.black.username} ({game.black.rating || 'Unrated'})</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Time Class:</span>
                <span className="ml-2 text-gray-900">{game.time_class}</span>
              </div>
            </div>
          </div>

          <GameReviewer game={game} />
        </div>
      </div>
    );
  } catch (error) {
    console.error('💥 [REVIEW PAGE] Error parsing game data:', error);
    console.error('🔍 [REVIEW PAGE] Error type:', typeof error);
    console.error('📋 [REVIEW PAGE] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    console.error('📄 [REVIEW PAGE] Raw gameData that failed:', gameData);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Game Data</h1>
          <p className="text-gray-600">Failed to parse game information.</p>
        </div>
      </div>
    );
  }
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}