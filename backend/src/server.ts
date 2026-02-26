import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import { createRoom, getRoom, joinRoom } from "./rooms";
import { startGameLoop, stopGameLoop } from "./gameLoop";
import { Player, InputPayload } from "../../shared-types/types";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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
                return cb?.({ ok: false, error: "roomCode and playerId required" });

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
        cb?.({ ok: true, players: Array.from(room.players.values()), state: room.state });
    });

    socket.on("input", (payload: InputPayload) => {
        // find player and update direction based on input
        for (const room of Array.from(io.sockets.adapter.rooms.keys())) {
            const r = getRoom(room);
            if (!r) continue;
            for (const p of r.players.values()) {
                if (p.socketId === socket.id) {
                    // simple turning logic
                    const turnRate = 0.08;
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

    socket.on("disconnect", () => {
        console.log("socket disconnect", socket.id);
        // leave handling omitted (simple for MVP)
    });
});

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
