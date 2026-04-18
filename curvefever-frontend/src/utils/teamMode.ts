import type { LeaderboardEntry, Player } from "../types";

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 5;
export const DEFAULT_TEAM_COUNT = 2;
const TEAM_COLORS = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231"];
const TEAM_SYMBOLS = ["▲", "■", "◆", "★", "●"];

export function getTeamLabel(teamId: number) {
    return `Team ${teamId}`;
}

export function getTeamSymbol(teamId: number) {
    return TEAM_SYMBOLS[(teamId - 1 + TEAM_SYMBOLS.length) % TEAM_SYMBOLS.length];
}

export function getTeamColor(teamId: number) {
    return TEAM_COLORS[(teamId - 1 + TEAM_COLORS.length) % TEAM_COLORS.length];
}

export function buildTeamLeaderboard(players: Player[]): LeaderboardEntry[] {
    const playersByTeamId = new Map<number, Player[]>();

    for (const player of players) {
        if (typeof player.teamId !== "number") continue;
        const teamPlayers = playersByTeamId.get(player.teamId) ?? [];
        teamPlayers.push(player);
        playersByTeamId.set(player.teamId, teamPlayers);
    }

    return Array.from(playersByTeamId.entries())
        .map(([teamId, teamPlayers]) => ({
            id: `team-${teamId}`,
            name: getTeamLabel(teamId),
            score: Math.max(...teamPlayers.map((player) => player.score ?? 0), 0),
            color: getTeamColor(teamId),
            alive: teamPlayers.some((player) => player.alive),
            teamId,
            playerCount: teamPlayers.length,
            kind: "team" as const,
        }))
        .sort((firstTeam, secondTeam) => {
            if (secondTeam.score !== firstTeam.score) {
                return secondTeam.score - firstTeam.score;
            }
            if (Number(secondTeam.alive) !== Number(firstTeam.alive)) {
                return Number(secondTeam.alive) - Number(firstTeam.alive);
            }
            return (firstTeam.teamId ?? 0) - (secondTeam.teamId ?? 0);
        });
}

export function getActiveTeamCount(players: Player[]) {
    return buildTeamLeaderboard(players).length;
}
