import { Server, Socket } from "socket.io";
import {
    ControllerState,
    GameMode,
    GameState,
    HostMotionState,
    InputPayload,
    LeaderboardEntry,
    Player,
    RoomState,
} from "../types";

interface GameConfigPayload {
    width: number;
    height: number;
}

export interface LobbyStatePayload {
    players: Player[];
    gameMode: GameMode;
    targetScore?: number;
    teamCount?: number;
    gameConfig: GameConfigPayload;
}

export interface ClientToServerEvents {
    createRoom: (
        data: { gameMode?: GameMode; teamCount?: number } | null,
        cb?: (response: {
            roomCode: string;
            gameMode: GameMode;
            teamCount: number;
            gameConfig: GameConfigPayload;
        }) => void,
    ) => void;
    reconnectHost: (
        data: { roomCode: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            roomCode?: string;
            players?: Player[];
            state?: RoomState;
            gameMode?: GameMode;
            winnerId?: string | null;
            leaderboard?: LeaderboardEntry[];
            roundOver?: {
                winnerId: string | null;
                gameMode?: GameMode;
                eliminatedPlayerIds?: string[];
                leaderboard?: LeaderboardEntry[];
                scoreBeforeById?: Record<string, number>;
            };
            targetScore?: number;
            teamCount?: number;
            gameConfig?: GameConfigPayload;
        }) => void,
    ) => void;
    joinRoom: (
        data: { roomCode: string; name: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            player?: Player;
        }) => void,
    ) => void;
    rejoinRoom: (
        data: { roomCode: string; playerId: string; name?: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            player?: Player;
            state?: RoomState;
        }) => void,
    ) => void;
    requestLobbyState: (
        data: { roomCode: string },
        cb?: (response: {
            ok: boolean;
            error?: string;
            players?: Player[];
            state?: RoomState;
            gameMode?: GameMode;
            targetScore?: number;
            teamCount?: number;
            gameConfig?: GameConfigPayload;
        }) => void,
    ) => void;
    input: (payload: InputPayload) => void;
    setGameMode: (
        data: { roomCode: string; gameMode?: GameMode; teamCount?: number },
        cb?: (response: {
            ok: boolean;
            error?: string;
            gameMode?: GameMode;
            teamCount?: number;
        }) => void,
    ) => void;
    startGame: (
        data: { roomCode: string; gameMode?: GameMode; teamCount?: number },
        cb?: (response: {
            ok: boolean;
            error?: string;
            gameMode?: GameMode;
            targetScore?: number;
            teamCount?: number;
            gameConfig?: GameConfigPayload;
        }) => void,
    ) => void;
    switchTeam: (
        data: { roomCode: string; teamId: number },
        cb?: (response: {
            ok: boolean;
            error?: string;
            player?: Player;
            teamCount?: number;
        }) => void,
    ) => void;
    leaveRoom: (
        data: { roomCode: string; playerId?: string },
        cb?: (response: { ok: boolean; error?: string }) => void,
    ) => void;
}

export interface ServerToClientEvents {
    lobbyUpdate: (payload: LobbyStatePayload) => void;
    playerJoined: (payload: { player: Player }) => void;
    startGame: (payload: {
        gameMode: GameMode;
        targetScore?: number;
        teamCount?: number;
        gameConfig: GameConfigPayload;
    }) => void;
    gameState: (payload: GameState) => void;
    controllerState: (payload: ControllerState) => void;
    hostMotionState: (payload: HostMotionState) => void;
    roundOver: (payload: {
        winnerId: string | null;
        gameMode?: GameMode;
        eliminatedPlayerIds?: string[];
        leaderboard?: LeaderboardEntry[];
        scoreBeforeById?: Record<string, number>;
    }) => void;
    roundRestart: () => void;
    gameOver: (payload: {
        winnerId: string | null;
        gameMode: GameMode;
        targetScore?: number;
        teamCount?: number;
        leaderboard: LeaderboardEntry[];
    }) => void;
    roomClosed: () => void;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
