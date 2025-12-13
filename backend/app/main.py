# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
# from pydantic import BaseModel
import string
import random
import sys
import os
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from jwt_service import JwtService


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
rooms = {}

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

    # Store room info
    rooms[room_code] = {
        "host": user_type == "host",
        "players": []
    }

    print(f"Room created: {room_code} by {user_type}")
    result = jwt_service.create_host_token(room_code)
    return {"room_code": room_code,
            "jwt_token": result["token"]}
# -----------------------
# WebSocket
# -----------------------
@app.websocket("/ws/{room}/{player}")
async def websocket_endpoint(websocket: WebSocket, room: str, player: str):
    await websocket.accept()
    print(f"{player} connected to {room}")

    # Add player to room list
    if room in rooms:
        rooms[room]["players"].append(player)
    else:
        rooms[room] = {"host": False, "players": [player]}

    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"{player} says: {data}")
    except WebSocketDisconnect:
        print(f"{player} disconnected from {room}")
        if room in rooms and player in rooms[room]["players"]:
            rooms[room]["players"].remove(player)
