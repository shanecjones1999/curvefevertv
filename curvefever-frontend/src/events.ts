export const EVENTS = {
    // Client -> Server
    INPUT: "input",
    CREATE_ROOM: "createRoom",
    JOIN_ROOM: "joinRoom",
    REQUEST_LOBBY_STATE: "requestLobbyState",
    START_GAME: "startGame",
    SET_GAME_MODE: "setGameMode",
    SWITCH_TEAM: "switchTeam",
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
