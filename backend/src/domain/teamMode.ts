import { LeaderboardEntry, Player } from "../types";

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 5;
export const DEFAULT_TEAM_COUNT = 2;
const TEAM_COLORS = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231"];

export function sanitizeTeamCount(
    value: unknown,
    fallback = DEFAULT_TEAM_COUNT,
) {
    const numericValue =
        typeof value === "number" ? value : Number.parseInt(String(value), 10);

    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.floor(numericValue)));
}

export function getTeamLabel(teamId: number) {
    return `Team ${teamId}`;
}

export function getTeamColor(teamId: number) {
    return TEAM_COLORS[(teamId - 1 + TEAM_COLORS.length) % TEAM_COLORS.length];
}

function countPlayersByTeam(players: Player[], teamCount: number) {
    const counts = new Map<number, number>();

    for (let teamId = 1; teamId <= teamCount; teamId++) {
        counts.set(teamId, 0);
    }

    for (const player of players) {
        if (
            typeof player.teamId === "number" &&
            player.teamId >= 1 &&
            player.teamId <= teamCount
        ) {
            counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
        }
    }

    return counts;
}

export function chooseBalancedTeam(players: Player[], teamCount: number) {
    const counts = countPlayersByTeam(players, teamCount);
    let selectedTeamId = 1;
    let selectedTeamSize = Number.POSITIVE_INFINITY;

    for (let teamId = 1; teamId <= teamCount; teamId++) {
        const teamSize = counts.get(teamId) ?? 0;
        if (teamSize < selectedTeamSize) {
            selectedTeamId = teamId;
            selectedTeamSize = teamSize;
        }
    }

    return selectedTeamId;
}

export function rebalancePlayersForTeamMode(
    players: Player[],
    teamCount: number,
    options?: { preserveExisting?: boolean },
) {
    const sanitizedTeamCount = sanitizeTeamCount(teamCount);
    const preserveExisting = Boolean(options?.preserveExisting);

    const stablePlayers = [...players];
    const assignedPlayers: Player[] = [];
    const playersToAssign: Player[] = [];

    for (const player of stablePlayers) {
        const hasValidTeam =
            typeof player.teamId === "number" &&
            player.teamId >= 1 &&
            player.teamId <= sanitizedTeamCount;

        if (preserveExisting && hasValidTeam) {
            assignedPlayers.push(player);
            continue;
        }

        if (!preserveExisting && hasValidTeam) {
            player.teamId = undefined;
        }

        playersToAssign.push(player);
    }

    for (const player of playersToAssign) {
        const nextTeamId = chooseBalancedTeam(assignedPlayers, sanitizedTeamCount);
        player.teamId = nextTeamId;
        assignedPlayers.push(player);
    }
}

export function getActiveTeamIds(players: Player[]) {
    return Array.from(
        new Set(
            players
                .map((player) => player.teamId)
                .filter((teamId): teamId is number => typeof teamId === "number"),
        ),
    ).sort((firstTeamId, secondTeamId) => firstTeamId - secondTeamId);
}

export function getAliveTeamIds(players: Player[]) {
    return Array.from(
        new Set(
            players
                .filter((player) => player.alive)
                .map((player) => player.teamId)
                .filter((teamId): teamId is number => typeof teamId === "number"),
        ),
    ).sort((firstTeamId, secondTeamId) => firstTeamId - secondTeamId);
}

export function buildTeamLeaderboard(players: Player[]): LeaderboardEntry[] {
    const playersByTeamId = new Map<number, Player[]>();

    for (const player of players) {
        if (typeof player.teamId !== "number") {
            continue;
        }

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

            return firstTeam.teamId - secondTeam.teamId;
        });
}
