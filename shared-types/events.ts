export const EVENTS = {
    // Client -> Server
    INPUT: "input",
    CREATE_ROOM: "createRoom",
    JOIN_ROOM: "joinRoom",
    START_GAME: "startGame",

    // Server -> Client
    ROOM_CREATED: "roomCreated",
    PLAYER_JOINED: "playerJoined",
    LOBBY_UPDATE: "lobbyUpdate",
    GAME_STATE: "gameState",
    PLAYER_DIED: "playerDied",
    ROUND_OVER: "roundOver",
} as const;
