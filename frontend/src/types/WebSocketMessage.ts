export type WebSocketMessage =
    | { type: "auth"; token: string }
    | { type: "move"; direction: "left" | "right" }
    | { type: "player_joined"; name: string }
    | { type: "player_left"; name: string }
    | { type: "join_room"; name: string };
//   | { type: "game_state"; players: any[] };
