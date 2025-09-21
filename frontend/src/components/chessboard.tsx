"use client";

import { useState, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getEnhancedEvaluation, LichessEvaluation, EnhancedAnalysisResult } from "../lib/lichessAPI";
import EvaluationDisplay from "./EvaluationDisplay";
import EvaluationBar from "./EvaluationBar";

interface GameViewerProps {
  pgn: string;
}

export default function GameViewer({ pgn }: GameViewerProps) {
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
      {/* Evaluation Bar */}
      {evaluationEnabled && (
        <div className="w-full max-w-lg">
          <EvaluationBar evaluation={currentEvaluation} isWhiteToMove={isWhiteToMove} />
        </div>
      )}

      {/* Chess Board - Larger size */}
      <div className="w-full max-w-lg" style={{ width: '500px', maxWidth: '500px' }}>
        <Chessboard 
          options={{ 
            position: fen
          }}
        />
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
