import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { registerHttpRoutes } from "./http/routes";
import { ClientToServerEvents, ServerToClientEvents } from "./socket/events";
import { registerGameHandlers } from "./socket/gameHandlers";
import { registerLobbyHandlers } from "./socket/lobbyHandlers";

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: CORS_ORIGIN },
});
console.log("Socket.IO initialized");

registerHttpRoutes(app);

io.on("connection", (socket) => {
    console.log("socket connected", socket.id);
    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`CORS origin: ${CORS_ORIGIN}`);
});
