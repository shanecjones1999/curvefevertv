from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional
import config

def create_token(user_type: str, room_code: str, player_id: Optional[str] = None) -> str:
    payload = {
        "user_type": user_type,
        "room_code": room_code,
        "player_id": player_id,
        "exp": datetime.utcnow() + timedelta(hours=config.JWT_EXPIRATION_HOURS)
    }
    token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)
    return token

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
