import crypto from "crypto";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { calculateTargetScore, normalizeRoomCode } from "../domain/gameRules";
import {
    buildBattleRoyaleLeaderboard,
    buildClassicLeaderboard,
} from "../domain/leaderboard";
import {
    buildTeamLeaderboard,
    chooseBalancedTeam,
    rebalancePlayersForTeamMode,
} from "../domain/teamMode";
import {
    generateSpawnPosition,
    getPendingRoundOverPayload,
    stopGameLoop,
} from "../gameLoop";
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
    socket.on("createRoom", (data, cb) => {
        const room = createRoom(socket.id, data ?? undefined);
        socket.join(room.code);
        bindSocketToRoom(socket.id, room.code);
        cb?.({
            roomCode: room.code,
            gameMode: room.gameMode,
            teamCount: room.teamCount,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on("reconnectHost", (data: { roomCode: string }, cb) => {
        const roomCode = normalizeRoomCode(data?.roomCode);
        if (!roomCode)
            return cb?.({ ok: false, error: "Room code must be 4 letters" });
        const room = getRoom(roomCode);
        if (!room) return cb?.({ ok: false, error: "Room not found" });

        room.hostSocketId = socket.id;
        socket.join(room.code);
        bindSocketToRoom(socket.id, room.code);

        const players = Array.from(room.players.values());
        const leaderboard =
            room.state === "finished"
                ? room.gameMode === "battle-royale"
                    ? buildBattleRoyaleLeaderboard(
                          players,
                          room.battleRoyaleEliminatedPlayerIds,
                      )
                    : room.gameMode === "teams"
                      ? buildTeamLeaderboard(players)
                    : buildClassicLeaderboard(players)
                : undefined;
        const winnerId = leaderboard?.[0]?.id ?? null;

        cb?.({
            ok: true,
            roomCode: room.code,
            players,
            state: room.state,
            gameMode: room.gameMode,
            winnerId,
            leaderboard,
            roundOver:
                room.state === "playing"
                    ? getPendingRoundOverPayload(room.code)
                    : undefined,
            targetScore: (() => {
                if (room.gameMode === "classic") {
                    return (
                        room.targetScore ?? calculateTargetScore(room.players.size)
                    );
                }
                if (room.gameMode === "teams") {
                    const activeTeamCount = buildTeamLeaderboard(players).length;
                    return (
                        room.targetScore ??
                        calculateTargetScore(activeTeamCount)
                    );
                }
                return undefined;
            })(),
            teamCount: room.teamCount,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on("joinRoom", (data: { roomCode: string; name: string }, cb) => {
        const roomCode = normalizeRoomCode(data?.roomCode);
        if (!roomCode)
            return cb?.({ ok: false, error: "Room code must be 4 letters" });

        const normalizedName = data?.name?.trim();
        if (!normalizedName) {
            return cb?.({ ok: false, error: "Name is required" });
        }

        const room = getRoom(roomCode);
        if (!room) return cb?.({ ok: false, error: "Room not found" });

        const occupiedSpawnPositions = Array.from(room.players.values()).map(
            (existingPlayer) => ({
                x: existingPlayer.x,
                y: existingPlayer.y,
            }),
        );
        const spawn = generateSpawnPosition(occupiedSpawnPositions);

        const player: Player = {
            id: crypto.randomUUID(),
            name: normalizedName,
            score: 0,
            socketId: socket.id,
            color: undefined,
            teamId:
                room.gameMode === "teams"
                    ? chooseBalancedTeam(
                          Array.from(room.players.values()),
                          room.teamCount,
                      )
                    : undefined,
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
    });

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
                });
            }

            const room = getRoom(roomCode);
            if (!room) {
                console.log(`[rejoinRoom] Room not found: ${roomCode}`);
                return cb?.({ ok: false, error: "Room not found" });
            }

            const existingPlayer = room.players.get(data.playerId);
            if (!existingPlayer) {
                console.log(
                    `[rejoinRoom] Player not found in room: ${data.playerId} in ${roomCode}. Players in room:`,
                    Array.from(room.players.keys()),
                );
                return cb?.({ ok: false, error: "Player not found in room" });
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
            return cb?.({ ok: false, error: "Room code must be 4 letters" });
        const room = getRoom(roomCode);
        if (!room) return cb?.({ ok: false, error: "Room not found" });
        cb?.({
            ok: true,
            players: Array.from(room.players.values()),
            state: room.state,
            gameMode: room.gameMode,
            targetScore: (() => {
                if (room.gameMode === "classic") {
                    return (
                        room.targetScore ?? calculateTargetScore(room.players.size)
                    );
                }
                if (room.gameMode === "teams") {
                    return (
                        room.targetScore ??
                        calculateTargetScore(
                            buildTeamLeaderboard(Array.from(room.players.values()))
                                .length,
                        )
                    );
                }
                return undefined;
            })(),
            teamCount: room.teamCount,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on(
        "switchTeam",
        (data: { roomCode: string; teamId: number }, cb) => {
            const roomCode = normalizeRoomCode(data?.roomCode);
            if (!roomCode)
                return cb?.({
                    ok: false,
                    error: "Room code must be 4 letters",
                });

            const room = getRoom(roomCode);
            if (!room) return cb?.({ ok: false, error: "Room not found" });
            if (room.gameMode !== "teams") {
                return cb?.({ ok: false, error: "Team mode is not enabled" });
            }
            if (room.state !== "lobby") {
                return cb?.({
                    ok: false,
                    error: "Teams can only change in the lobby",
                });
            }

            const playerId = getPlayerIdBySocket(socket.id);
            if (!playerId) {
                return cb?.({ ok: false, error: "Player not found" });
            }

            const player = room.players.get(playerId);
            if (!player || player.socketId !== socket.id) {
                return cb?.({ ok: false, error: "Player not found" });
            }

            if (!Number.isInteger(data?.teamId)) {
                return cb?.({ ok: false, error: "Invalid team selection" });
            }

            const teamId = data.teamId;
            if (teamId < 1 || teamId > room.teamCount) {
                return cb?.({ ok: false, error: "Invalid team selection" });
            }

            player.teamId = teamId;
            emitLobbyUpdate(io, room.code);
            cb?.({ ok: true, player, teamCount: room.teamCount });
        },
    );

    socket.on(
        "leaveRoom",
        (data: { roomCode: string; playerId?: string }, cb) => {
            const roomCode = normalizeRoomCode(data?.roomCode);
            if (!roomCode)
                return cb?.({
                    ok: false,
                    error: "Room code must be 4 letters",
                });

            const room = getRoom(roomCode);
            if (!room) return cb?.({ ok: false, error: "Room not found" });

            if (data.playerId) {
                const departingSocketId = room.players.get(
                    data.playerId,
                )?.socketId;
                const updated = leaveRoom(roomCode, data.playerId);
                if (!updated)
                    return cb?.({ ok: false, error: "Failed to leave room" });
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
            stopGameLoop(roomCode);
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
