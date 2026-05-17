import { PLAYER_COLORS } from "../constants/gameUi";
import type { Player } from "../types";

type PlayerColorSource = Pick<Player, "id" | "color">;

export function isValidHexColor(color: string | undefined | null) {
    return typeof color === "string" && /^#(?:[0-9a-f]{3}){1,2}$/i.test(color);
}

export function getFallbackPlayerColor(index: number) {
    return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export function resolvePlayerColor(
    player: Pick<Player, "color">,
    index: number,
): string {
    return isValidHexColor(player.color)
        ? player.color ?? getFallbackPlayerColor(index)
        : getFallbackPlayerColor(index);
}

export function buildPlayerColorById(players: PlayerColorSource[]) {
    const colorById = new Map<string, string>();

    players.forEach((player, index) => {
        colorById.set(player.id, resolvePlayerColor(player, index));
    });

    return colorById;
}
