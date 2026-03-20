import crypto from "crypto";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { calculateTargetScore, normalizeRoomCode } from "../domain/gameRules";
import { generateSpawnPosition } from "../gameLoop";
import { createRoom, deleteRoom, getRoom, joinRoom, leaveRoom } from "../rooms";
import { Player } from "../types";
import { TypedServer, TypedSocket } from "./events";
import { emitLobbyUpdate } from "./lobbyEmitter";
import {
    bindSocketToPlayer,
    bindSocketToRoom,
    getPlayerIdBySocket,
    getRoomCodeBySocket,
    unbindSocket,
    unbindSocketFromRoom,
} from "./sessionRegistry";

export function registerLobbyHandlers(io: TypedServer, socket: TypedSocket) {
    socket.on("createRoom", (_data, cb) => {
        const room = createRoom(socket.id);
        socket.join(room.code);
        bindSocketToRoom(socket.id, room.code);
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
        bindSocketToRoom(socket.id, room.code);

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

            const requestedPlayerId =
                typeof data?.playerId === "string" && data.playerId.trim()
                    ? data.playerId.trim()
                    : null;

            const disconnectedPlayerById = requestedPlayerId
                ? room.players.get(requestedPlayerId)
                : null;
            const disconnectedPlayerByName = Array.from(
                room.players.values(),
            ).find(
                (existingPlayer) =>
                    !existingPlayer.socketId &&
                    existingPlayer.name.trim().toLowerCase() ===
                        normalizedName.toLowerCase(),
            );

            const reclaimCandidate =
                disconnectedPlayerById && !disconnectedPlayerById.socketId
                    ? disconnectedPlayerById
                    : disconnectedPlayerByName;

            if (reclaimCandidate) {
                reclaimCandidate.socketId = socket.id;
                reclaimCandidate.turnLeftHeld = false;
                reclaimCandidate.turnRightHeld = false;
                reclaimCandidate.name = normalizedName;

                socket.join(room.code);
                bindSocketToRoom(socket.id, room.code);
                bindSocketToPlayer(socket.id, reclaimCandidate.id);

                console.log(
                    `[joinRoom] Reclaimed player ${reclaimCandidate.id} in room ${room.code}`,
                );
                cb?.({ ok: true, player: reclaimCandidate });
                emitLobbyUpdate(io, room.code);
                return;
            }

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
            bindSocketToRoom(socket.id, room.code);
            bindSocketToPlayer(socket.id, player.id);
            console.log(
                `[joinRoom] Added player ${player.id} to room ${room.code}`,
            );
            cb?.({ ok: true, player });
            io.to(room.code).emit("playerJoined", { player });
            emitLobbyUpdate(io, room.code);
        },
    );

    socket.on(
        "rejoinRoom",
        (data: { roomCode: string; playerId: string; name?: string }, cb) => {
            const roomCode = normalizeRoomCode(data?.roomCode);
            console.log(
                `[rejoinRoom] Attempt for player ${data?.playerId} in room ${roomCode}`,
            );

            if (!roomCode || !data?.playerId) {
                console.log(
                    `[rejoinRoom] Invalid request: missing roomCode or playerId`,
                );
                return cb?.({
                    ok: false,
                    error: "roomCode (4 letters) and playerId required",
                    errorCode: "REJOIN_PAYLOAD_INVALID",
                });
            }

            const room = getRoom(roomCode);
            if (!room) {
                console.log(`[rejoinRoom] Room not found: ${roomCode}`);
                return cb?.({
                    ok: false,
                    error: "Room not found",
                    errorCode: "ROOM_NOT_FOUND",
                });
            }

            const existingPlayer = room.players.get(data.playerId);
            if (!existingPlayer) {
                console.log(
                    `[rejoinRoom] Player not found in room: ${data.playerId} in ${roomCode}. Players in room:`,
                    Array.from(room.players.keys()),
                );
                return cb?.({
                    ok: false,
                    error: "Player not found in room",
                    errorCode: "PLAYER_NOT_FOUND_IN_ROOM",
                });
            }

            console.log(
                `[rejoinRoom] Successfully rejoining player ${data.playerId} (${existingPlayer.name}) to room ${roomCode}`,
            );
            const previousSocketId = existingPlayer.socketId;
            if (previousSocketId && previousSocketId !== socket.id) {
                unbindSocket(previousSocketId);
            }
            existingPlayer.socketId = socket.id;
            existingPlayer.turnLeftHeld = false;
            existingPlayer.turnRightHeld = false;
            if (typeof data.name === "string" && data.name.trim()) {
                existingPlayer.name = data.name.trim();
            }
            socket.join(room.code);
            bindSocketToRoom(socket.id, room.code);
            bindSocketToPlayer(socket.id, existingPlayer.id);

            cb?.({ ok: true, player: existingPlayer, state: room.state });
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
                const departingSocketId = room.players.get(
                    data.playerId,
                )?.socketId;
                const updated = leaveRoom(roomCode, data.playerId);
                if (!updated)
                    return cb?.({
                        ok: false,
                        error: "Failed to leave room",
                        errorCode: "LEAVE_ROOM_FAILED",
                    });
                if (departingSocketId) {
                    unbindSocket(departingSocketId);
                }
                if (getPlayerIdBySocket(socket.id) === data.playerId) {
                    unbindSocket(socket.id);
                }
                socket.leave(room.code);
                emitLobbyUpdate(io, roomCode);
                return cb?.({ ok: true });
            }

            for (const player of room.players.values()) {
                if (player.socketId) {
                    unbindSocket(player.socketId);
                }
            }
            unbindSocketFromRoom(socket.id);
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
        const roomCode = getRoomCodeBySocket(socket.id);
        const playerId = getPlayerIdBySocket(socket.id);

        unbindSocket(socket.id);

        if (!roomCode) return;

        const room = getRoom(roomCode);
        if (!room) return;

        if (room.hostSocketId === socket.id) {
            console.log(
                `[disconnect] Host disconnected from room ${room.code}`,
            );
            return;
        }

        if (!playerId) return;

        const player = room.players.get(playerId);
        if (player && player.socketId === socket.id) {
            console.log(
                `[disconnect] Player ${player.id} (${player.name}) disconnected from room ${room.code}`,
            );
            player.socketId = null;
            emitLobbyUpdate(io, room.code);
        }
    });
}
