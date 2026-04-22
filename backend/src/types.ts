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
    isFloating?: boolean;
    turnLeftHeld?: boolean;
    turnRightHeld?: boolean;
}

export type GameMode = "classic" | "battle-royale" | "teams";

export type RoomState = "lobby" | "playing" | "finished";

export interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
    color?: string;
    alive?: boolean;
    teamId?: number;
    playerCount?: number;
    kind?: "player" | "team";
}

export interface Room {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>;
    state: RoomState;
    targetScore?: number;
    gameMode: GameMode;
    teamCount: number;
    battleRoyaleEliminatedPlayerIds?: Set<string>;
    roundStartScoreById?: Record<string, number>;
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
}

export interface InputPayload {
    turnLeft: boolean;
    turnRight: boolean;
    playerId?: string;
}
