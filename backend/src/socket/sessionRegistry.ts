import { getRoom } from "../rooms";
import { Player } from "../types";

const socketToRoomCode = new Map<string, string>();
const socketToPlayerId = new Map<string, string>();

export function bindSocketToRoom(socketId: string, roomCode: string) {
    socketToRoomCode.set(socketId, roomCode);
}

export function bindSocketToPlayer(socketId: string, playerId: string) {
    socketToPlayerId.set(socketId, playerId);
}

export function unbindSocketFromRoom(socketId: string) {
    socketToRoomCode.delete(socketId);
}

export function unbindSocketFromPlayer(socketId: string) {
    socketToPlayerId.delete(socketId);
}

export function unbindSocket(socketId: string) {
    socketToRoomCode.delete(socketId);
    socketToPlayerId.delete(socketId);
}

export function getRoomCodeBySocket(socketId: string) {
    return socketToRoomCode.get(socketId);
}

export function getPlayerIdBySocket(socketId: string) {
    return socketToPlayerId.get(socketId);
}

export function getPlayerBySocket(socketId: string): Player | null {
    const mappedRoomCode = socketToRoomCode.get(socketId);
    const mappedPlayerId = socketToPlayerId.get(socketId);

    if (mappedRoomCode && mappedPlayerId) {
        const mappedRoom = getRoom(mappedRoomCode);
        const mappedPlayer = mappedRoom?.players.get(mappedPlayerId);
        if (mappedPlayer && mappedPlayer.socketId === socketId) {
            return mappedPlayer;
        }
    }

    return null;
}
