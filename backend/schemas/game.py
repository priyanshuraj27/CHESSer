from pydantic import BaseModel, model_validator
from typing import List, Optional

class MoveAnalysis(BaseModel):
    move: str
    eval: float
    best_move: str
    type: str

class GameAnalysisRequest(BaseModel):
    pgn: Optional[str]
    lichess_url: Optional[str]

    @model_validator(mode='after')
    def at_least_one_field(self):
        if not self.pgn and not self.lichess_url:
            raise ValueError("Either 'pgn' or 'lichess_url' must be provided in the request body.")
        return self

class GameAnalysisResponse(BaseModel):
    accuracy: float
    blunders: int
    mistakes: int
    inaccuracies: int
    move_analysis: List[MoveAnalysis]
