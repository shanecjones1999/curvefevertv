from app.models.host import Host

class Game:
    def __init__(self, room_code: str, host: Host):
        self.room_code = room_code
        self.host = host
        self.players = []  # List to hold player instances