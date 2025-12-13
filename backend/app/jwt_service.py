import jwt
import uuid
import time
from typing import Optional, Dict, Any
from config import SECRET_KEY

class JwtService:
    def __init__(
        self,
        secret_key: str = SECRET_KEY,
        algorithm: str = "HS256",
    ):
        self.secret_key = secret_key
        self.algorithm = algorithm

    # --------------------
    # Public API
    # --------------------

    def create_host_token(self, room_code: str) -> Dict[str, str]:
        host_id = str(uuid.uuid4())

        payload = self._base_payload(
            room_code=room_code,
            user_role="host",
        )
        payload["host_id"] = host_id

        token = self._encode(payload)
        return {
            "token": token,
            "host_id": host_id,
        }

    def create_player_token(
        self,
        room_code: str,
        name: str,
        player_id: Optional[str] = None,
    ) -> Dict[str, str]:
        player_id = player_id or str(uuid.uuid4())

        payload = self._base_payload(
            room_code=room_code,
            user_role="player",
        )
        payload.update({
            "player_id": player_id,
            "name": name,
        })

        token = self._encode(payload)
        return {
            "token": token,
            "player_id": player_id,
        }

    def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Decodes and validates the token signature.
        Raises jwt.InvalidTokenError on failure.
        """
        payload = jwt.decode(
            token,
            self.secret_key,
            algorithms=[self.algorithm],
        )

        self._validate_payload(payload)
        return payload

    # --------------------
    # Internal Helpers
    # --------------------

    def _base_payload(self, room_code: str, user_role: str) -> Dict[str, Any]:
        return {
            "sub": "curvefever",
            "user_role": user_role,
            "room_code": room_code,
            "iat": int(time.time()),
        }

    def _encode(self, payload: Dict[str, Any]) -> str:
        return jwt.encode(
            payload,
            self.secret_key,
            algorithm=self.algorithm,
        )

    def _validate_payload(self, payload: Dict[str, Any]) -> None:
        required_fields = {"sub", "user_role", "room_code", "iat"}

        if not required_fields.issubset(payload.keys()):
            raise jwt.InvalidTokenError("Missing required JWT fields")

        if payload["sub"] != "curvefever":
            raise jwt.InvalidTokenError("Invalid token subject")

        if payload["user_role"] not in {"host", "player"}:
            raise jwt.InvalidTokenError("Invalid user type")
