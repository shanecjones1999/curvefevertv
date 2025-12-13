from app.services.user_factory import UserFactory
from app.models.game import Game
from app.models.host import Host

class GameManager:
    def __init__(self):
        self.user_factory = UserFactory()
        self.games = {}  # key: room_code, value: Game instance

    def create_host(self, room_code: str):
        return self.user_factory.create_host(room_code=room_code)

    def create_game(self, room_code: str, host: Host) -> Game:
        if room_code in self.games:
            raise ValueError("Game with this room code already exists.")

        game = Game(
            room_code=room_code,
            host=host)
        
        self.games[room_code] = game
        return game