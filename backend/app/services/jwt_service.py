import jwt
import uuid
import time
from typing import Optional, Dict, Any
from app.config.config import SECRET_KEY

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

    def create_user_token(self, room_code: str, user_role: str, user_id: str) -> Dict[str, str]:

        payload = self._base_payload(
            room_code=room_code,
            user_role=user_role,
            user_id=user_id,
        )
        token = self._encode(payload)
        return {
            "token": token,
            "room_code": room_code,
            "user_role": user_role,
            "user_id": user_id,
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

    def _base_payload(self, room_code: str, user_role: str, user_id: str) -> Dict[str, Any]:
        return {
            "user_role": user_role,
            "room_code": room_code,
            "user_id": user_id,
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
