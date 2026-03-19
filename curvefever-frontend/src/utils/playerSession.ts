import { PLAYER_SESSION_KEY } from "../constants/storage";
import { isValidRoomCode, sanitizeRoomCodeInput } from "./roomCode";

export type PlayerSession = {
    roomCode: string;
    name: string;
    playerId: string;
};

export function getStoredPlayerSession(): PlayerSession | null {
    const raw = localStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<PlayerSession>;
        if (!parsed.roomCode || !parsed.name || !parsed.playerId) return null;

        const normalizedRoomCode = sanitizeRoomCodeInput(parsed.roomCode);
        if (!isValidRoomCode(normalizedRoomCode)) return null;

        return {
            roomCode: normalizedRoomCode,
            name: parsed.name,
            playerId: parsed.playerId,
        };
    } catch {
        return null;
    }
}
