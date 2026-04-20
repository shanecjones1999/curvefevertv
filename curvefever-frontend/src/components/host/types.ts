import type { GameMode, LeaderboardEntry, Player } from "../../types";

export type GameConfig = {
    width: number;
    height: number;
};

export type GameOverLeaderboardEntry = LeaderboardEntry;
export type RoundOverLeaderboardEntry = LeaderboardEntry;

export type GameOverPayload = {
    winnerId: string | null;
    gameMode?: GameMode;
    targetScore?: number;
    teamCount?: number;
    leaderboard: GameOverLeaderboardEntry[];
};

export type RoundOverPayload = {
    winnerId: string | null;
    gameMode?: GameMode;
    eliminatedPlayerIds?: string[];
    leaderboard?: RoundOverLeaderboardEntry[];
    frozenPlayers?: Player[];
    scoreBeforeById?: Record<string, number>;
};
