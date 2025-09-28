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
  initialMoveIndex?: number | null;
}

export default function GameViewer({ pgn, gameData, initialMoveIndex }: GameViewerProps) {
  const [game] = useState(new Chess());
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [cleanedPgn, setCleanedPgn] = useState<string>("");
  const [currentEvaluation, setCurrentEvaluation] = useState<LichessEvaluation | null>(null);
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
  const [evaluationEnabled, setEvaluationEnabled] = useState(false);
  const [evaluationSource, setEvaluationSource] = useState<string>("");
  const [lastEvaluatedPosition, setLastEvaluatedPosition] = useState<string>("");

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
      
      // Smart evaluation - only analyze if position changed and evaluation is enabled
      if (evaluationEnabled) {
        // Only analyze if this is a different position than the last one evaluated
        if (newFen !== lastEvaluatedPosition) {
          setIsEvaluationLoading(true);
          setLastEvaluatedPosition(newFen); // Set immediately to prevent duplicate requests
          
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
      } else {
        // Clear evaluation when disabled
        setCurrentEvaluation(null);
        setEvaluationSource("");
        setLastEvaluatedPosition("");
      }
    } catch (error) {
      console.error("Error updating board:", error);
    }
  }, [cleanedPgn, evaluationEnabled, lastEvaluatedPosition]);

  // Handle initial move index when provided
  useEffect(() => {
    if (initialMoveIndex !== null && initialMoveIndex !== undefined && moves.length > 0) {
      const targetIndex = Math.max(0, Math.min(initialMoveIndex, moves.length));
      setMoveIndex(targetIndex);
      updateBoard(targetIndex);
    }
  }, [initialMoveIndex, moves, updateBoard]);

  const nextMove = useCallback(() => {
    if (moveIndex < moves.length) updateBoard(moveIndex + 1);
  }, [moveIndex, moves.length, updateBoard]);

  const prevMove = useCallback(() => {
    if (moveIndex > 0) updateBoard(moveIndex - 1);
  }, [moveIndex, updateBoard]);

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          nextMove();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          prevMove();
          break;
        case ' ':
          event.preventDefault();
          toggleEvaluation();
          break;
        case 'Home':
          event.preventDefault();
          updateBoard(0);
          break;
        case 'End':
          event.preventDefault();
          updateBoard(moves.length);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nextMove, prevMove, updateBoard, moves.length]);

  const toggleEvaluation = () => {
    setEvaluationEnabled(!evaluationEnabled);
    if (!evaluationEnabled) {
      // If enabling evaluation, reset and get current position evaluation
      setLastEvaluatedPosition(""); // Reset to force evaluation
      updateBoard(moveIndex);
    } else {
      // If disabling, clear evaluation and reset state
      setCurrentEvaluation(null);
      setEvaluationSource("");
      setLastEvaluatedPosition("");
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

        {/* Enhanced Move List with Engine Analysis */}
        <div className="w-80 bg-slate-800 rounded-lg overflow-hidden" style={{ height: '500px' }}>
          {/* Engine Analysis Section */}
          {evaluationEnabled && currentEvaluation && (
            <div className="p-4 bg-slate-700 border-b border-slate-600">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">Engine Analysis</h3>
                <div className="text-xs text-slate-400">
                  Depth {currentEvaluation.depth}
                </div>
              </div>
              
              <div className="space-y-2">
                {currentEvaluation.pvs.slice(0, 3).map((pv, index) => {
                  const evalText = pv.mate !== null && pv.mate !== undefined 
                    ? `M${Math.abs(pv.mate)}`
                    : pv.cp !== null && pv.cp !== undefined 
                    ? (pv.cp > 0 ? `+${(pv.cp / 100).toFixed(1)}` : `${(pv.cp / 100).toFixed(1)}`)
                    : '0.0';
                  
                  const evalColor = pv.mate !== null && pv.mate !== undefined
                    ? pv.mate > 0 ? 'text-green-400' : 'text-red-400'
                    : pv.cp !== null && pv.cp !== undefined
                    ? pv.cp > 100 ? 'text-green-400' : pv.cp < -100 ? 'text-red-400' : 'text-slate-300'
                    : 'text-slate-300';

                  return (
                    <div key={index} className="bg-slate-600 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-300 text-xs">#{index + 1}</span>
                        <span className={`font-bold text-sm ${evalColor}`}>
                          {evalText}
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono text-xs">
                        {pv.moves.split(' ').slice(0, 4).join(' ')}
                        {pv.moves.split(' ').length > 4 && '...'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Game Moves Header */}
          <div className="p-4 bg-slate-700 border-b border-slate-600">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Game Moves</h3>
              <div className="text-xs text-slate-400">
                {moves.length} moves
              </div>
            </div>
          </div>
          
          <div className="p-4 h-full overflow-y-auto" style={{ 
            maxHeight: evaluationEnabled && currentEvaluation 
              ? 'calc(500px - 200px)' 
              : 'calc(500px - 60px)' 
          }}>
            {moves.length > 0 ? (
              <div className="space-y-1">
                {/* Starting position */}
                <button
                  onClick={() => updateBoard(0)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    moveIndex === 0
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs">Starting position</span>
                </button>
                
                {/* Group moves by pairs (white move, black move) */}
                {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
                  const moveNumber = i + 1;
                  const whiteMove = moves[i * 2];
                  const blackMove = moves[i * 2 + 1];
                  const whiteMoveIndex = i * 2 + 1;
                  const blackMoveIndex = i * 2 + 2;

                  return (
                    <div key={moveNumber} className="flex items-center gap-1 text-sm">
                      {/* Move number */}
                      <span className="text-slate-400 font-mono text-xs w-8 flex-shrink-0">
                        {moveNumber}.
                      </span>
                      
                      {/* White move */}
                      <button
                        onClick={() => updateBoard(whiteMoveIndex)}
                        className={`px-2 py-1 rounded text-left flex-1 transition-colors font-mono ${
                          moveIndex === whiteMoveIndex
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {whiteMove}
                      </button>
                      
                      {/* Black move (if exists) */}
                      {blackMove ? (
                        <button
                          onClick={() => updateBoard(blackMoveIndex)}
                          className={`px-2 py-1 rounded text-left flex-1 transition-colors font-mono ${
                            moveIndex === blackMoveIndex
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {blackMove}
                        </button>
                      ) : (
                        <div className="flex-1"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-8">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>No moves to display</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Controls */}
      <div className="flex flex-col gap-4 items-center">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => updateBoard(0)}
            disabled={moveIndex === 0}
            className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Go to start"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={prevMove}
            disabled={moveIndex === 0}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title="Previous move (← Arrow Key)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>
          
          <button
            onClick={nextMove}
            disabled={moveIndex === moves.length}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title="Next move (→ Arrow Key)"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <button
            onClick={() => updateBoard(moves.length)}
            disabled={moveIndex === moves.length}
            className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Go to end"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
          
          <button
            onClick={toggleEvaluation}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              evaluationEnabled 
                ? 'bg-green-600 hover:bg-green-500 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {evaluationEnabled ? 'Hide Analysis' : 'Show Analysis'}
          </button>
        </div>
        
        {/* Keyboard shortcuts hint */}
        <div className="text-xs text-slate-500 text-center">
          Use ← → arrow keys to navigate • Space to toggle analysis
        </div>
      </div>

      {/* Move Counter with progress bar */}
      <div className="text-center w-full max-w-lg">
        <p className="text-gray-300 text-lg font-semibold mb-2">
          Move {moveIndex} / {moves.length}
        </p>
        {/* Progress bar */}
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${moves.length > 0 ? (moveIndex / moves.length) * 100 : 0}%` }}
          ></div>
        </div>
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
