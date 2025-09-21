"use client";

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

interface GameViewerProps {
  pgn: string;
}

export default function GameViewer({ pgn }: GameViewerProps) {
  const [game] = useState(new Chess());
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moves, setMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [cleanedPgn, setCleanedPgn] = useState<string>("");

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

  const updateBoard = (index: number) => {
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
      
      setFen(replay.fen());
      setMoveIndex(index);
    } catch (error) {
      console.error("Error updating board:", error);
    }
  };

  const nextMove = () => {
    if (moveIndex < moves.length) updateBoard(moveIndex + 1);
  };

  const prevMove = () => {
    if (moveIndex > 0) updateBoard(moveIndex - 1);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Chessboard options={{ position: fen }} />

      <div className="flex gap-4">
        <button
          onClick={prevMove}
          disabled={moveIndex === 0}
          className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={nextMove}
          disabled={moveIndex === moves.length}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <p className="text-gray-300">
        Move {moveIndex} / {moves.length}
      </p>
    </div>
  );
}
