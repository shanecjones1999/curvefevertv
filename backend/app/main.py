# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.websocket("/ws/{room}/{player}")
async def websocket_endpoint(websocket: WebSocket, room: str, player: str):
    await websocket.accept()
    print(f"{player} connected to {room}")
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"{player} says: {data}")
    except WebSocketDisconnect:
        print(f"{player} disconnected from {room}")
        # Optional: do cleanup here, like removing player from a lobby
