from fastapi import FastAPI
from routers import game_router

app = FastAPI(title="KnightlyAI")
print("APP is Running")
# include routers
app.include_router(game_router.router, prefix="/games", tags=["games"])
