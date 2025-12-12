import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

GAME_FPS = 30
GAME_WIDTH = 800
GAME_HEIGHT = 600
PLAYER_SPEED = 2
PLAYER_TURN_SPEED = 0.08
PLAYER_RADIUS = 3
TRAIL_WIDTH = 4
