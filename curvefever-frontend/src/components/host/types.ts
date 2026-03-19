import type { GameMode } from "../../types";

export type GameConfig = {
    width: number;
    height: number;
};

export type GameOverLeaderboardEntry = {
    id: string;
    name: string;
    score: number;
    color?: string;
};

export type GameOverPayload = {
    winnerId: string | null;
    gameMode?: GameMode;
    targetScore?: number;
    leaderboard: GameOverLeaderboardEntry[];
};
