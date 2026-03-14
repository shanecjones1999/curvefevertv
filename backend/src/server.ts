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
    startGameLoop,
    stopGameLoop,
    cleanupPlayerTrailTracking,
} from "./gameLoop";

// Alias for use inside socket handlers
const lastSentTrailCleanup = (playerId: string) =>
    cleanupPlayerTrailTracking(playerId);
import { Player, InputPayload } from "./types";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";

// Fast lookup: socketId → { roomCode, playerId } for O(1) input routing
const socketPlayerMap = new Map<
    string,
    { roomCode: string; playerId: string }
>();

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN } });
console.log("Socket.IO initialized");

function emitLobbyUpdate(roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;
    io.to(room.code).emit("lobbyUpdate", {
        players: Array.from(room.players.values()),
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

        cb?.({
            ok: true,
            roomCode: room.code,
            players: Array.from(room.players.values()),
            state: room.state,
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

        // Prevent ghost players: if this socket already has a player in this
        // room (e.g. from a stale session), reuse it instead of creating a new one.
        const existingMapping = socketPlayerMap.get(socket.id);
        if (existingMapping && existingMapping.roomCode === room.code) {
            const existing = room.players.get(existingMapping.playerId);
            if (existing) {
                return cb?.({ ok: true, player: existing });
            }
        }

        // Also clean up any disconnected player with the same name to avoid
        // duplicates when a player's rejoin failed and they manually re-joined.
        for (const [pid, p] of room.players.entries()) {
            if (p.name === data.name && p.socketId === null) {
                room.players.delete(pid);
                lastSentTrailCleanup(pid);
                break;
            }
        }

        const player: Player = {
            id: crypto.randomUUID(),
            name: data.name,
            score: 0,
            socketId: socket.id,
            color: undefined,
            alive: true,
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            direction: Math.random() * Math.PI * 2,
            speed: 2.5,
            trail: [],
        };

        joinRoom(room.code, player);
        socket.join(room.code);
        socketPlayerMap.set(socket.id, {
            roomCode: room.code,
            playerId: player.id,
        });
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
            // Clean up stale socketPlayerMap entry for the old socket ID
            if (
                existingPlayer.socketId &&
                existingPlayer.socketId !== socket.id
            ) {
                socketPlayerMap.delete(existingPlayer.socketId);
            }
            existingPlayer.socketId = socket.id;
            socketPlayerMap.set(socket.id, {
                roomCode: room.code,
                playerId: data.playerId,
            });
            if (typeof data.name === "string" && data.name.trim()) {
                existingPlayer.name = data.name.trim();
            }
            socket.join(room.code);

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
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
    });

    socket.on("input", (payload: InputPayload) => {
        const mapping = socketPlayerMap.get(socket.id);
        if (!mapping) return;
        const room = getRoom(mapping.roomCode);
        if (!room) return;
        const p = room.players.get(mapping.playerId);
        if (!p) return;
        // Store current input state rather than immediately mutating direction.
        // The game loop will apply turning at the correct tick rate.
        (p as any).__inputLeft = !!payload.turnLeft;
        (p as any).__inputRight = !!payload.turnRight;
    });

    socket.on("startGame", (data: { roomCode: string }, cb) => {
        const roomCode = data?.roomCode?.toUpperCase();
        const room = roomCode ? getRoom(roomCode) : null;
        if (!room) return cb?.({ ok: false, error: "Room not found" });
        if (room.hostSocketId !== socket.id)
            return cb?.({ ok: false, error: "Not host" });

        room.state = "playing";
        startGameLoop(room.code, io);
        io.to(room.code).emit("startGame", {
            gameConfig: {
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
            },
        });
        cb?.({
            ok: true,
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
                const updated = leaveRoom(roomCode, data.playerId);
                if (!updated)
                    return cb?.({ ok: false, error: "Failed to leave room" });
                socket.leave(room.code);
                socketPlayerMap.delete(socket.id);
                emitLobbyUpdate(roomCode);
                return cb?.({ ok: true });
            }

            // host is leaving; destroy the room entirely
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
        socketPlayerMap.delete(socket.id);
        // when a socket drops we remove it from any player lists, but we do
        // *not* destroy the room when the host temporarily disconnects. this
        // allows the host to refresh and reattach using the reconnectHost flow
        // without ending the session for everyone.

        for (const room of Array.from(io.sockets.adapter.rooms.keys())) {
            const r = getRoom(room);
            if (!r) continue;

            // if the host happened to disconnect, leave the room alone; the
            // reconnectHost handler will update the socket id when they come
            // back. we could mark r.hostSocketId = "" here but it's not
            // strictly necessary.
            if (r.hostSocketId === socket.id) {
                console.log(
                    `[disconnect] Host disconnected from room ${r.code}`,
                );
                continue;
            }

            // For players: instead of removing them entirely, just disconnect their socket
            // This allows them to rejoin later without losing their place in the room
            for (const p of r.players.values()) {
                if (p.socketId === socket.id) {
                    console.log(
                        `[disconnect] Player ${p.id} (${p.name}) disconnected from room ${r.code}`,
                    );
                    p.socketId = null; // Mark as disconnected but keep in room
                    emitLobbyUpdate(r.code); // Update lobby to show disconnected state
                    break;
                }
            }
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
