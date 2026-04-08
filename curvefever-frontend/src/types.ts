export interface Player {
    id: string;
    name: string;
    score: number;
    socketId: string | null;
    color?: string;
    alive: boolean;
    x: number;
    y: number;
    direction: number; // radians
    speed?: number;
    // Server-side trail: array of segments, each segment is an array of points
    trail?: Array<Array<{ x: number; y: number }>>;
    // For gap logic
    distanceSinceLastGap?: number;
    gapInterval?: number;
    gapLength?: number;
    inGap?: boolean;
    gapStartDistance?: number;
}

export type PowerUpType = "speed-up" | "slow-down";

export interface PowerUp {
    id: string;
    type: PowerUpType;
    x: number;
    y: number;
}

export type GameMode = "classic" | "battle-royale";

export type RoomState = "lobby" | "playing" | "finished";

export interface Room {
    code: string;
    hostSocketId: string;
    players: Map<string, Player>;
    state: RoomState;
    game?: GameState | null;
}

export interface GameState {
    tick: number;
    arena: {
        width: number;
        height: number;
    };
    players: Player[];
    powerUps?: PowerUp[];
    gameMode: GameMode;
    targetScore?: number;
    powerUpsEnabled?: boolean;
}

export interface InputPayload {
    turnLeft: boolean;
    turnRight: boolean;
    playerId?: string;
}
