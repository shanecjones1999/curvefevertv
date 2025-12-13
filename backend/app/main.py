# backend/app/main.py
import random
import string
import sys, os
import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.jwt_service import JwtService
from services.game_manager import GameManager

# -----------------------
# FastAPI + Socket.IO Setup
# -----------------------
# Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)

# FastAPI app
app = FastAPI()

# Wrap FastAPI with Socket.IO ASGI app
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

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
    data = await request.json()
    user_type = data.get("user_type", "host")

    # Generate 4-letter room code
    room_code = "".join(random.choices(string.ascii_uppercase, k=4))

    host = game_manager.create_host(room_code=room_code)
    game = game_manager.create_game(room_code=room_code, host=host)

    result = jwt_service.create_user_token(host.room_code, "HOST", host.uuid)
    return {"room_code": room_code, "auth": result}

# -----------------------
# Socket.IO Events
# -----------------------
@sio.event
async def connect(sid, environ, auth):
    token = auth.get("token") if auth else None
    print(f"[Socket.IO] Client connected: {sid}, token: {token}")

@sio.event
async def disconnect(sid):
    print(f"[Socket.IO] Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    room = data.get("room")
    if room:
        sio.enter_room(sid, room)
        await sio.emit("message", {"message": f"{sid} joined {room}"}, room=room)
        print(f"[Socket.IO] {sid} joined room {room}")

@sio.event
async def leave_room(sid, data):
    room = data.get("room")
    if room:
        sio.leave_room(sid, room)
        await sio.emit("message", {"message": f"{sid} left {room}"}, room=room)
        print(f"[Socket.IO] {sid} left room {room}")

@sio.event
async def message(sid, data):
    print(f"[Socket.IO] Received message from {sid}: {data}")
    room = data.get("room")
    if room:
        await sio.emit("message", data, room=room)
    else:
        await sio.emit("message", data)
