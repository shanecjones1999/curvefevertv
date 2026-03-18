import { Room, Player } from "./types";

const rooms = new Map<string, Room>();
const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateRoomCode() {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code +=
            ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
}

export function createRoom(hostSocketId: string) {
    let code = generateRoomCode();
    let tries = 0;
    while (rooms.has(code) && tries < 5) {
        code = generateRoomCode();
        tries++;
    }

    const room: Room = {
        code,
        hostSocketId,
        players: new Map<string, Player>(),
        state: "lobby",
        targetScore: undefined,
        gameMode: "classic",
        battleRoyaleEliminatedPlayerIds: new Set<string>(),
        game: null,
    };
    rooms.set(code, room);
    return room;
}

export function getRoom(code: string) {
    return rooms.get(code) || null;
}

export function joinRoom(code: string, player: Player) {
    const room = rooms.get(code);
    if (!room) return null;
    room.players.set(player.id, player);
    return room;
}

export function leaveRoom(code: string, playerId: string) {
    const room = rooms.get(code);
    if (!room) return null;
    room.players.delete(playerId);
    return room;
}

// remove an entire room -- used when a host explicitly leaves
export function deleteRoom(code: string) {
    return rooms.delete(code);
}

export function listRooms() {
    return Array.from(rooms.values());
}
