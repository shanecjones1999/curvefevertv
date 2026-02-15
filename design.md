# Curvefever Jackbox-Style – Design Document

## 1. Overview

### Goal
Build a real-time multiplayer Curvefever-style game where:

- A **host screen (TV/browser)** renders the game.
- Players connect via **mobile phones** as controllers.
- Players create/join lobbies using room codes.
- Host starts game.
- Game plays in real-time with smooth movement.

### MVP Scope

**Included:**
- Create lobby  
- Join lobby  
- Display players in lobby  
- Start game  
- Real-time gameplay  
- Basic collision detection  
- Round reset  

**Not Included (MVP):**
- Accounts  
- Persistent storage  
- Powerups  
- Match history  
- Spectators  

---

# 2. High-Level Architecture

```
Phones (Controllers)
        |
        v
   WebSocket (Socket.IO)
        |
        v
  Node.js Game Server
        |
        v
Host Screen (Game Renderer)
```

---

# 3. Technology Stack

## Frontend (Host Screen)
- React  
- Phaser  
- Socket.IO client  

## Frontend (Phone Controllers)
- React  
- Touch controls (tap-and-hold left/right)  
- Socket.IO client  

## Backend
- Node.js  
- Express  
- Socket.IO  
- In-memory room + game state store  

---

# 4. Why Socket.IO?

Real Curvefever likely used:
- Raw WebSockets or Flash sockets originally  
- Later migrated to WebSockets  

For MVP:
- Socket.IO gives:
  - Automatic reconnection  
  - Room abstraction  
  - Built-in broadcasting  
  - Simpler dev experience  

You can swap to `ws` later if you want lower-level control.

---

# 5. Core System Design

## 5.1 Room Model

```ts
interface Room {
  id: string
  hostSocketId: string
  players: Map<string, Player>
  state: "lobby" | "playing" | "finished"
  game: GameState | null
}
```

---

## 5.2 Player Model

```ts
interface Player {
  id: string
  name: string
  socketId: string
  color: string
  alive: boolean
  x: number
  y: number
  direction: number
  trail: Array<{ x: number; y: number }>
}
```

---

# 6. Lobby Flow

### 1️⃣ Host Creates Room
Server:
- Generate 4-letter code  
- Create room  
- Mark host  
- Return `roomCode`  

---

### 2️⃣ Players Join
- Player enters room code + name  
- Server validates room  
- Adds player  
- Broadcasts `playerJoined` to host  

---

### 3️⃣ Host Starts Game
- Validate ≥ 2 players  
- Initialize `GameState`  
- Emit `startGame`  
- Begin game loop  

---

# 7. Game Architecture

## Recommended: Authoritative Server Model

**Server:**
- Runs game loop (60 FPS)  
- Updates positions  
- Checks collisions  
- Broadcasts game state  

**Clients:**
- Send input only  
- Render what server sends  

### Pros
- Prevents cheating  
- Single source of truth  
- Easier collision logic  

### Cons
- Slightly more backend complexity  

---

# 8. Game Loop Design

Server runs:

```js
setInterval(gameTick, 1000 / 60);
```

### Game Tick Responsibilities:
1. Update player directions from input  
2. Move players forward  
3. Append trail  
4. Handle gaps (distance-based)  
5. Detect collisions:
   - Wall collision  
   - Trail collision  
6. Mark players dead  
7. Check round end  
8. Broadcast minimal state  

---

# 9. Networking Protocol

## Client → Server

### From Phone
```
{
  turnLeft: boolean,
  turnRight: boolean
}
```

Only input state is sent.

---

## Server → Clients

### Lobby Events
- `playerJoined`
- `playerLeft`
- `lobbyUpdate`
- `startGame`

### Game Events
- `gameState`
- `playerDied`
- `roundOver`
- `resetRound`

---

# 10. Game State Broadcast Strategy

Do **not** send full trails every frame.

Instead, send:

```
{
  players: [
    { id, x, y, direction, alive }
  ]
}
```

Host screen:
- Maintains canvas  
- Draws trails locally  

This keeps bandwidth low.

---

# 11. Collision System

Each player:
- Maintains trail array  
- On each tick:
  - Add new segment  
  - Check intersection with:
    - All other trails  
    - Own trail (excluding recent points)  
    - Boundaries  

For MVP:  
- Spatial hashing  

---

# 12. Gap Logic (Curvefever Style)

Distance-based gap system.

Each player tracks:

```
distanceSinceLastGap
gapInterval
gapLength
```

If:

```
distanceSinceLastGap > gapInterval
```

Then:
- Stop adding trail points temporarily  
- Resume after `gapLength` distance  

---

# 13. Round Flow

```
Lobby
  ↓
Countdown
  ↓
Playing
  ↓
Round Over
  ↓
Score Update
  ↓
Next Round
```

Round ends when:
- 0 or 1 players alive  

---

# 14. Scaling Considerations (Post-MVP)

For MVP:
- In-memory rooms OK  

For production:
- Redis adapter for Socket.IO  
- Horizontal scaling  
- Sticky sessions  
- Possibly migrate to raw WebSocket for lower overhead  

---

# 15. Security Considerations

- Host validation  
- Input rate limiting  
- Prevent fake `startGame` events  
- Validate room codes  
- Validate message schema  

---

# 16. Reconnection Strategy

Store:

```
playerId in localStorage
```

If socket reconnects:
- Re-associate with player  
- Restore alive state if game still active  

---

# 17. Folder Structure

## Backend

```
/server
  server.js
  rooms.js
  gameLoop.js
  collision.js
  constants.js
```

## Frontend

```
/host
/phone
/shared-types
```

---

# 18. MVP Milestones

### Milestone 1
- Create room  
- Join room  
- Show lobby players  

### Milestone 2
- Start game  
- Move players  

### Milestone 3
- Trails render  

### Milestone 4
- Collision detection  

### Milestone 5
- Round reset + scoring  

---

# 19. Architecture Summary

- Server authoritative  
- Socket.IO for MVP  
- Canvas rendering on host only  
- Phones send input state only  
- 60 FPS game loop  
