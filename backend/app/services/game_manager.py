from app.services.user_factory import UserFactory
from app.models.game import Game
from app.models.host import Host

class GameManager:
    def __init__(self):
        self.user_factory = UserFactory()
        self.games: dict[str, Game] = {}  # key: room_code, value: Game instance

    def _create_host(self, room_code: str):
        return self.user_factory.create_host(room_code=room_code)

    def create_game(self, room_code: str) -> Game:
        host = self._create_host(room_code=room_code)
        if room_code in self.games:
            raise ValueError("Game with this room code already exists.")

        game = Game(
            room_code=room_code,
            host=host)
        
        self.games[room_code] = game
        return game
    
    def create_player(self, room_code: str, name: str):
        if name.strip() == "":
            raise ValueError("Player name cannot be empty.")
        if room_code not in self.games:
            raise ValueError("Game with this room code does not exist.")
        player = self.user_factory.create_player(room_code=room_code, name=name)
        game = self.games[room_code]
        game.add_player(player)
        return player
    
    def game_exists(self, room_code: str) -> bool:
        return room_code in self.games