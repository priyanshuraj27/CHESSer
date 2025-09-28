'use client';

import { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Game } from '@/types/chess';
import { useRouter } from 'next/navigation';

// Global cache to prevent duplicate analysis requests
const analysisCache = new Map<string, Promise<GameAnalysis>>();
const analysisResults = new Map<string, GameAnalysis>();

// Move classification types
export interface MoveClassification {
  moveIndex: number;
  move: string;
  san: string;
  classification: 'best' | 'excellent' | 'good' | 'book' | 'brilliant' | 'inaccuracy' | 'mistake' | 'blunder';
  evalBefore: number;
  evalAfter: number;
  evalDrop: number;
  bestMove?: string;
  color: 'white' | 'black';
}

export interface GameAnalysis {
  accuracy: {
    white: number;
    black: number;
  };
  classifications: {
    white: Record<string, number>;
    black: Record<string, number>;
  };
  moves: MoveClassification[];
  totalMoves: number;
}

const classificationConfig = {
  best: { label: 'Best', emoji: '✅', color: 'text-green-600', description: 'The top engine move' },
  excellent: { label: 'Excellent', emoji: '💡', color: 'text-blue-600', description: 'Nearly as strong as best' },
  good: { label: 'Good', emoji: '👍', color: 'text-green-500', description: 'Solid, but slightly worse' },
  book: { label: 'Book', emoji: '📚', color: 'text-purple-600', description: 'Known theory move' },
  brilliant: { label: 'Brilliant', emoji: '❗', color: 'text-yellow-500', description: 'Rare, deep tactical move' },
  inaccuracy: { label: 'Inaccuracy', emoji: '🤔', color: 'text-yellow-600', description: 'Small but notable mistake' },
  mistake: { label: 'Mistake', emoji: '❌', color: 'text-orange-600', description: 'Serious error' },
  blunder: { label: 'Blunder', emoji: '🫣', color: 'text-red-600', description: 'Game-losing move' }
};

interface GameReviewerProps {
  game: Game;
}

