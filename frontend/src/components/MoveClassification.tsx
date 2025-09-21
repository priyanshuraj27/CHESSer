"use client";

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { classifyMove, LichessEvaluation } from "../lib/lichessAPI";

interface MoveClassificationProps {
  previousEvaluation: LichessEvaluation | null;
  currentEvaluation: LichessEvaluation | null;
  move: string;
  moveIndex: number;
  isWhiteMove: boolean;
}

export default function MoveClassification({ 
  previousEvaluation, 
  currentEvaluation, 
  move, 
  moveIndex,
  isWhiteMove 
}: MoveClassificationProps) {
  const [classification, setClassification] = useState<string | null>(null);

  useEffect(() => {
    if (!previousEvaluation || !currentEvaluation || 
        !previousEvaluation.pvs || !currentEvaluation.pvs ||
        previousEvaluation.pvs.length === 0 || currentEvaluation.pvs.length === 0) {
      setClassification(null);
      return;
    }

    // Get the best evaluation from each position
    const prevBest = previousEvaluation.pvs[0];
    const currBest = currentEvaluation.pvs[0];
    
    // Convert to centipawns for comparison
    let prevEval = 0;
    let currEval = 0;
    
    if (prevBest.mate !== null && prevBest.mate !== undefined) {
      prevEval = prevBest.mate > 0 ? 9999 : -9999;
    } else if (prevBest.cp !== null && prevBest.cp !== undefined) {
      prevEval = prevBest.cp;
    }
    
    if (currBest.mate !== null && currBest.mate !== undefined) {
      currEval = currBest.mate > 0 ? 9999 : -9999;
    } else if (currBest.cp !== null && currBest.cp !== undefined) {
      currEval = currBest.cp;
    }
    
    // Adjust evaluation perspective if it's black's move
    if (!isWhiteMove) {
      prevEval = -prevEval;
      currEval = -currEval;
    }

    const moveClass = classifyMove(currEval, prevEval);
    setClassification(moveClass);
  }, [previousEvaluation, currentEvaluation, isWhiteMove]);

  if (!classification || moveIndex === 0) {
    return null;
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "excellent":
        return "bg-green-600 text-white";
      case "good":
        return "bg-green-500 text-white";
      case "inaccuracy":
        return "bg-yellow-500 text-black";
      case "mistake":
        return "bg-orange-500 text-white";
      case "blunder":
        return "bg-red-600 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case "excellent":
        return "✓✓";
      case "good":
        return "✓";
      case "inaccuracy":
        return "?!";
      case "mistake":
        return "?";
      case "blunder":
        return "??";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-gray-400 text-sm">
        {moveIndex}. {move}
      </span>
      <span className={`px-2 py-1 rounded text-xs font-semibold ${getClassificationColor(classification)}`}>
        {getClassificationIcon(classification)} {classification}
      </span>
    </div>
  );
}