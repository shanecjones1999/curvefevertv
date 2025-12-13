# backend/app/main.py
import random
import string
import sys, os

import socketio
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.jwt_service import JwtService
from services.game_manager import GameManager
from websocket_handler import register_socketio_events  # <-- import

# -----------------------
# FastAPI + Socket.IO Setup
# -----------------------
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI()
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Register events
register_socketio_events(sio)

# Allow React frontend to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------
# Game / JWT services
# -----------------------
game_manager = GameManager()
jwt_service = JwtService()

# -----------------------
# REST Endpoints
# -----------------------
@app.post("/games")
async def create_game(request: Request):
    room_code = "".join(random.choices(string.ascii_uppercase, k=4))
    game = game_manager.create_game(room_code=room_code)
    result = jwt_service.create_user_token(game.host.room_code, "host", game.host.uuid)
    return {"room_code": room_code, "auth": result}

@app.post("/games/{room_code}/players")
async def join_game(room_code: str, request: Request):
    # Check if the game exists
    if not game_manager.game_exists(room_code):
        raise HTTPException(status_code=404, detail="Game not found")
    
    body = await request.json()
    name = body.get("name")
    # Create the player with the provided name
    player = game_manager.create_player(room_code=room_code, name=name)

    # Generate JWT for the player
    result = jwt_service.create_user_token(room_code, "player", player.uuid)

    # Return room code and auth info
    return {"room_code": room_code, "auth": result}
