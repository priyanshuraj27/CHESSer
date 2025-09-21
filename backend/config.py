import os
from dotenv import load_dotenv

load_dotenv()

LICHESS_API_TOKEN = os.getenv("LICHESS_API_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chess.db")
