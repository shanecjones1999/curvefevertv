import { LeaderboardEntry, Player } from "../types";

export function buildBattleRoyaleLeaderboard(
    players: Player[],
    eliminatedPlayerIds?: Iterable<string>,
): LeaderboardEntry[] {
    const eliminationOrder = Array.from(eliminatedPlayerIds ?? []);
    const eliminationIndexByPlayerId = new Map(
        eliminationOrder.map((playerId, index) => [playerId, index]),
    );

    return players
        .map((player) => ({
            id: player.id,
            name: player.name,
            score: eliminationIndexByPlayerId.has(player.id) ? 0 : 1,
            color: player.color,
            alive: !eliminationIndexByPlayerId.has(player.id),
            kind: "player" as const,
        }))
        .sort((firstPlayer, secondPlayer) => {
            const firstEliminationIndex = eliminationIndexByPlayerId.get(
                firstPlayer.id,
            );
            const secondEliminationIndex = eliminationIndexByPlayerId.get(
                secondPlayer.id,
            );
            const firstSurvived = firstEliminationIndex === undefined;
            const secondSurvived = secondEliminationIndex === undefined;

            if (firstSurvived !== secondSurvived) {
                return Number(secondSurvived) - Number(firstSurvived);
            }

            if (
                firstEliminationIndex !== undefined &&
                secondEliminationIndex !== undefined &&
                firstEliminationIndex !== secondEliminationIndex
            ) {
                return secondEliminationIndex - firstEliminationIndex;
            }

            return firstPlayer.name.localeCompare(secondPlayer.name);
        });
}

export function buildClassicLeaderboard(players: Player[]): LeaderboardEntry[] {
    return players
        .map((player) => ({
            id: player.id,
            name: player.name,
            score: player.score ?? 0,
            color: player.color,
            alive: player.alive,
            kind: "player" as const,
        }))
        .sort((firstPlayer, secondPlayer) => {
            if (secondPlayer.score !== firstPlayer.score) {
                return secondPlayer.score - firstPlayer.score;
            }

            return firstPlayer.name.localeCompare(secondPlayer.name);
        });
}
