import { Server } from "socket.io";
import { getRoom } from "./rooms";
import { GameState, Player } from "../../shared-types/types";

const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

const runningLoops = new Map<string, NodeJS.Timeout>();

function movePlayer(p: Player, width: number, height: number) {
    const speed = p.speed ?? 2.5;
    // simple forward movement using direction (radians)
    const oldX = p.x;
    const oldY = p.y;
    p.x += Math.cos(p.direction) * speed;
    p.y += Math.sin(p.direction) * speed;
    // Wrap
    p.x = ((p.x % width) + width) % width;
    p.y = ((p.y % height) + height) % height;

    // Trail/gap logic
    if (!Array.isArray(p.trail) || p.trail.length === 0) p.trail = [[]];
    if (typeof p.distanceSinceLastGap !== "number") p.distanceSinceLastGap = 0;
    if (typeof p.gapInterval !== "number")
        p.gapInterval = 200 + Math.random() * 200;
    if (typeof p.gapLength !== "number") p.gapLength = 40 + Math.random() * 40;
    if (typeof p.inGap !== "boolean") p.inGap = false;
    if (typeof p.gapStartDistance !== "number") p.gapStartDistance = 0;

    // Distance moved
    const dx = p.x - oldX;
    const dy = p.y - oldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    p.distanceSinceLastGap += dist;

    // Gap logic
    if (!p.inGap && p.distanceSinceLastGap > p.gapInterval) {
        p.inGap = true;
        p.gapStartDistance = p.distanceSinceLastGap;
        // Start a new segment (gap)
        p.trail!.push([]);
    }
    if (p.inGap && p.distanceSinceLastGap > p.gapStartDistance + p.gapLength) {
        p.inGap = false;
        p.gapInterval = 200 + Math.random() * 200;
        p.gapLength = 40 + Math.random() * 40;
        p.distanceSinceLastGap = 0;
    }

    // Add trail point if not in gap
    if (!p.inGap) {
        const seg = p.trail![p.trail!.length - 1];
        if (seg && (seg.length === 0 || dist > 2)) {
            seg.push({ x: p.x, y: p.y });
            // No segment length limit
        }
    }
}

function buildGameState(roomCode: string): GameState | null {
    const room = getRoom(roomCode);
    if (!room) return null;
    const players = Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        socketId: p.socketId,
        color: p.color,
        alive: p.alive,
        x: p.x,
        y: p.y,
        direction: p.direction,
        speed: p.speed,
        // Only send trail and gap state to host
        trail: p.trail,
        distanceSinceLastGap: p.distanceSinceLastGap,
        gapInterval: p.gapInterval,
        gapLength: p.gapLength,
        inGap: p.inGap,
        gapStartDistance: p.gapStartDistance,
    }));
    return { tick: Date.now(), players };
}

export function startGameLoop(roomCode: string, io: Server) {
    if (runningLoops.has(roomCode)) return;

    // Assume 800x600 for now; could be made dynamic
    const width = 800;
    const height = 600;

    const tick = () => {
        const room = getRoom(roomCode);
        if (!room) return;

        for (const p of room.players.values()) {
            if (!p.alive) continue;
            movePlayer(p, width, height);
        }

        const state = buildGameState(roomCode);
        if (state) {
            io.to(roomCode).emit("gameState", state);
        }
    };

    const handle = setInterval(tick, MS_PER_TICK);
    runningLoops.set(roomCode, handle);
}

export function stopGameLoop(roomCode: string) {
    const handle = runningLoops.get(roomCode);
    if (handle) {
        clearInterval(handle);
        runningLoops.delete(roomCode);
    }
}
