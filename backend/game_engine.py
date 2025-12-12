import math
import random
from typing import List, Dict, Tuple, Optional
import config

class Player:
    def __init__(self, player_id: str, name: str, color: str, x: float, y: float, angle: float):
        self.player_id = player_id
        self.name = name
        self.color = color
        self.x = x
        self.y = y
        self.angle = angle
        self.is_alive = True
        self.score = 0
        self.trail: List[Tuple[float, float]] = []
        self.turn_direction = 0

    def update(self):
        if not self.is_alive:
            return

        self.angle += self.turn_direction * config.PLAYER_TURN_SPEED

        new_x = self.x + math.cos(self.angle) * config.PLAYER_SPEED
        new_y = self.y + math.sin(self.angle) * config.PLAYER_SPEED

        self.trail.append((self.x, self.y))
        self.x = new_x
        self.y = new_y

    def set_turn_direction(self, direction: int):
        self.turn_direction = direction

    def to_dict(self):
        return {
            "player_id": self.player_id,
            "name": self.name,
            "color": self.color,
            "x": self.x,
            "y": self.y,
            "angle": self.angle,
            "is_alive": self.is_alive,
            "score": self.score
        }

class GameEngine:
    def __init__(self, room_code: str):
        self.room_code = room_code
        self.players: Dict[str, Player] = {}
        self.is_running = False
        self.winner: Optional[str] = None

    def add_player(self, player_id: str, name: str, score: int = 0):
        colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F"]
        used_colors = [p.color for p in self.players.values()]
        available_colors = [c for c in colors if c not in used_colors]
        color = random.choice(available_colors) if available_colors else random.choice(colors)

        angle = random.uniform(0, 2 * math.pi)
        margin = 50
        x = random.uniform(margin, config.GAME_WIDTH - margin)
        y = random.uniform(margin, config.GAME_HEIGHT - margin)

        player = Player(player_id, name, color, x, y, angle)
        player.score = score
        self.players[player_id] = player

    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]

    def start_game(self):
        self.is_running = True
        self.winner = None
        for player in self.players.values():
            player.is_alive = True
            player.trail = []
            angle = random.uniform(0, 2 * math.pi)
            margin = 50
            player.x = random.uniform(margin, config.GAME_WIDTH - margin)
            player.y = random.uniform(margin, config.GAME_HEIGHT - margin)
            player.angle = angle

    def update(self):
        if not self.is_running:
            return

        for player in self.players.values():
            if player.is_alive:
                player.update()
                self.check_collisions(player)

        alive_players = [p for p in self.players.values() if p.is_alive]
        if len(alive_players) <= 1:
            self.is_running = False
            if len(alive_players) == 1:
                winner = alive_players[0]
                winner.score += 1
                self.winner = winner.player_id

    def check_collisions(self, player: Player):
        if player.x < 0 or player.x > config.GAME_WIDTH or player.y < 0 or player.y > config.GAME_HEIGHT:
            player.is_alive = False
            return

        for other_player in self.players.values():
            if len(other_player.trail) < 2:
                continue

            for i in range(len(other_player.trail) - 1):
                x1, y1 = other_player.trail[i]
                x2, y2 = other_player.trail[i + 1]

                if other_player.player_id == player.player_id and i >= len(other_player.trail) - 5:
                    continue

                dist = self.point_to_line_distance(player.x, player.y, x1, y1, x2, y2)
                if dist < config.PLAYER_RADIUS + config.TRAIL_WIDTH / 2:
                    player.is_alive = False
                    return

    def point_to_line_distance(self, px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
        dx = x2 - x1
        dy = y2 - y1

        if dx == 0 and dy == 0:
            return math.sqrt((px - x1) ** 2 + (py - y1) ** 2)

        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))

        proj_x = x1 + t * dx
        proj_y = y1 + t * dy

        return math.sqrt((px - proj_x) ** 2 + (py - proj_y) ** 2)

    def set_player_direction(self, player_id: str, direction: int):
        if player_id in self.players:
            self.players[player_id].set_turn_direction(direction)

    def get_state(self) -> dict:
        return {
            "room_code": self.room_code,
            "is_running": self.is_running,
            "players": [p.to_dict() for p in self.players.values()],
            "trails": [[point for point in p.trail] for p in self.players.values()],
            "winner": self.winner
        }
