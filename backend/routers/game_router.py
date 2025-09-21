from fastapi import APIRouter, HTTPException
from schemas.game import GameAnalysisRequest, GameAnalysisResponse, MoveAnalysis
from services.lichess_services import fetch_game_by_url
from utils.chess_utils import parse_pgn_moves
from services.analysis_services import calculate_accuracy
import httpx

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
