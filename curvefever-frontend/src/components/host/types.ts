import type { GameMode, LeaderboardEntry } from "../../types";

export type GameConfig = {
    width: number;
    height: number;
};

export type GameOverLeaderboardEntry = LeaderboardEntry;

export type GameOverPayload = {
    winnerId: string | null;
    gameMode?: GameMode;
    targetScore?: number;
    teamCount?: number;
    leaderboard: GameOverLeaderboardEntry[];
};
