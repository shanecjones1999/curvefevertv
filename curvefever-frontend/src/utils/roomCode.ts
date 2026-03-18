export const ROOM_CODE_REGEX = /^[A-Z]{4}$/;

export function sanitizeRoomCodeInput(value: string) {
    return value
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 4);
}

export function isValidRoomCode(roomCode: string) {
    return ROOM_CODE_REGEX.test(sanitizeRoomCodeInput(roomCode));
}
