import crypto from "crypto";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { calculateTargetScore, normalizeRoomCode } from "../domain/gameRules";
import { generateSpawnPosition } from "../gameLoop";
import {
    createRoom,
    deleteRoom,
    findPlayerBySocketId,
    getRoom,
    joinRoom,
    leaveRoom,
} from "../rooms";
import { Player } from "../types";
import { TypedServer, TypedSocket } from "./events";
import { emitLobbyUpdate } from "./lobbyEmitter";

export function registerLobbyHandlers(io: TypedServer, socket: TypedSocket) {
    socket.on("createRoom", (_data, cb) => {
        const room = createRoom(socket.id);
        socket.join(room.code);
        cb?.({
            roomCode: room.code,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on("reconnectHost", (data: { roomCode: string }, cb) => {
        const roomCode = normalizeRoomCode(data?.roomCode);
        if (!roomCode)
            return cb?.({
                ok: false,
                error: "Room code must be 4 letters",
                errorCode: "ROOM_CODE_INVALID",
            });
        const room = getRoom(roomCode);
        if (!room)
            return cb?.({
                ok: false,
                error: "Room not found",
                errorCode: "ROOM_NOT_FOUND",
            });

        room.hostSocketId = socket.id;
        socket.join(room.code);

        cb?.({
            ok: true,
            roomCode: room.code,
            players: Array.from(room.players.values()),
            state: room.state,
            gameMode: room.gameMode,
            targetScore:
                room.gameMode === "classic"
                    ? (room.targetScore ??
                      calculateTargetScore(room.players.size))
                    : undefined,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on(
        "joinRoom",
        (data: { roomCode: string; name: string; playerId?: string }, cb) => {
            const roomCode = normalizeRoomCode(data?.roomCode);
            if (!roomCode)
                return cb?.({
                    ok: false,
                    error: "Room code must be 4 letters",
                    errorCode: "ROOM_CODE_INVALID",
                });

            const normalizedName = data?.name?.trim();
            if (!normalizedName) {
                return cb?.({
                    ok: false,
                    error: "Name is required",
                    errorCode: "NAME_REQUIRED",
                });
            }

            const room = getRoom(roomCode);
            if (!room)
                return cb?.({
                    ok: false,
                    error: "Room not found",
                    errorCode: "ROOM_NOT_FOUND",
                });

            // --- Reclaim logic ---
            const requestedPlayerId =
                typeof data?.playerId === "string" && data.playerId.trim()
                    ? data.playerId.trim()
                    : null;

            // 1. Try by explicit player ID
            const playerById = requestedPlayerId
                ? room.players.get(requestedPlayerId)
                : null;

            let reclaimCandidate: Player | undefined;

            if (playerById) {
                if (!playerById.socketId) {
                    // Disconnected — reclaim
                    reclaimCandidate = playerById;
                } else if (playerById.socketId === socket.id) {
                    // Already connected on this socket (idempotent)
                    cb?.({ ok: true, player: playerById });
                    return;
                }
                // If connected on a *different* active socket, fall through
                // to name-match or new-player logic rather than blocking.
            }

            // 2. Try by name match (disconnected only)
            if (!reclaimCandidate) {
                reclaimCandidate = Array.from(room.players.values()).find(
                    (p) =>
                        !p.socketId &&
                        p.name.trim().toLowerCase() ===
                            normalizedName.toLowerCase(),
                );
            }

            if (reclaimCandidate) {
                reclaimCandidate.socketId = socket.id;
                reclaimCandidate.turnLeftHeld = false;
                reclaimCandidate.turnRightHeld = false;
                reclaimCandidate.name = normalizedName;

                socket.join(room.code);

                console.log(
                    `[joinRoom] Reclaimed player ${reclaimCandidate.id} in room ${room.code}`,
                );
                cb?.({ ok: true, player: reclaimCandidate });
                emitLobbyUpdate(io, room.code);
                return;
            }

            // 3. Create a brand-new player
            const occupiedSpawnPositions = Array.from(
                room.players.values(),
            ).map((existingPlayer) => ({
                x: existingPlayer.x,
                y: existingPlayer.y,
            }));
            const spawn = generateSpawnPosition(occupiedSpawnPositions);

            const player: Player = {
                id: crypto.randomUUID(),
                name: normalizedName,
                score: 0,
                socketId: socket.id,
                color: undefined,
                alive: true,
                x: spawn.x,
                y: spawn.y,
                direction: Math.random() * Math.PI * 2,
                speed: 2.5,
                trail: [],
                turnLeftHeld: false,
                turnRightHeld: false,
            };

            joinRoom(room.code, player);
            socket.join(room.code);
            console.log(
                `[joinRoom] Added player ${player.id} to room ${room.code}`,
            );
            cb?.({ ok: true, player });
            io.to(room.code).emit("playerJoined", { player });
            emitLobbyUpdate(io, room.code);
        },
    );

    socket.on("requestLobbyState", (data: { roomCode: string }, cb) => {
        const roomCode = normalizeRoomCode(data?.roomCode);
        if (!roomCode)
            return cb?.({
                ok: false,
                error: "Room code must be 4 letters",
                errorCode: "ROOM_CODE_INVALID",
            });
        const room = getRoom(roomCode);
        if (!room)
            return cb?.({
                ok: false,
                error: "Room not found",
                errorCode: "ROOM_NOT_FOUND",
            });
        cb?.({
            ok: true,
            players: Array.from(room.players.values()),
            state: room.state,
            gameMode: room.gameMode,
            targetScore:
                room.gameMode === "classic"
                    ? (room.targetScore ??
                      calculateTargetScore(room.players.size))
                    : undefined,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on(
        "leaveRoom",
        (data: { roomCode: string; playerId?: string }, cb) => {
            const roomCode = normalizeRoomCode(data?.roomCode);
            if (!roomCode)
                return cb?.({
                    ok: false,
                    error: "Room code must be 4 letters",
                    errorCode: "ROOM_CODE_INVALID",
                });

            const room = getRoom(roomCode);
            if (!room)
                return cb?.({
                    ok: false,
                    error: "Room not found",
                    errorCode: "ROOM_NOT_FOUND",
                });

            if (data.playerId) {
                const updated = leaveRoom(roomCode, data.playerId);
                if (!updated)
                    return cb?.({
                        ok: false,
                        error: "Failed to leave room",
                        errorCode: "LEAVE_ROOM_FAILED",
                    });
                socket.leave(room.code);
                emitLobbyUpdate(io, roomCode);
                return cb?.({ ok: true });
            }

            const success = deleteRoom(roomCode);
            if (success) {
                io.to(roomCode).emit("roomClosed");
            }
            socket.leave(roomCode);
            return cb?.({ ok: true });
        },
    );

    socket.on("disconnect", () => {
        console.log("socket disconnect", socket.id);

        // Check if it was a player
        const result = findPlayerBySocketId(socket.id);
        if (result) {
            console.log(
                `[disconnect] Player ${result.player.id} (${result.player.name}) disconnected from room ${result.room.code}`,
            );
            result.player.socketId = null;
            emitLobbyUpdate(io, result.room.code);
            return;
        }

        // Host disconnect is a no-op (they can reconnect via reconnectHost)
    });
}
