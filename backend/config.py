import os
from dotenv import load_dotenv

load_dotenv()

LICHESS_API_TOKEN = os.getenv("LICHESS_API_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chess.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STOCKFISH_PATH = os.getenv("STOCKFISH_PATH")  # Optional: specify custom Stockfish path
