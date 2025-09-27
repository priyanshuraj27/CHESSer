"use client";

import { useState, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getEnhancedEvaluation, LichessEvaluation, EnhancedAnalysisResult } from "../lib/lichessAPI";
import EvaluationDisplay from "./EvaluationDisplay";
import EvaluationBar from "./EvaluationBar";
import { Game } from "../types/chess";

interface GameViewerProps {
  pgn: string;
  gameData?: Game;
}

export default function GameViewer({ pgn, gameData }: GameViewerProps) {
  const [game] = useState(new Chess());
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [cleanedPgn, setCleanedPgn] = useState<string>("");
  const [currentEvaluation, setCurrentEvaluation] = useState<LichessEvaluation | null>(null);
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
  const [evaluationEnabled, setEvaluationEnabled] = useState(false);
  const [evaluationSource, setEvaluationSource] = useState<string>("");

  // Load PGN when it changes
  useEffect(() => {
    if (!pgn || pgn.trim() === "") {
      console.warn("Empty PGN provided");
      setMoves([]);
      setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      setMoveIndex(0);
      return;
    }

    try {
      // Clean the PGN - remove clock annotations and other annotations
      let cleanPgn = pgn.trim();
      
      // Remove clock annotations like {[%clk 0:00:59.9]}
      cleanPgn = cleanPgn.replace(/\{\[%clk[^\}]*\}\}/g, '');
      
      // Remove other common annotations
      cleanPgn = cleanPgn.replace(/\{[^}]*\}/g, '');
      
      // Clean up extra whitespace
      cleanPgn = cleanPgn.replace(/\s+/g, ' ').trim();
      
      console.log("Cleaned PGN:", cleanPgn);
      
      // Store the cleaned PGN for use in updateBoard
      setCleanedPgn(cleanPgn);
      
      // Create a new game instance for loading
      const newGame = new Chess();
      
      // Try to load the PGN
      try {
        newGame.loadPgn(cleanPgn);
        const gameHistory = newGame.history();
        setMoves(gameHistory);
        setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        setMoveIndex(0);
      } catch (pgnError) {
        console.error("Invalid PGN format:", cleanPgn.substring(0, 100) + "...", pgnError);
        setMoves([]);
        setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        setMoveIndex(0);
        return;
      }
    } catch (error) {
      console.error("Error loading PGN:", error);
      setMoves([]);
      setFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      setMoveIndex(0);
    }
  }, [pgn]); // Remove 'game' from dependencies

  const updateBoard = useCallback(async (index: number) => {
    if (!cleanedPgn || index < 0) return;
    
    try {
      // Start with a fresh game
      const replay = new Chess();
      
      // Get the complete game to extract individual moves
      const completeGame = new Chess();
      completeGame.loadPgn(cleanedPgn);
      const allMoves = completeGame.history({ verbose: true });
      
      // Play moves one by one up to the desired index
      for (let i = 0; i < index && i < allMoves.length; i++) {
        const move = allMoves[i];
        replay.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion
        });
      }
      
      const newFen = replay.fen();
      setFen(newFen);
      setMoveIndex(index);
      
      // Get evaluation if enabled
      if (evaluationEnabled) {
        setIsEvaluationLoading(true);
        try {
          const result = await getEnhancedEvaluation(newFen);
          if (result && result.evaluation) {
            setCurrentEvaluation(result.evaluation);
            setEvaluationSource(result.source);
          } else {
            setCurrentEvaluation(null);
            setEvaluationSource("");
          }
        } catch (error) {
          console.error("Failed to get evaluation:", error);
          setCurrentEvaluation(null);
          setEvaluationSource("");
        } finally {
          setIsEvaluationLoading(false);
        }
      }
    } catch (error) {
      console.error("Error updating board:", error);
    }
  }, [cleanedPgn, evaluationEnabled]);

  const nextMove = useCallback(() => {
    if (moveIndex < moves.length) updateBoard(moveIndex + 1);
  }, [moveIndex, moves.length, updateBoard]);

  const prevMove = useCallback(() => {
    if (moveIndex > 0) updateBoard(moveIndex - 1);
  }, [moveIndex, updateBoard]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextMove();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nextMove, prevMove]);

  const toggleEvaluation = () => {
    setEvaluationEnabled(!evaluationEnabled);
    if (!evaluationEnabled) {
      // If enabling evaluation, get current position evaluation
      updateBoard(moveIndex);
    } else {
      // If disabling, clear evaluation
      setCurrentEvaluation(null);
      setEvaluationSource("");
    }
  };

  // Check if it's white's turn based on FEN
  const isWhiteToMove = fen.split(' ')[1] === 'w';

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Board, Evaluation Bar, and Move List Container */}
      <div className="flex items-start gap-6">
        {/* Chess Board with Player Names */}
        <div className="flex-shrink-0" style={{ width: '500px', maxWidth: '500px' }}>
          {/* Black Player (Top) */}
          <div className="mb-2 p-2 bg-slate-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-900 rounded-full border border-gray-600"></div>
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-sm">
                    {gameData?.black?.username || 'Black Player'}
                  </span>
                  {gameData?.black?.rating && (
                    <span className="text-slate-400 text-xs">({gameData.black.rating})</span>
                  )}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${!isWhiteToMove ? 'bg-green-400' : 'bg-gray-600'}`}></div>
            </div>
          </div>

          <Chessboard 
            options={{ 
              position: fen
            }}
          />

          {/* White Player (Bottom) */}
          <div className="mt-2 p-2 bg-slate-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-white rounded-full border border-gray-400"></div>
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-sm">
                    {gameData?.white?.username || 'White Player'}
                  </span>
                  {gameData?.white?.rating && (
                    <span className="text-slate-400 text-xs">({gameData.white.rating})</span>
                  )}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${isWhiteToMove ? 'bg-green-400' : 'bg-gray-600'}`}></div>
            </div>
          </div>
        </div>

        {/* Evaluation Bar - Vertical on the side */}
        {evaluationEnabled && (
          <div className="flex flex-col justify-center" style={{ height: '500px', width: '24px' }}>
            <div className="h-full w-full bg-gray-700 rounded-lg overflow-hidden flex flex-col">
              {/* Vertical Evaluation bar */}
              <div className="flex-1 flex flex-col relative">
                {(() => {
                  // Calculate evaluation percentage
                  const getEvaluationPercentage = (): number => {
                    if (!currentEvaluation || !currentEvaluation.pvs || currentEvaluation.pvs.length === 0) {
                      return 50; // Neutral
                    }
                    const bestLine = currentEvaluation.pvs[0];
                    if (bestLine.mate !== null && bestLine.mate !== undefined) {
                      return bestLine.mate > 0 ? 95 : 5;
                    }
                    if (bestLine.cp !== null && bestLine.cp !== undefined) {
                      const normalized = bestLine.cp / 100;
                      const sigmoid = 1 / (1 + Math.exp(-normalized * 0.4));
                      return Math.max(5, Math.min(95, sigmoid * 100));
                    }
                    return 50;
                  };

                  const whitePercentage = getEvaluationPercentage();
                  const blackPercentage = 100 - whitePercentage;

                  return (
                    <>
                      {/* Black side (top - matches board layout) */}
                      <div 
                        className="bg-gray-900 transition-all duration-300 ease-out"
                        style={{ height: `${blackPercentage}%` }}
                      >
                      </div>
                      
                      {/* White side (bottom - matches board layout) */}
                      <div 
                        className="bg-white transition-all duration-300 ease-out"
                        style={{ height: `${whitePercentage}%` }}
                      >
                      </div>
                      
                      {/* Center line */}
                      <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-500 transform -translate-y-1/2"></div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Move List */}
        <div className="w-80 bg-slate-800 rounded-lg p-4" style={{ height: '500px' }}>
          <h3 className="text-white font-semibold mb-3 text-sm">Moves</h3>
          <div className="h-full overflow-y-auto">
            {moves.length > 0 ? (
              <div className="space-y-1">
                {/* Group moves by pairs (white move, black move) */}
                {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
                  const moveNumber = i + 1;
                  const whiteMove = moves[i * 2];
                  const blackMove = moves[i * 2 + 1];
                  const whiteMoveIndex = i * 2 + 1;
                  const blackMoveIndex = i * 2 + 2;

                  return (
                    <div key={moveNumber} className="flex items-center gap-2 text-sm py-1">
                      {/* Move number */}
                      <span className="text-slate-400 font-mono text-xs w-6">
                        {moveNumber}.
                      </span>
                      
                      {/* White move */}
                      <button
                        onClick={() => updateBoard(whiteMoveIndex)}
                        className={`px-2 py-1 rounded text-left min-w-[60px] transition-colors ${
                          moveIndex === whiteMoveIndex
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {whiteMove}
                      </button>
                      
                      {/* Black move (if exists) */}
                      {blackMove && (
                        <button
                          onClick={() => updateBoard(blackMoveIndex)}
                          className={`px-2 py-1 rounded text-left min-w-[60px] transition-colors ${
                            moveIndex === blackMoveIndex
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {blackMove}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-8">
                No moves to display
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls with improved styling */}
      <div className="flex gap-3 items-center">
        <button
          onClick={prevMove}
          disabled={moveIndex === 0}
          className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          title="Previous move (← Arrow Key)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>
        
        <button
          onClick={nextMove}
          disabled={moveIndex === moves.length}
          className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          title="Next move (→ Arrow Key)"
        >
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        <button
          onClick={toggleEvaluation}
          className={`px-4 py-3 rounded-lg transition-colors ${
            evaluationEnabled 
              ? 'bg-green-600 hover:bg-green-500 text-white' 
              : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
          }`}
        >
          {evaluationEnabled ? 'Hide Analysis' : 'Show Analysis'}
        </button>
      </div>

      {/* Move Counter with better styling */}
      <div className="text-center">
        <p className="text-gray-300 text-lg font-semibold">
          Move {moveIndex} / {moves.length}
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Use ← → arrow keys to navigate
        </p>
      </div>

      {/* Evaluation Display */}
      {evaluationEnabled && (
        <div className="w-full max-w-lg">
          <EvaluationDisplay 
            evaluation={currentEvaluation} 
            isLoading={isEvaluationLoading} 
          />
        </div>
      )}
    </div>
  );
}
