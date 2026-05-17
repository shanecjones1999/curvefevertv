export interface TrailPoint {
    x: number;
    y: number;
}

export type Trail = TrailPoint[][];

export interface Player {
    id: string;
    name: string;
    score: number;
    socketId: string | null;
    color?: string;
    teamId?: number;
    alive: boolean;
    x: number;
    y: number;
    direction: number; // radians
    speed?: number;
    // Server-side trail: array of segments, each segment is an array of points
    trail?: Trail;
    // For gap logic
    distanceSinceLastGap?: number;
    gapInterval?: number;
    gapLength?: number;
    inGap?: boolean;
    gapStartDistance?: number;
}

export type GameMode = "classic" | "battle-royale" | "teams";

export type RoomState = "lobby" | "playing" | "finished";

export interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
    color?: string;
    alive?: boolean;
    socketId?: string | null;
    teamId?: number;
    playerCount?: number;
    kind?: "player" | "team";
}

export interface Room {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>;
    state: RoomState;
    game?: GameState | null;
}

export interface TrailSegmentUpdate {
    index: number;
    points: TrailPoint[];
}

export interface TrailUpdate {
    reset?: boolean;
    segments?: TrailSegmentUpdate[];
}

export interface GameStatePlayer extends Omit<Player, "trail"> {
    trail?: Trail;
    trailUpdate?: TrailUpdate;
}

export interface ServerLoopDiagnostics {
    intervalMs: number;
    jitterMs: number;
    sampleCount: number;
}

export interface GameState {
    tick: number;
    arena: {
        width: number;
        height: number;
    };
    players: GameStatePlayer[];
    isDelta?: boolean;
    removedPlayerIds?: string[];
    gameMode: GameMode;
    targetScore?: number;
    teamCount?: number;
    roundStartRemainingMs?: number;
    serverLoopDiagnostics?: ServerLoopDiagnostics;
}

export interface ControllerPlayer {
    id: string;
    name: string;
    score: number;
    socketId: string | null;
    color?: string;
    teamId?: number;
    alive: boolean;
}

export interface ControllerState {
    players: ControllerPlayer[];
    gameMode: GameMode;
    teamCount?: number;
    state: RoomState;
}

export interface ServerLagDiagnostics {
    updateIntervalMs: number;
    updateRateHz: number;
    jitterMs: number;
    tickDelta: number;
    serverLoopIntervalMs?: number;
    serverLoopJitterMs?: number;
    serverLoopSampleCount?: number;
    payloadPlayers: number;
    trailPointsPerUpdate: number;
    sampleCount: number;
}

export interface ClientLagDiagnostics {
    frameTimeMs: number;
    fps: number;
    slowFramePercent: number;
    sampleCount: number;
}

export interface InputPayload {
    turnLeft: boolean;
    turnRight: boolean;
    playerId?: string;
}
