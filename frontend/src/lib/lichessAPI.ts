export interface LichessEvaluation {
  fen: string;
  knodes: number;
  depth: number;
  pvs: Array<{
    moves: string;
    cp?: number;
    mate?: number;
  }>;
}

export interface EnhancedAnalysisResult {
  success: boolean;
  source: "lichess" | "stockfish" | "cache" | "none";
  fen: string;
  evaluation: LichessEvaluation;
  depth?: number;
  time_taken?: number;
}

export interface BatchAnalysisResult {
  success: boolean;
  total_positions: number;
  results: EnhancedAnalysisResult[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function getLichessEvaluation(fen: string, multiPv: number = 3): Promise<LichessEvaluation | null> {
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      // Don't log 404s as they are expected for unanalyzed positions
      if (response.status !== 404) {
        console.warn(`Lichess API returned ${response.status} for FEN: ${fen}`);
      }
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching Lichess evaluation:", error);
    return null;
  }
}

// Enhanced backend analysis functions
export async function getEnhancedEvaluation(fen: string, depth: number = 15): Promise<EnhancedAnalysisResult | null> {
  try {
    const url = `${BACKEND_URL}/games/analyze-fen?fen=${encodeURIComponent(fen)}&depth=${depth}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Enhanced analysis failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching enhanced evaluation:", error);
    return null;
  }
}

export async function getBatchEvaluation(fens: string[], depth: number = 12): Promise<BatchAnalysisResult | null> {
  try {
    const url = `${BACKEND_URL}/games/analyze-batch`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fens: fens,
        depth: depth
      })
    });
    
    if (!response.ok) {
      console.error(`Batch analysis failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching batch evaluation:", error);
    return null;
  }
}

export async function analyzePGN(pgn: string, depth: number = 12, everyNMoves: number = 2): Promise<any> {
  try {
    const url = `${BACKEND_URL}/games/analyze-pgn`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pgn: pgn,
        depth: depth,
        every_n_moves: everyNMoves
      })
    });
    
    if (!response.ok) {
      console.error(`PGN analysis failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error analyzing PGN:", error);
    return null;
  }
}

export function formatEvaluation(cp?: number, mate?: number): string {
  if (mate !== null && mate !== undefined) {
    return `M${mate}`;
  }
  if (cp !== null && cp !== undefined) {
    return (cp / 100).toFixed(1);
  }
  return "0.0";
}

export function classifyMove(currentEval: number, previousEval: number): string {
  const diff = Math.abs(currentEval - previousEval);
  
  if (diff <= 50) return "excellent";
  if (diff <= 100) return "good";
  if (diff <= 200) return "inaccuracy";
  if (diff <= 400) return "mistake";
  return "blunder";
}

export function calculateAccuracy(evaluations: number[]): number {
  if (evaluations.length < 2) return 100;
  
  let totalMoves = 0;
  let accurateMovesScore = 0;
  
  for (let i = 1; i < evaluations.length; i++) {
    const diff = Math.abs(evaluations[i] - evaluations[i - 1]);
    totalMoves++;
    
    // Scoring based on centipawn loss
    if (diff <= 50) accurateMovesScore += 1.0;
    else if (diff <= 100) accurateMovesScore += 0.8;
    else if (diff <= 200) accurateMovesScore += 0.5;
    else if (diff <= 400) accurateMovesScore += 0.2;
    // Blunders get 0 points
  }
  
  return Math.round((accurateMovesScore / totalMoves) * 100);
}