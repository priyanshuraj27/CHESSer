from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import game_router

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
# include routers
app.include_router(game_router.router, prefix="/games", tags=["games"])
