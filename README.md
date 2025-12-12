# CurveFever Party Game

A real-time, browser-based multiplayer game inspired by CurveFever. Play locally with friends - one person hosts on TV/desktop while others join with their phones as controllers!

## Features

- Real-time multiplayer gameplay with WebSocket communication
- Mobile-first player controls with large touch targets
- Host view displays game on TV/desktop
- Simple 4-letter room codes for easy joining
- Reconnection support for dropped connections
- Score tracking across multiple rounds

## Tech Stack

- **Backend**: FastAPI with WebSocket support
- **Frontend**: React with Vite
- **Database**: Supabase (PostgreSQL)
- **Real-time**: WebSocket communication at 30 FPS

## Project Structure

```
project-root/
├── backend/          # FastAPI WebSocket server
│   ├── main.py       # Main application & WebSocket handlers
│   ├── game_engine.py # Game logic & collision detection
│   ├── auth.py       # JWT authentication
│   ├── models.py     # Data models
│   └── config.py     # Configuration
│
├── frontend/         # React SPA
│   └── src/
│       ├── pages/    # Route components
│       ├── hooks/    # WebSocket hook
│       └── App.jsx   # Main app with routing
```

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables in `.env`:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   JWT_SECRET=your_secret_key
   ```

4. Run the server:
   ```bash
   python main.py
   ```

   Server will start on `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

   Frontend will start on `http://localhost:3000`

## How to Play

### For Host:

1. Open the game on your TV/desktop browser
2. Click "Create Game (Host)"
3. Share the 4-letter room code with players
4. Wait for players to join
5. Click "Start Game" when everyone is ready
6. Watch the game unfold on the big screen!

### For Players:

1. Open the game on your phone browser
2. Click "Join Game (Player)"
3. Enter your name and the room code
4. Wait in the lobby for the host to start
5. Use the LEFT and RIGHT buttons to control your curve
6. Avoid walls and trails - be the last one alive!

## Game Rules

- All players move forward automatically at constant speed
- Players leave a solid trail behind them
- Collision with walls, your own trail, or other trails = death
- Last surviving player wins the round and earns a point
- Host can restart after each round

## Development

### Backend

The backend uses FastAPI with WebSocket support for real-time communication. The game loop runs at 30 FPS, broadcasting state updates to all connected clients.

Key files:
- `main.py`: WebSocket endpoints and room management
- `game_engine.py`: Core game logic, collision detection
- `auth.py`: JWT-based session management

### Frontend

The frontend is a React SPA with mobile-first design. Players get a full-screen control interface, while hosts see the game canvas.

Key features:
- Mobile-optimized controls with large touch targets
- WebSocket reconnection logic
- Responsive design for all screen sizes

## Browser Support

- Modern browsers with WebSocket support
- Mobile browsers (iOS Safari, Chrome, Firefox)
- Desktop browsers (Chrome, Firefox, Safari, Edge)

## License

MIT
