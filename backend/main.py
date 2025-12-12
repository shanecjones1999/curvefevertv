from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Set
import asyncio
import json
import random
import string
from supabase import create_client, Client
import config
import auth
from game_engine import GameEngine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

game_engines: Dict[str, GameEngine] = {}
room_connections: Dict[str, Set[WebSocket]] = {}
host_connections: Dict[str, WebSocket] = {}

def generate_room_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase, k=4))

async def broadcast_to_room(room_code: str, message: dict):
    if room_code in room_connections:
        disconnected = set()
        for connection in room_connections[room_code]:
            try:
                await connection.send_json(message)
            except:
                disconnected.add(connection)
        room_connections[room_code] -= disconnected

async def game_loop(room_code: str):
    engine = game_engines.get(room_code)
    if not engine:
        return

    while engine.is_running or room_code in game_engines:
        if engine.is_running:
            engine.update()
            state = engine.get_state()
            await broadcast_to_room(room_code, {
                "type": "game_state",
                "data": state
            })

            if not engine.is_running and engine.winner:
                await broadcast_to_room(room_code, {
                    "type": "round_end",
                    "winner": engine.winner
                })

        await asyncio.sleep(1 / config.GAME_FPS)

@app.post("/api/rooms")
async def create_room():
    room_code = generate_room_code()

    while True:
        existing = supabase.table("rooms").select("*").eq("code", room_code).execute()
        if not existing.data:
            break
        room_code = generate_room_code()

    host_id = f"host_{room_code}_{random.randint(1000, 9999)}"

    room = supabase.table("rooms").insert({
        "code": room_code,
        "host_id": host_id,
        "status": "lobby"
    }).execute()

    token = auth.create_token("host", room_code)

    game_engines[room_code] = GameEngine(room_code)
    room_connections[room_code] = set()

    return {
        "room_code": room_code,
        "token": token,
        "host_id": host_id
    }

@app.post("/api/rooms/{room_code}/join")
async def join_room(room_code: str, name: str):
    room = supabase.table("rooms").select("*").eq("code", room_code).execute()

    if not room.data:
        raise HTTPException(status_code=404, detail="Room not found")

    player_id = f"player_{room_code}_{random.randint(1000, 9999)}"

    engine = game_engines.get(room_code)
    if engine:
        player_count = len(engine.players)
        if player_count >= 6:
            raise HTTPException(status_code=400, detail="Room is full")

    player = supabase.table("players").insert({
        "room_id": room.data[0]["id"],
        "player_id": player_id,
        "name": name,
        "color": "#FFFFFF",
        "is_alive": True,
        "score": 0,
        "connected": True
    }).execute()

    token = auth.create_token("player", room_code, player_id)

    return {
        "player_id": player_id,
        "token": token,
        "room_code": room_code,
        "name": name
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    room_code = None
    player_id = None
    user_type = None

    try:
        auth_message = await websocket.receive_json()

        if auth_message.get("type") != "auth":
            await websocket.close(code=1008)
            return

        token = auth_message.get("token")
        payload = auth.verify_token(token)

        if not payload:
            await websocket.close(code=1008)
            return

        room_code = payload["room_code"]
        player_id = payload.get("player_id")
        user_type = payload["user_type"]

        if room_code not in room_connections:
            room_connections[room_code] = set()

        room_connections[room_code].add(websocket)

        if user_type == "host":
            host_connections[room_code] = websocket

        engine = game_engines.get(room_code)
        if not engine:
            engine = GameEngine(room_code)
            game_engines[room_code] = engine

        if user_type == "player" and player_id:
            player_data = supabase.table("players").select("*").eq("player_id", player_id).execute()
            if player_data.data:
                player_info = player_data.data[0]
                if player_id not in engine.players:
                    engine.add_player(player_id, player_info["name"], player_info["score"])

                supabase.table("players").update({"connected": True}).eq("player_id", player_id).execute()

        players_data = supabase.table("players").select("*").eq("room_id",
            supabase.table("rooms").select("id").eq("code", room_code).execute().data[0]["id"]
        ).execute()

        await broadcast_to_room(room_code, {
            "type": "lobby_update",
            "players": [
                {
                    "player_id": p["player_id"],
                    "name": p["name"],
                    "score": p["score"],
                    "connected": p["connected"]
                }
                for p in players_data.data
            ]
        })

        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "start_game":
                if user_type == "host":
                    supabase.table("rooms").update({"status": "playing"}).eq("code", room_code).execute()
                    engine.start_game()
                    await broadcast_to_room(room_code, {"type": "game_started"})
                    asyncio.create_task(game_loop(room_code))

            elif message_type == "control":
                direction = message.get("direction")
                if player_id and direction in ["left", "right", "none"]:
                    dir_map = {"left": -1, "right": 1, "none": 0}
                    engine.set_player_direction(player_id, dir_map[direction])

            elif message_type == "restart_game":
                if user_type == "host":
                    supabase.table("rooms").update({"status": "lobby"}).eq("code", room_code).execute()
                    await broadcast_to_room(room_code, {"type": "game_restarted"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if room_code and room_code in room_connections:
            room_connections[room_code].discard(websocket)

        if player_id:
            supabase.table("players").update({"connected": False}).eq("player_id", player_id).execute()

            players_data = supabase.table("players").select("*").eq("room_id",
                supabase.table("rooms").select("id").eq("code", room_code).execute().data[0]["id"]
            ).execute()

            await broadcast_to_room(room_code, {
                "type": "lobby_update",
                "players": [
                    {
                        "player_id": p["player_id"],
                        "name": p["name"],
                        "score": p["score"],
                        "connected": p["connected"]
                    }
                    for p in players_data.data
                ]
            })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
