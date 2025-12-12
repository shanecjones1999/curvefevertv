from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PlayerCreate(BaseModel):
    name: str
    room_code: str

class PlayerState(BaseModel):
    player_id: str
    name: str
    color: str
    x: float
    y: float
    angle: float
    is_alive: bool
    score: int

class RoomCreate(BaseModel):
    pass

class RoomInfo(BaseModel):
    code: str
    status: str
    players: List[PlayerState]

class GameState(BaseModel):
    room_code: str
    status: str
    players: List[PlayerState]
    trails: List[List[tuple]]
    winner: Optional[str] = None

class ControlInput(BaseModel):
    direction: str
    player_id: str
    room_code: str

class JWTPayload(BaseModel):
    user_type: str
    player_id: Optional[str] = None
    room_code: str
    exp: datetime
