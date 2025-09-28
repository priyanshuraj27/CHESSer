from fastapi import APIRouter, HTTPException, Query
from schemas.game import GameAnalysisRequest, GameAnalysisResponse, MoveAnalysis
from services.lichess_services import fetch_game_by_url
from utils.chess_utils import parse_pgn_moves, pgn_to_fens
from services.analysis_services import calculate_accuracy
from services.enhanced_analysis_service import get_analysis_service
from typing import List, Optional
import httpx
import chess

router = APIRouter()

@router.post("/analyze", response_model=GameAnalysisResponse)
async def analyze_game(request: GameAnalysisRequest):
    print("/analyze endpoint was hit")

    # 1️⃣ Get PGN either from Lichess URL or directly
    if request.lichess_url:
        try:
            data = await fetch_game_by_url(request.lichess_url)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=400, detail="Lichess game not found. Please check the URL.")
            else:
                raise HTTPException(status_code=400, detail=f"Error fetching game from Lichess: {e}")
        pgn = data.get("pgn")
        if not pgn:
            raise HTTPException(status_code=400, detail="Unable to fetch PGN from Lichess")
    elif request.pgn:
        pgn = request.pgn
    else:
        raise HTTPException(status_code=400, detail="PGN or Lichess URL required")

    # 2️⃣ Parse moves to ensure valid PGN
    try:
        moves = parse_pgn_moves(pgn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not moves:
        raise HTTPException(status_code=400, detail="No valid moves found in PGN. Please check the PGN format.")

    # 3️⃣ Calculate real accuracy using Lichess analysis API
    try:
        accuracy, blunders, mistakes, inaccuracies, move_analysis_data = await calculate_accuracy(pgn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Lichess analysis: {e}")

    # 4️⃣ Convert move analysis to Pydantic models
    move_analysis = [MoveAnalysis(**m) for m in move_analysis_data]

    # 5️⃣ Return full response
    return GameAnalysisResponse(
        accuracy=accuracy,
        blunders=blunders,
        mistakes=mistakes,
        inaccuracies=inaccuracies,
        move_analysis=move_analysis
    )

@router.get("/analyze-fen")
async def analyze_fen(
    fen: str = Query(..., description="FEN string to analyze"),
    depth: int = Query(15, description="Analysis depth for Stockfish fallback"),
    multi_pv: int = Query(1, description="Number of principal variations")
):
    """
    Analyze a single FEN position with Lichess Cloud Eval + Stockfish fallback
    """
    try:
        # Validate FEN
        board = chess.Board(fen)
        if not board.is_valid():
            raise HTTPException(status_code=400, detail="Invalid FEN string")
        
        # Analyze the position
        service = get_analysis_service()
        result = await service.analyze_position(fen, multi_pv, depth)
        
        return {
            "success": True,
            "source": result.source,
            "fen": result.fen,
            "evaluation": result.evaluation,
            "depth": result.depth,
            "time_taken": result.time_taken
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/analyze-batch")
async def analyze_batch_fens(
    request: dict  # {"fens": ["fen1", "fen2", ...], "depth": 12}
):
    """
    Analyze multiple FEN positions efficiently
    """
    try:
        fens = request.get("fens", [])
        depth = request.get("depth", 12)
        
        if not fens:
            raise HTTPException(status_code=400, detail="No FENs provided")
        
        if len(fens) > 100:  # Limit batch size
            raise HTTPException(status_code=400, detail="Maximum 100 FENs per batch")
        
        # Validate all FENs first
        for i, fen in enumerate(fens):
            try:
                board = chess.Board(fen)
                if not board.is_valid():
                    raise HTTPException(status_code=400, detail=f"Invalid FEN at index {i}: {fen}")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid FEN at index {i}: {fen}")
        
        # Analyze all positions
        service = get_analysis_service()
        results = await service.analyze_multiple_positions(fens, depth)
        
        return {
            "success": True,
            "total_positions": len(fens),
            "results": [
                {
                    "source": result.source,
                    "fen": result.fen,
                    "evaluation": result.evaluation,
                    "depth": result.depth,
                    "time_taken": result.time_taken
                }
                for result in results
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")

@router.post("/analyze-pgn")
async def analyze_pgn_positions(
    request: dict  # {"pgn": "...", "depth": 12, "every_n_moves": 2}
):
    """
    Analyze key positions from a PGN game
    """
    try:
        pgn = request.get("pgn", "")
        depth = request.get("depth", 12)
        every_n_moves = request.get("every_n_moves", 2)  # Analyze every 2nd move to save time
        
        if not pgn:
            raise HTTPException(status_code=400, detail="No PGN provided")
        
        # Convert PGN to FENs
        fens = pgn_to_fens(pgn, every_n_moves)
        
        if not fens:
            raise HTTPException(status_code=400, detail="No valid positions found in PGN")
        
        # Analyze positions
        service = get_analysis_service()
        results = await service.analyze_multiple_positions(fens, depth)
        
        return {
            "success": True,
            "pgn": pgn,
            "total_positions": len(fens),
            "analyzed_every_n_moves": every_n_moves,
            "results": [
                {
                    "move_number": i * every_n_moves + 1,
                    "source": result.source,
                    "fen": result.fen,
                    "evaluation": result.evaluation,
                    "depth": result.depth,
                    "time_taken": result.time_taken
                }
                for i, result in enumerate(results)
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PGN analysis failed: {str(e)}")
