import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import dotenv from "dotenv";
import {
    createRoom,
    getRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    listRooms,
} from "./rooms";
import {
    generateSpawnPosition,
    restartRound,
    startGameLoop,
    stopGameLoop,
} from "./gameLoop";
import { Player, InputPayload } from "./types";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";

function calculateTargetScore(playerCount: number) {
    return Math.max(10, playerCount * 10 - 10);
}

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: CORS_ORIGIN },
    transports: ["websocket"],
});
console.log("Socket.IO initialized");

const socketToRoomCode = new Map<string, string>();
const socketToPlayerId = new Map<string, string>();

function getPlayerBySocket(socketId: string): Player | null {
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

function emitLobbyUpdate(roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;
    io.to(room.code).emit("lobbyUpdate", {
        players: Array.from(room.players.values()),
        targetScore:
            room.targetScore ?? calculateTargetScore(room.players.size),
        gameConfig: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
        },
    });
}

app.get("/", (_req, res) => res.send("Curvefever backend running"));

app.get("/debug", (_req, res) => {
    const rooms = listRooms().map((r) => ({
        code: r.code,
        hostSocketId: r.hostSocketId,
        players: Array.from(r.players.entries()).map(([id, p]) => ({
            id,
            name: p.name,
            socketId: p.socketId,
            alive: p.alive,
        })),
        state: r.state,
    }));
    res.json({ rooms });
});
io.on("connection", (socket) => {
    console.log("socket connected", socket.id);
    console.log("[DEBUG] Socket connected, waiting for createRoom event...");

    socket.on("createRoom", (_data, cb) => {
        console.log("[DEBUG] createRoom event received!");
        const room = createRoom(socket.id);
        console.log("[DEBUG] Room created:", room.code);
        // join socket to room
        socket.join(room.code);
        socketToRoomCode.set(socket.id, room.code);
        cb?.({
            roomCode: room.code,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on("reconnectHost", (data: { roomCode: string }, cb) => {
        const roomCode = data?.roomCode?.toUpperCase();
        if (!roomCode) return cb?.({ ok: false, error: "Room code required" });
        const room = getRoom(roomCode);
        if (!room) return cb?.({ ok: false, error: "Room not found" });

        room.hostSocketId = socket.id;
        socket.join(room.code);
        socketToRoomCode.set(socket.id, room.code);

        cb?.({
            ok: true,
            roomCode: room.code,
            players: Array.from(room.players.values()),
            state: room.state,
            targetScore:
                room.targetScore ?? calculateTargetScore(room.players.size),
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on("joinRoom", (data: { roomCode: string; name: string }, cb) => {
        const roomCode = data.roomCode?.toUpperCase();
        const room = roomCode ? getRoom(roomCode) : null;
        if (!room) return cb?.({ ok: false, error: "Room not found" });

        const spawn = generateSpawnPosition();

        const player: Player = {
            id: crypto.randomUUID(),
            name: data.name,
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
        socketToRoomCode.set(socket.id, room.code);
        socketToPlayerId.set(socket.id, player.id);
        console.log(
            `[joinRoom] Added player ${player.id} to room ${room.code}`,
        );
        cb?.({ ok: true, player });
        io.to(room.code).emit("playerJoined", { player });
        emitLobbyUpdate(room.code);
    });

    socket.on(
        "rejoinRoom",
        (data: { roomCode: string; playerId: string; name?: string }, cb) => {
            const roomCode = data?.roomCode?.toUpperCase();
            console.log(
                `[rejoinRoom] Attempt for player ${data?.playerId} in room ${roomCode}`,
            );

            if (!roomCode || !data?.playerId) {
                console.log(
                    `[rejoinRoom] Invalid request: missing roomCode or playerId`,
                );
                return cb?.({
                    ok: false,
                    error: "roomCode and playerId required",
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
                socketToRoomCode.delete(previousSocketId);
                socketToPlayerId.delete(previousSocketId);
            }
            existingPlayer.socketId = socket.id;
            existingPlayer.turnLeftHeld = false;
            existingPlayer.turnRightHeld = false;
            if (typeof data.name === "string" && data.name.trim()) {
                existingPlayer.name = data.name.trim();
            }
            socket.join(room.code);
            socketToRoomCode.set(socket.id, room.code);
            socketToPlayerId.set(socket.id, existingPlayer.id);

            cb?.({ ok: true, player: existingPlayer, state: room.state });
            emitLobbyUpdate(room.code);
        },
    );

    socket.on("requestLobbyState", (data: { roomCode: string }, cb) => {
        const roomCode = data?.roomCode?.toUpperCase();
        if (!roomCode) return cb?.({ ok: false, error: "Room code required" });
        const room = getRoom(roomCode);
        if (!room) return cb?.({ ok: false, error: "Room not found" });
        cb?.({
            ok: true,
            players: Array.from(room.players.values()),
            state: room.state,
            targetScore:
                room.targetScore ?? calculateTargetScore(room.players.size),
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on("input", (payload: InputPayload) => {
        const player = getPlayerBySocket(socket.id);
        if (!player || !player.alive) return;

        player.turnLeftHeld = Boolean(payload?.turnLeft);
        player.turnRightHeld = Boolean(payload?.turnRight);
    });

    socket.on("startGame", (data: { roomCode: string }, cb) => {
        const roomCode = data?.roomCode?.toUpperCase();
        const room = roomCode ? getRoom(roomCode) : null;
        if (!room) return cb?.({ ok: false, error: "Room not found" });
        if (room.hostSocketId !== socket.id)
            return cb?.({ ok: false, error: "Not host" });

        if (room.players.size < 1)
            return cb?.({ ok: false, error: "Need at least 1 player" });

        const targetScore = calculateTargetScore(room.players.size);
        room.targetScore = targetScore;
        const players = Array.from(room.players.values());
        for (const player of players) {
            player.score = 0;
        }
        restartRound(players);
        room.state = "playing";
        startGameLoop(room.code, io);
        io.to(room.code).emit("startGame", {
            targetScore,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
        cb?.({
            ok: true,
            targetScore,
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    // allow clients to explicitly leave a room (player or host)
    socket.on(
        "leaveRoom",
        (data: { roomCode: string; playerId?: string }, cb) => {
            const roomCode = data?.roomCode?.toUpperCase();
            if (!roomCode)
                return cb?.({ ok: false, error: "Room code required" });

            const room = getRoom(roomCode);
            if (!room) return cb?.({ ok: false, error: "Room not found" });

            if (data.playerId) {
                // regular player leaving
                const departingSocketId = room.players.get(
                    data.playerId,
                )?.socketId;
                const updated = leaveRoom(roomCode, data.playerId);
                if (!updated)
                    return cb?.({ ok: false, error: "Failed to leave room" });
                if (departingSocketId) {
                    socketToRoomCode.delete(departingSocketId);
                    socketToPlayerId.delete(departingSocketId);
                }
                if (socketToPlayerId.get(socket.id) === data.playerId) {
                    socketToRoomCode.delete(socket.id);
                    socketToPlayerId.delete(socket.id);
                }
                socket.leave(room.code);
                emitLobbyUpdate(roomCode);
                return cb?.({ ok: true });
            }

            // host is leaving; destroy the room entirely
            for (const player of room.players.values()) {
                if (player.socketId) {
                    socketToRoomCode.delete(player.socketId);
                    socketToPlayerId.delete(player.socketId);
                }
            }
            socketToRoomCode.delete(socket.id);
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
        const roomCode = socketToRoomCode.get(socket.id);
        const playerId = socketToPlayerId.get(socket.id);

        socketToRoomCode.delete(socket.id);
        socketToPlayerId.delete(socket.id);

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
            emitLobbyUpdate(room.code);
        }
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`CORS origin: ${CORS_ORIGIN}`);
});

// server.listen(PORT, () => {
// console.log(Server listening on port ${PORT});
// console.log(CORS origin: ${CORS_ORIGIN});
// });
