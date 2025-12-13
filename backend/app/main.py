# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
# from pydantic import BaseModel
import string
import random
import json
import sys
import os
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.jwt_service import JwtService
from services.game_manager import GameManager


app = FastAPI()

# Allow React frontend to talk to FastAPI

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # allow POST, GET, OPTIONS, etc.
    allow_headers=["*"],
)

# In-memory storage for rooms

game_manager = GameManager()
jwt_service = JwtService()

# -----------------------
# Models

# -----------------------
# Endpoints
# -----------------------
@app.get("/")
def read_root():
    return {"status": "ok"}

@app.post("/games")
async def create_game(request: Request):
    data = await request.json()  # just parse the JSON manually
    user_type = data.get("user_type", "host")

    # Generate 4-letter room code
    room_code = ''.join(random.choices(string.ascii_uppercase, k=4))

    host = game_manager.create_host(room_code=room_code)
    game = game_manager.create_game(room_code=room_code, host=host)

    print(f"Room created: {room_code} by {user_type}")
    result = jwt_service.create_user_token(host.room_code, 'HOST', host.uuid)
    return {"room_code": room_code,
            "auth": result}
# -----------------------
# WebSocket
# -----------------------
@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await websocket.accept()
    player = "dowdy doo"
    print(f"{player} connected to {room}")

    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"message": f"You wrote:", "room": room}))
    except WebSocketDisconnect:
        print(f"{player} disconnected from {room}")
