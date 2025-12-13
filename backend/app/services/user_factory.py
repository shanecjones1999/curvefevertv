from app.services.jwt_service import JwtService
from app.models.host import Host
from app.models.player import Player
import uuid

class UserFactory:
    def __init__(self):
        self.jwt_service = JwtService()

    def create_host(self, room_code: str) -> Host:
        host_id = str(uuid.uuid4())
        host = Host(uuid=host_id, room_code=room_code)
        return host
    
    def create_player(self, room_code: str, name: str) -> Player:
        player_id = str(uuid.uuid4())
        player = Player(uuid=player_id, room_code=room_code, name=name)
        return player