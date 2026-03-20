export const EVENTS = {
    // Client -> Server
    INPUT: "input",
    CREATE_ROOM: "createRoom",
    JOIN_ROOM: "joinRoom",
    START_GAME: "startGame",
    SET_GAME_MODE: "setGameMode",
    SET_POWER_UPS_ENABLED: "setPowerUpsEnabled",
    LEAVE_ROOM: "leaveRoom",

    // Server -> Client
    ROOM_CREATED: "roomCreated",
    PLAYER_JOINED: "playerJoined",
    LOBBY_UPDATE: "lobbyUpdate",
    GAME_STATE: "gameState",
    PLAYER_DIED: "playerDied",
    ROUND_OVER: "roundOver",
    GAME_OVER: "gameOver",
    ROOM_CLOSED: "roomClosed",
    ROUND_RESTART: "roundRestart",
} as const;
