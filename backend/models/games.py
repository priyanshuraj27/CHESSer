from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    pgn = Column(String, nullable=False)
    accuracy = Column(Float)
    blunders = Column(Integer)
    mistakes = Column(Integer)
    inaccuracies = Column(Integer)
    result = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
