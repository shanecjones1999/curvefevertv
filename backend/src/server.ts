import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import dotenv from "dotenv";
import { createRoom, getRoom, joinRoom, leaveRoom, deleteRoom } from "./rooms";
import { startGameLoop, stopGameLoop } from "./gameLoop";
import { Player, InputPayload } from "../../shared-types/types";

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN } });

function emitLobbyUpdate(roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;
    io.to(room.code).emit("lobbyUpdate", {
        players: Array.from(room.players.values()),
    });
}

app.get("/", (_req, res) => res.send("Curvefever backend running"));

io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    socket.on("createRoom", (_data, cb) => {
        const room = createRoom(socket.id);
        // join socket to room
        socket.join(room.code);
        cb?.({ roomCode: room.code });
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
        });
    });

    socket.on("joinRoom", (data: { roomCode: string; name: string }, cb) => {
        const roomCode = data.roomCode?.toUpperCase();
        const room = roomCode ? getRoom(roomCode) : null;
        if (!room) return cb?.({ ok: false, error: "Room not found" });

        const player: Player = {
            id: crypto.randomUUID(),
            name: data.name,
            socketId: socket.id,
            color: undefined,
            alive: true,
            x: Math.random() * 800,
            y: Math.random() * 600,
            direction: Math.random() * Math.PI * 2,
            speed: 2.5,
            trail: [],
        };

        joinRoom(room.code, player);
        socket.join(room.code);
        cb?.({ ok: true, player });
        io.to(room.code).emit("playerJoined", { player });
        emitLobbyUpdate(room.code);
    });

    socket.on(
        "rejoinRoom",
        (data: { roomCode: string; playerId: string; name?: string }, cb) => {
            const roomCode = data?.roomCode?.toUpperCase();
            if (!roomCode || !data?.playerId)
                return cb?.({
                    ok: false,
                    error: "roomCode and playerId required",
                });

            const room = getRoom(roomCode);
            if (!room) return cb?.({ ok: false, error: "Room not found" });

            const existingPlayer = room.players.get(data.playerId);
            if (!existingPlayer)
                return cb?.({ ok: false, error: "Player not found in room" });

            existingPlayer.socketId = socket.id;
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
        });
    });

    socket.on("input", (payload: InputPayload) => {
        // find player and update direction based on input
        for (const room of Array.from(io.sockets.adapter.rooms.keys())) {
            const r = getRoom(room);
            if (!r) continue;
            for (const p of r.players.values()) {
                if (p.socketId === socket.id) {
                    // simple turning logic
                    const turnRate = 0.12;
                    if (payload.turnLeft) p.direction -= turnRate;
                    if (payload.turnRight) p.direction += turnRate;
                }
            }
        }
    });

    socket.on("startGame", (data: { roomCode: string }, cb) => {
        const roomCode = data?.roomCode?.toUpperCase();
        const room = roomCode ? getRoom(roomCode) : null;
        if (!room) return cb?.({ ok: false, error: "Room not found" });
        if (room.hostSocketId !== socket.id)
            return cb?.({ ok: false, error: "Not host" });

        room.state = "playing";
        startGameLoop(room.code, io);
        io.to(room.code).emit("startGame");
        cb?.({ ok: true });
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
                continue;
            }

            // remove any player matching this socket id
            for (const p of r.players.values()) {
                if (p.socketId === socket.id) {
                    leaveRoom(r.code, p.id);
                    emitLobbyUpdate(r.code);
                    break;
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`CORS origin: ${CORS_ORIGIN}`);
});
