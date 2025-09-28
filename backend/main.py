from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import game_router
from services.game_review_service import get_game_review_service
from pydantic import BaseModel

# Additional classes for analysis
class AnalyzeGameRequest(BaseModel):
    pgn: str

app = FastAPI(title="CHESSER")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("APP is Running")

# Pydantic models for game review
class GameReviewRequest(BaseModel):
    pgn: str

# include routers
app.include_router(game_router.router, prefix="/games", tags=["games"])

@app.get("/test-stockfish")
async def test_stockfish():
    """
    Test if Stockfish is working
    """
    try:
        service = get_game_review_service()
        print("🔧 [TEST] Testing Stockfish engine...")
        
        # Test with a simple position
        import chess
        board = chess.Board()
        eval_result, best_move = await service.analyze_position(board)
        
        return {
            "stockfish_working": True,
            "stockfish_path": service.stockfish_path,
            "test_evaluation": eval_result,
            "test_best_move": best_move
        }
    except Exception as e:
        return {
            "stockfish_working": False,
            "error": str(e)
        }

@app.post("/analyze-game-review")
async def analyze_game_review(request: AnalyzeGameRequest):
    """
    Analyze a complete game and return move classifications like Chess.com
    """
    print("🔥 [API ENDPOINT] /analyze-game-review called")
    print(f"📥 [API ENDPOINT] Request received with PGN length: {len(request.pgn)}")
    print(f"📝 [API ENDPOINT] PGN preview: {request.pgn[:200]}...")
    
    try:
        print("🚀 [API ENDPOINT] Starting game analysis...")
        service = get_game_review_service()
        print(f"🔧 [API ENDPOINT] Service created, Stockfish path: {service.stockfish_path}")
        analysis = await service.analyze_game(request.pgn)
        print("✅ [API ENDPOINT] Analysis completed successfully")
        print(f"📊 [API ENDPOINT] Returning analysis with {len(analysis.get('moves', []))} moves")
        return analysis
    except Exception as e:
        print(f"💥 [API ENDPOINT] Error during analysis: {e}")
        print(f"🔍 [API ENDPOINT] Error type: {type(e).__name__}")
        import traceback
        print(f"📋 [API ENDPOINT] Full error:\n{traceback.format_exc()}")
        return {"error": str(e)}

@app.post("/debug-pgn")
async def debug_pgn(request: AnalyzeGameRequest):
    """Debug endpoint to test PGN parsing without analysis"""
    try:
        print("🐛 [DEBUG PGN] Starting PGN debug analysis...")
        
        service = get_game_review_service()
        if not service:
            return {"error": "Could not initialize game review service"}
        
        # Test PGN cleaning
        cleaned_pgn = service.clean_pgn(request.pgn)
        
        # Test PGN parsing
        import io
        import chess.pgn
        
        # Try parsing original PGN
        try:
            pgn_io = io.StringIO(request.pgn)
            game_original = chess.pgn.read_game(pgn_io)
            original_success = game_original is not None
            original_moves = list(game_original.mainline_moves()) if game_original else []
        except Exception as e:
            original_success = False
            original_moves = []
            print(f"❌ [DEBUG PGN] Original parsing failed: {e}")
        
        # Try parsing cleaned PGN
        try:
            pgn_io = io.StringIO(cleaned_pgn)
            game_cleaned = chess.pgn.read_game(pgn_io)
            cleaned_success = game_cleaned is not None
            cleaned_moves = list(game_cleaned.mainline_moves()) if game_cleaned else []
        except Exception as e:
            cleaned_success = False
            cleaned_moves = []
            print(f"❌ [DEBUG PGN] Cleaned parsing failed: {e}")
        
        return {
            "original_pgn_length": len(request.pgn),
            "cleaned_pgn_length": len(cleaned_pgn),
            "original_parsing_success": original_success,
            "cleaned_parsing_success": cleaned_success,
            "original_moves_count": len(original_moves),
            "cleaned_moves_count": len(cleaned_moves),
            "first_10_original_moves": [str(move) for move in original_moves[:10]],
            "first_10_cleaned_moves": [str(move) for move in cleaned_moves[:10]],
            "cleaned_pgn_preview": cleaned_pgn[:800],  # Increased preview length
            "original_pgn_preview": request.pgn[:500],
            "cleaned_pgn_full": cleaned_pgn  # Full cleaned PGN for debugging
        }
        
    except Exception as e:
        print(f"❌ [DEBUG PGN] Error: {e}")
        import traceback
        return {"error": f"Debug failed: {str(e)}", "traceback": traceback.format_exc()}
