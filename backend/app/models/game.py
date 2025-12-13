from app.models.host import Host
from app.models.player import Player

class Game:
    def __init__(self, room_code: str, host: Host):
        self.room_code = room_code
        self.host = host
        self.players: dict[str, Player] = {}  # List to hold player instances

    def add_player(self, player: Player):
        if player.uuid in self.players:
            raise ValueError("Player with this UUID already exists in the game.")
        self.players[player.uuid] = player