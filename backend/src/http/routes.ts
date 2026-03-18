import { Express } from "express";
import { listRooms } from "../rooms";

export function registerHttpRoutes(app: Express) {
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
}
