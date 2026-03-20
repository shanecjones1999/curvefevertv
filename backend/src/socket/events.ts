import { Server, Socket } from "socket.io";
import { GameMode, GameState, InputPayload, Player, RoomState } from "../types";

interface GameConfigPayload {
    width: number;
    height: number;
}

interface ScoreboardEntry {
    id: string;
    name: string;
    score: number;
    color?: string;
}

interface RoundLeaderboardEntry {
    id: string;
    name: string;
    score: number;
}

export type SocketErrorCode =
    | "ROOM_CODE_INVALID"
    | "ROOM_NOT_FOUND"
    | "NAME_REQUIRED"
    | "REJOIN_PAYLOAD_INVALID"
    | "PLAYER_NOT_FOUND_IN_ROOM"
    | "LEAVE_ROOM_FAILED";

export interface LobbyStatePayload {
    players: Player[];
    gameMode: GameMode;
    targetScore?: number;
    gameConfig: GameConfigPayload;
}

export interface ClientToServerEvents {
    createRoom: (
        data: unknown,
        cb?: (response: {
            roomCode: string;
            gameConfig: GameConfigPayload;
        }) => void,
    ) => void;
    reconnectHost: (
        data: { roomCode: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            errorCode?: SocketErrorCode;
            roomCode?: string;
            players?: Player[];
            state?: RoomState;
            gameMode?: GameMode;
            targetScore?: number;
            gameConfig?: GameConfigPayload;
        }) => void,
    ) => void;
    joinRoom: (
        data: { roomCode: string; name: string; playerId?: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            errorCode?: SocketErrorCode;
            player?: Player;
        }) => void,
    ) => void;
    rejoinRoom: (
        data: { roomCode: string; playerId: string; name?: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            errorCode?: SocketErrorCode;
            player?: Player;
            state?: RoomState;
        }) => void,
    ) => void;
    requestLobbyState: (
        data: { roomCode: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            errorCode?: SocketErrorCode;
            players?: Player[];
            state?: RoomState;
            gameMode?: GameMode;
            targetScore?: number;
            gameConfig?: GameConfigPayload;
        }) => void,
    ) => void;
    input: (payload: InputPayload) => void;
    setGameMode: (
        data: { roomCode: string; gameMode?: GameMode },
        cb?: (response: {
            ok: boolean;
            error?: string;
            gameMode?: GameMode;
        }) => void,
    ) => void;
    startGame: (
        data: { roomCode: string; gameMode?: GameMode },
        cb?: (response: {
            ok: boolean;
            error?: string;
            gameMode?: GameMode;
            targetScore?: number;
            gameConfig?: GameConfigPayload;
        }) => void,
    ) => void;
    leaveRoom: (
        data: { roomCode: string; playerId?: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            errorCode?: SocketErrorCode;
        }) => void,
    ) => void;
}

export interface ServerToClientEvents {
    lobbyUpdate: (payload: LobbyStatePayload) => void;
    playerJoined: (payload: { player: Player }) => void;
    startGame: (payload: {
        gameMode: GameMode;
        targetScore?: number;
        gameConfig: GameConfigPayload;
    }) => void;
    gameState: (payload: GameState) => void;
    roundOver: (payload: {
        winnerId: string | null;
        gameMode?: GameMode;
        eliminatedPlayerIds?: string[];
        leaderboard?: RoundLeaderboardEntry[];
    }) => void;
    roundRestart: () => void;
    gameOver: (payload: {
        winnerId: string | null;
        gameMode: GameMode;
        targetScore?: number;
        leaderboard: ScoreboardEntry[];
    }) => void;
    roomClosed: () => void;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
