"use client";

import { useState, useEffect } from "react";
import { LichessEvaluation, formatEvaluation } from "../lib/lichessAPI";

interface EvaluationDisplayProps {
  evaluation: LichessEvaluation | null;
  isLoading: boolean;
  source?: string; // "lichess", "stockfish", "cache"
}

export default function EvaluationDisplay({ evaluation, isLoading, source }: EvaluationDisplayProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mt-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-gray-300">Analyzing position...</span>
        </div>
      </div>
    );
  }

  if (!evaluation || !evaluation.pvs || evaluation.pvs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mt-4">
        <div className="text-center">
          <span className="text-gray-500">No evaluation available</span>
          <p className="text-xs text-gray-600 mt-1">
            This position hasn't been analyzed by Lichess yet
          </p>
        </div>
      </div>
    );
  }

  const bestLine = evaluation.pvs[0];
  const evalText = formatEvaluation(bestLine.cp, bestLine.mate);
  
  // Determine evaluation color
  const getEvalColor = (cp?: number, mate?: number) => {
    if (mate !== null && mate !== undefined) {
      return mate > 0 ? "text-green-400" : "text-red-400";
    }
    if (cp !== null && cp !== undefined) {
      if (cp > 100) return "text-green-400";
      if (cp < -100) return "text-red-400";
      return "text-gray-300";
    }
    return "text-gray-300";
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4 space-y-3">
      {/* Main evaluation */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400">Evaluation:</span>
        <span className={`font-bold text-lg ${getEvalColor(bestLine.cp, bestLine.mate)}`}>
          {evalText}
        </span>
      </div>

      {/* Engine info */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Depth: {evaluation.depth}</span>
        <span className="text-gray-500">Nodes: {evaluation.knodes}k</span>
        {source && (
          <span className={`text-xs px-2 py-1 rounded ${
            source === 'lichess' ? 'bg-blue-600 text-white' :
            source === 'stockfish' ? 'bg-green-600 text-white' :
            source === 'cache' ? 'bg-purple-600 text-white' :
            'bg-gray-600 text-white'
          }`}>
            {source.toUpperCase()}
          </span>
        )}
      </div>

      {/* Best moves */}
      <div className="space-y-2">
        <span className="text-gray-400 text-sm">Best lines:</span>
        {evaluation.pvs.slice(0, 3).map((pv, index) => (
          <div key={index} className="bg-gray-700 rounded p-2 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300">#{index + 1}</span>
              <span className={getEvalColor(pv.cp, pv.mate)}>
                {formatEvaluation(pv.cp, pv.mate)}
              </span>
            </div>
            <div className="text-gray-400 font-mono text-xs">
              {pv.moves.split(' ').slice(0, 6).join(' ')}
              {pv.moves.split(' ').length > 6 && '...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}