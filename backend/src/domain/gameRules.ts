import { GameMode } from "../types";

export const ROOM_CODE_REGEX = /^[A-Z]{4}$/;

export function calculateTargetScore(playerCount: number) {
    return Math.max(10, playerCount * 10 - 10);
}

export function sanitizeGameMode(value: unknown): GameMode {
    if (value === "battle-royale") {
        return "battle-royale";
    }
    return "classic";
}

export function normalizeRoomCode(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const roomCode = value.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(roomCode)) return null;
    return roomCode;
}
