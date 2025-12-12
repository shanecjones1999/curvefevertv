# CurveFever Party Game — Product Requirements Document (PRD)

## 1. Overview

CurveFever Party Game is a real-time, browser-based multiplayer game inspired by the classic CurveFever / Achtung, die Kurve style gameplay. It is designed to be played locally by groups of friends where:

- One user acts as the **Host**, displaying the game on a TV or desktop browser.
- Multiple **Players** join using their mobile phones and control their character using simple left/right controls.

The game is lightweight, requires no account creation, and supports reconnection if a player refreshes their browser or loses connection.

---

## 2. Goals

- Deliver a fun, fast-paced local multiplayer experience.
- Create a simple join flow with no authentication or login friction.
- Support real-time gameplay at 30–60 FPS using lightweight WebSocket communication.
- Ensure the UI is mobile-first for Player devices.
- Make the system resilient to browser refreshes and network hiccups.

---

## 3. Non-Goals

- No matchmaking across the internet.
- No cross-game persistence, levels, or XP system.
- No power-ups in the initial version.
- No full-screen mobile gameplay for Hosts.

---

## 4. User Roles

### 4.1 Host

- Creates a room.
- Displays a 4-letter room code.
- Shows the lobby (list of connected players).
- Starts the game.
- Does NOT participate as a player.

### 4.2 Player

- Enters their name and room code.
- Joins the Host’s room.
- Waits in the lobby with confirmation of the room code.
- Uses two large on-screen buttons to turn left or right.
- Competes to be the last player alive.

---

## 5. User Stories

### Host Stories

- “As a Host, I want to create a game so my friends can join.”
- “As a Host, I want to see a list of players as they join.”
- “As a Host, I want to start the game when everyone is ready.”

### Player Stories

- “As a Player, I want to join a game quickly without making an account.”
- “As a Player, I want to see my status in the lobby.”
- “As a Player, I want simple controls on my phone for turning left or right.”
- “As a Player, I want to reconnect seamlessly if my browser refreshes.”

---

## 6. Functional Requirements

### 6.1 Onboarding Flow

- First screen: **Choose Host or Player**.
- Host:
  - Creates room.
  - Redirected to **Host Lobby**.
- Player:
  - Inputs **name** and **room code**.
  - Joins the room via WebSocket handshake.
  - Redirected to **Player Lobby**.

### 6.2 Lobby

- Host sees:
  - Room code.
  - Player list (live-updating).
  - Start game button (enabled if ≥ 1 player).
- Player sees:
  - Room code.
  - Their name.
  - “Waiting for host” message.

### 6.3 Game Loop

- Server maintains:
  - Player positions.
  - Directions.
  - Collision detection.
  - Alive/dead state.
- Clients render:
  - Host: full arena canvas.
  - Player: controls only.
- Server broadcasts state updates at ~30 FPS.

### 6.4 Reconnection

- Players reconnect using:
  - Stored JWT
  - Stored player ID
  - Room code
- Server restores:
  - Player status
  - Alive/dead state
- Host reconnect also supported (re-renders current game state).

---

## 7. Game Rules

- All players move forward automatically at a constant speed.
- Players leave a solid trail behind as they move.
- Collisions with:
  - Walls → death  
  - Own trail → death  
  - Other trails → death
- Last surviving player wins the round.

---

## 8. Technical Requirements

### 8.1 Backend (FastAPI)

- Python FastAPI server with:
  - WebSocket endpoints
  - JWT-based lightweight auth
  - Game state loop
  - Room creation and management
- Must handle:
  - Player join/leave
  - Reconnects
  - State broadcasting
- Use `asyncio` event loop for real-time ticks.

### 8.2 Frontend (React)

- React SPA using WebSockets for real-time updates.
- Pages:
  - Home (Host/Player choice)
  - Host Lobby
  - Player Join
  - Player Lobby
  - Player Controls
  - Host Game View

### 8.3 WebSocket Requirements

- One WebSocket per client.
- Server tracks:
  - Client type (Host or Player)
  - Room code
  - Player ID
- Reconnect logic:
  - On reconnect, client sends stored JWT + room code + player ID.
  - Server restores session if valid.

### 8.4 JWT Authentication

- JWT contains:
  - user_type (host/player)
  - player_id
  - room_code
- JWT stored in `localStorage`.

---

## 9. Mobile-Friendly UI Requirements

### 9.1 General

- Fully responsive design for 320px+ screen widths.
- Minimum 44×44 px touch targets.
- Use large, high-contrast buttons.

### 9.2 Player Join Screen

- Inputs centered vertically.
- Keyboard does not block inputs.
- “Join Game” button large and thumb-accessible.

### 9.3 Player Lobby

- Large text.
- Room code centered.
- Minimal visual clutter.

### 9.4 Player Controls

- Two huge buttons:
  - Left: 40–50% width.
  - Right: 40–50% width.
- Buttons should visually respond to presses.
- Avoid accidental scroll via `touch-action: none`.

### 9.5 Host Screen on Mobile

- Host UI should be functional but not optimized.
- Warning message displayed about performance.

### 9.6 Reconnect UX

- Must fit on mobile without modals.
- Large loading spinners.

---

## 10. Code Organization Requirements

### 10.1 Repository Structure

Recommended root structure:

```shell
project-root/
│
├── backend/
│
├── frontend/
```