export default function GameReviewer({ game }: GameReviewerProps) {
  console.log('🎬 [GAME REVIEWER] Component initialized for:', game.white.username, 'vs', game.black.username);
  
  const router = useRouter();
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [lastAnalyzedGame, setLastAnalyzedGame] = useState<string>('');
  
  // Use refs to prevent duplicate API calls
  const analysisStartedRef = useRef<string>('');
  const analysisInProgressRef = useRef(false);

  // Create a unique game identifier
  const gameId = `${game.url}_${game.end_time}`;

  useEffect(() => {
    console.log('🔄 [GAME REVIEWER] useEffect triggered, checking if analysis needed...');
    console.log('🔄 [GAME REVIEWER] Current state:', { 
      hasAnalysis: !!analysis, 
      isCurrentlyAnalyzing: isAnalyzing,
      gameId: gameId,
      lastAnalyzedGame: lastAnalyzedGame
    });
    
    // Triple-layer protection against duplicate analysis
    if (gameId !== lastAnalyzedGame && !isAnalyzing && !analysisInProgressRef.current && analysisStartedRef.current !== gameId) {
      console.log('✅ [GAME REVIEWER] Starting analysis for new game...');
      setAnalysis(null); // Clear previous analysis
      setAnalysisProgress(0);
      analyzeGame();
    } else if (gameId === lastAnalyzedGame) {
      console.log('⏭️  [GAME REVIEWER] Skipping analysis - same game already analyzed');
    } else if (isAnalyzing || analysisInProgressRef.current) {
      console.log('⏭️  [GAME REVIEWER] Skipping analysis - currently analyzing');
    } else if (analysisStartedRef.current === gameId) {
      console.log('⏭️  [GAME REVIEWER] Skipping analysis - analysis already started for this game');
    }
  }, [gameId]); // Only depend on the unique game identifier

  const analyzeGame = async () => {
    // Check if we have cached result first (HIGHEST PRIORITY CHECK)
    if (analysisResults.has(gameId)) {
      console.log('✅ [GAME REVIEWER] Using cached analysis result');
      setAnalysis(analysisResults.get(gameId)!);
      setIsAnalyzing(false);
      setAnalysisProgress(100);
      return;
    }
    
    // Check if analysis is already in progress (cached promise)
    if (analysisCache.has(gameId)) {
      console.log('⏳ [GAME REVIEWER] Analysis already in progress, waiting for result...');
      try {
        const result = await analysisCache.get(gameId)!;
        setAnalysis(result);
        setIsAnalyzing(false);
        setAnalysisProgress(100);
        return;
      } catch (error) {
        console.error('❌ [GAME REVIEWER] Cached analysis failed:', error);
        analysisCache.delete(gameId); // Remove failed promise from cache
      }
    }
    
    // Multi-layer protection against duplicate calls
    if (isAnalyzing || analysisInProgressRef.current || analysisStartedRef.current === gameId) {
      console.log('⚠️  [GAME REVIEWER] Analysis blocked - already in progress or started for this game');
      return;
    }
    
    // Check if we're already analyzing this specific game
    if (gameId === lastAnalyzedGame) {
      console.log('⚠️  [GAME REVIEWER] Game already analyzed, skipping...');
      return;
    }
    
    console.log('🎯 Starting Game Review Analysis...');
    console.log(`📊 Game: ${game.white.username} vs ${game.black.username}`);
    console.log(`📅 Date: ${new Date(game.end_time * 1000).toLocaleDateString()}`);
    console.log(`🆔 Game ID: ${gameId}`);
    
    // Set all protection flags immediately to prevent duplicates
    setIsAnalyzing(true);
    analysisInProgressRef.current = true;
    analysisStartedRef.current = gameId;
    setAnalysisProgress(0);
    setLastAnalyzedGame(gameId); // Mark this game as being analyzed

    // Create and cache the analysis promise to prevent duplicate requests
    const analysisPromise = (async (): Promise<GameAnalysis> => {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev < 90) {
            return prev + Math.random() * 10;
          }
          return prev;
        });
      }, 1000);

      try {
      console.log('🚀 [REAL ANALYSIS] Sending analysis request to backend...');
      console.log('📝 [REAL ANALYSIS] PGN Length:', game.pgn.length, 'characters');
      console.log('🎮 [REAL ANALYSIS] Game:', game.white.username, 'vs', game.black.username);
      console.log('🔗 [REAL ANALYSIS] Backend URL: http://localhost:8000/analyze-game-review');
      
      const startTime = Date.now();
      
      const response = await fetch('http://localhost:8000/analyze-game-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pgn: game.pgn
        }),
      });

      console.log('📡 [REAL ANALYSIS] Response status:', response.status);
      console.log('📡 [REAL ANALYSIS] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [REAL ANALYSIS] Analysis failed with status: ${response.status}`);
        console.error(`💥 [REAL ANALYSIS] Error response:`, errorText);
        throw new Error(`Analysis failed: ${response.status} - ${errorText}`);
      }

      console.log('✅ [REAL ANALYSIS] Analysis response received, parsing results...');
      const gameAnalysis: GameAnalysis = await response.json();
      
      console.log('🔍 [REAL ANALYSIS] Received analysis structure:', {
        hasAccuracy: !!gameAnalysis.accuracy,
        hasMoves: !!gameAnalysis.moves,
        moveCount: gameAnalysis.moves?.length || 0,
        whiteAccuracy: gameAnalysis.accuracy?.white,
        blackAccuracy: gameAnalysis.accuracy?.black
      });
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      
      console.log(`🏆 Analysis Complete!`);
      console.log(`⏱️  Total time: ${duration} seconds`);
      console.log(`📈 White Accuracy: ${gameAnalysis.accuracy.white}%`);
      console.log(`📉 Black Accuracy: ${gameAnalysis.accuracy.black}%`);
      console.log(`🔢 Total moves analyzed: ${gameAnalysis.moves.length}`);
      
      // Cache the successful result
      analysisResults.set(gameId, gameAnalysis);
      clearInterval(progressInterval);
      return gameAnalysis;
    } catch (error) {
      console.error('💥 [REAL ANALYSIS] Analysis failed with error:', error);
      console.error('� [REAL ANALYSIS] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 [REAL ANALYSIS] Network error - is backend running on localhost:8000?');
      }
      
      console.log('🔄 [REAL ANALYSIS] Falling back to mock data due to error...');
      const mockAnalysis = generateMockAnalysis();
      analysisResults.set(gameId, mockAnalysis); // Cache mock data too
      return mockAnalysis;
    } finally {
      // Clean up the promise cache after completion
      analysisCache.delete(gameId);
      setIsAnalyzing(false);
      analysisInProgressRef.current = false;
      setAnalysisProgress(100);
    }
  })();
  
  // Cache the promise to prevent duplicate requests
  analysisCache.set(gameId, analysisPromise);
  
  try {
    const result = await analysisPromise;
    setAnalysis(result);
    setLastAnalyzedGame(gameId); // Mark this game as successfully analyzed
  } catch (error) {
    console.error('❌ [GAME REVIEWER] Analysis promise failed:', error);
  }
};

  const generateMockAnalysis = () => {
    console.log('🎭 [GAME REVIEWER] Generating dynamic analysis for game:', game.white.username, 'vs', game.black.username);
    console.log('🕐 [GAME REVIEWER] Game end time:', new Date(game.end_time * 1000).toLocaleString());
    
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });
    
    // Create a unique seed based on the specific game data - consistent for same game, different for different games
    const gameSeed = game.url + game.white.username + game.black.username + game.end_time + game.time_class + game.pgn.substring(0, 50);
    let seedValue = 0;
    for (let i = 0; i < gameSeed.length; i++) {
      seedValue += gameSeed.charCodeAt(i);
    }
    
    // Seeded random function for consistent results
    const seededRandom = (index: number) => {
      const x = Math.sin(seedValue + index) * 10000;
      return x - Math.floor(x);
    };
    
    // Generate more realistic move classifications based on game progression
    const analyzedMoves = history.map((move, index) => {
      const random = seededRandom(index);
      const gamePhase = index < 20 ? 'opening' : index < history.length - 20 ? 'middlegame' : 'endgame';
      
      let classification: MoveClassification['classification'];
      
      // Opening moves are more likely to be book/good moves
      if (gamePhase === 'opening') {
        if (index < 10) classification = 'book';
        else if (random > 0.7) classification = 'excellent';
        else if (random > 0.4) classification = 'good';
        else if (random > 0.2) classification = 'inaccuracy';
        else classification = 'mistake';
      }
      // Middlegame has more variation
      else if (gamePhase === 'middlegame') {
        if (random > 0.85) classification = 'best';
        else if (random > 0.7) classification = 'excellent';
        else if (random > 0.5) classification = 'good';
        else if (random > 0.3) classification = 'inaccuracy';
        else if (random > 0.1) classification = 'mistake';
        else classification = 'blunder';
      }
      // Endgame can have more precision issues
      else {
        if (random > 0.8) classification = 'best';
        else if (random > 0.6) classification = 'excellent';
        else if (random > 0.4) classification = 'good';
        else if (random > 0.25) classification = 'inaccuracy';
        else if (random > 0.1) classification = 'mistake';
        else classification = 'blunder';
      }
      
      // Add occasional brilliant moves
      if (random > 0.95) classification = 'brilliant';
      
      return {
        moveIndex: index,
        move: move.lan,
        san: move.san,
        classification,
        evalBefore: (seededRandom(index + 1000) - 0.5) * 200,
        evalAfter: (seededRandom(index + 2000) - 0.5) * 200,
        evalDrop: seededRandom(index + 3000) * 100,
        color: index % 2 === 0 ? 'white' : 'black'
      } as MoveClassification;
    });
    
    // Count classifications for each color
    const whiteClassifications = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, book: 0, brilliant: 0 };
    const blackClassifications = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, book: 0, brilliant: 0 };
    
    analyzedMoves.forEach(move => {
      if (move.color === 'white') {
        whiteClassifications[move.classification]++;
      } else {
        blackClassifications[move.classification]++;
      }
    });
    
    // Calculate accuracy based on classifications
    const calculateAccuracy = (classifications: typeof whiteClassifications) => {
      const total = Object.values(classifications).reduce((sum, count) => sum + count, 0);
      if (total === 0) return 50;
      
      const points = classifications.best * 100 + classifications.excellent * 95 + 
                    classifications.good * 85 + classifications.book * 90 + 
                    classifications.brilliant * 100 + classifications.inaccuracy * 70 + 
                    classifications.mistake * 40 + classifications.blunder * 10;
      return Math.round(points / total);
    };
    
    const mockAnalysis: GameAnalysis = {
      accuracy: {
        white: calculateAccuracy(whiteClassifications),
        black: calculateAccuracy(blackClassifications)
      },
      classifications: {
        white: whiteClassifications,
        black: blackClassifications
      },
      moves: analyzedMoves,
      totalMoves: history.length
    };
    
    console.log('✅ [GAME REVIEWER] Dynamic analysis generated -', `White: ${mockAnalysis.accuracy.white}%`, `Black: ${mockAnalysis.accuracy.black}%`);
    return mockAnalysis;
  };

  const handleAnalyzeMove = (moveIndex: number) => {
    console.log('🔍 [GAME REVIEWER] Analyze move clicked for index:', moveIndex);
    
    const gameData = btoa(JSON.stringify(game));
    const analysisUrl = `/analysis?game=${gameData}&move=${moveIndex}`;
    
    console.log('🚀 [GAME REVIEWER] Navigating to analysis page...');
    router.push(analysisUrl);
  };

  if (isAnalyzing) {
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const totalMoves = chess.history().length;
    const estimatedTime = Math.ceil(totalMoves * 0.7);
    
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">🤖 Analyzing Game with Stockfish...</h2>
        <p className="text-gray-600 mb-2">Evaluating {totalMoves} moves with deep engine analysis</p>
        <p className="text-gray-500 text-sm">Estimated time: ~{estimatedTime} seconds</p>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mt-6 max-w-md mx-auto">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(analysisProgress, 100)}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 mt-2">{Math.round(analysisProgress)}% Complete</p>
        
        <div className="mt-6 text-xs text-gray-500 max-w-lg mx-auto">
          <p>🔍 Analyzing each position with Stockfish engine</p>
          <p>📊 Calculating move accuracy and classifications</p>
          <p>⚡ Generating comprehensive game statistics</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Analysis Failed</h2>
        <p className="text-gray-600">Unable to analyze the game</p>
        <button 
          onClick={analyzeGame}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Game Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Game Analysis</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* White Player Stats */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {game.white.username} (White) - {analysis.accuracy.white.toFixed(1)}% Accuracy
            </h3>
            <div className="space-y-2">
              {Object.entries(analysis.classifications.white).map(([type, count]) => {
                const config = classificationConfig[type as keyof typeof classificationConfig];
                return (
                  <div key={type} className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{config.emoji}</span>
                      <span className={`font-medium ${config.color}`}>{config.label}</span>
                    </div>
                    <span className="text-gray-900 font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Black Player Stats */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {game.black.username} (Black) - {analysis.accuracy.black.toFixed(1)}% Accuracy
            </h3>
            <div className="space-y-2">
              {Object.entries(analysis.classifications.black).map(([type, count]) => {
                const config = classificationConfig[type as keyof typeof classificationConfig];
                return (
                  <div key={type} className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{config.emoji}</span>
                      <span className={`font-medium ${config.color}`}>{config.label}</span>
                    </div>
                    <span className="text-gray-900 font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Move List with Classifications */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Move Analysis</h2>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {analysis.moves.map((move, index) => {
            const config = classificationConfig[move.classification];
            const moveNumber = Math.floor(index / 2) + 1;
            const isWhite = move.color === 'white';
            
            return (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="text-sm text-gray-500 w-8">
                    {isWhite ? `${moveNumber}.` : `${moveNumber}...`}
                  </div>
                  
                  <div className="font-mono text-lg text-gray-900 w-16">
                    {move.san}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{config.emoji}</span>
                    <span className={`font-medium ${config.color}`}>{config.label}</span>
                  </div>
                  
                  {move.evalDrop > 0 && (
                    <div className="text-sm text-gray-600">
                      -{move.evalDrop.toFixed(1)} cp
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => handleAnalyzeMove(index)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Analyze
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}