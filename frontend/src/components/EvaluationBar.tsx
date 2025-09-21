"use client";

import { LichessEvaluation } from "../lib/lichessAPI";

interface EvaluationBarProps {
  evaluation: LichessEvaluation | null;
  isWhiteToMove: boolean;
}

export default function EvaluationBar({ evaluation, isWhiteToMove }: EvaluationBarProps) {
  // Convert evaluation to percentage for white
  const getEvaluationPercentage = (): number => {
    if (!evaluation || !evaluation.pvs || evaluation.pvs.length === 0) {
      return 50; // Neutral
    }

    const bestLine = evaluation.pvs[0];
    
    // Handle mate scores
    if (bestLine.mate !== null && bestLine.mate !== undefined) {
      // Positive mate = white wins, negative mate = black wins
      return bestLine.mate > 0 ? 95 : 5;
    }

    // Handle centipawn scores
    if (bestLine.cp !== null && bestLine.cp !== undefined) {
      // Convert centipawns to percentage using sigmoid-like function
      // cp is from white's perspective
      const normalized = bestLine.cp / 100; // Convert to pawns
      const sigmoid = 1 / (1 + Math.exp(-normalized * 0.4));
      return Math.max(5, Math.min(95, sigmoid * 100));
    }

    return 50; // Default to equal
  };

  const whitePercentage = getEvaluationPercentage();
  const blackPercentage = 100 - whitePercentage;

  return (
    <div className="w-full bg-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-2 bg-gray-800 text-xs">
        <span className="text-white font-medium">White</span>
        <span className="text-gray-400">
          {evaluation && evaluation.pvs && evaluation.pvs.length > 0 
            ? `Depth ${evaluation.depth}` 
            : 'No analysis'}
        </span>
        <span className="text-black font-medium">Black</span>
      </div>
      
      {/* Evaluation bar */}
      <div className="flex h-8 relative">
        {/* White side */}
        <div 
          className="bg-white transition-all duration-300 ease-out flex items-center justify-end pr-2"
          style={{ width: `${whitePercentage}%` }}
        >
          {whitePercentage > 25 && (
            <span className="text-black text-xs font-bold">
              {Math.round(whitePercentage)}%
            </span>
          )}
        </div>
        
        {/* Black side */}
        <div 
          className="bg-gray-900 transition-all duration-300 ease-out flex items-center justify-start pl-2"
          style={{ width: `${blackPercentage}%` }}
        >
          {blackPercentage > 25 && (
            <span className="text-white text-xs font-bold">
              {Math.round(blackPercentage)}%
            </span>
          )}
        </div>
        
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-500 transform -translate-x-1/2"></div>
      </div>
      
      {/* Current turn indicator */}
      <div className="p-1 bg-gray-800">
        <div className="flex justify-center">
          <div className={`w-2 h-2 rounded-full ${isWhiteToMove ? 'bg-white' : 'bg-gray-900'}`}></div>
        </div>
      </div>
    </div>
  );
}