# backend/app/socketio_events.py
import socketio

# You can import your game manager / other services here if needed
from services.game_manager import GameManager

game_manager = GameManager()

def register_socketio_events(sio: socketio.AsyncServer):
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
