from pydantic import BaseModel, root_validator
from typing import List, Optional

class MoveAnalysis(BaseModel):
    move: str
    eval: float
    best_move: str
    type: str

class GameAnalysisRequest(BaseModel):
    pgn: Optional[str]
    lichess_url: Optional[str]

    @root_validator
    def at_least_one_field(cls, values):
        if not values.get("pgn") and not values.get("lichess_url"):
            raise ValueError("Either 'pgn' or 'lichess_url' must be provided in the request body.")
        return values

class GameAnalysisResponse(BaseModel):
    accuracy: float
    blunders: int
    mistakes: int
    inaccuracies: int
    move_analysis: List[MoveAnalysis]
