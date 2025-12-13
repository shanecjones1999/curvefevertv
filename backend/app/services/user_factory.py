from app.services.jwt_service import JwtService
from app.models.host import Host
import uuid

class UserFactory:
    def __init__(self):
        self.jwt_service = JwtService()

    def create_host(self, room_code: str) -> Host:
        host_id = str(uuid.uuid4())
        host = Host(uuid=host_id, room_code=room_code)
        return host