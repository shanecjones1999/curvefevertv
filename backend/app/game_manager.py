class GameManager:
    def __init__(self):
        self.games = {}  # key: room_code, value: Game instance

    def create_game(self, room_code: str, host: bool):
        if room_code in self.games:
            raise ValueError("Game with this room code already exists.")
        game = []
        self.games[room_code] = game
        return game