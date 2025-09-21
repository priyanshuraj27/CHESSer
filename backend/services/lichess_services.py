import httpx
from config import LICHESS_API_TOKEN

HEADERS = {"Authorization": f"Bearer {LICHESS_API_TOKEN}"}

async def fetch_game_by_url(url: str):
    # extract game ID from Lichess URL
    game_id = url.rstrip("/").split("/")[-1]
    lichess_api = f"https://lichess.org/game/export/{game_id}?moves=true&pgnInJson=true"
    async with httpx.AsyncClient() as client:
        resp = await client.get(lichess_api, headers=HEADERS)
        resp.raise_for_status()
        return resp.json()  # returns dict with PGN
