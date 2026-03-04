import { Server } from "socket.io";
import { getRoom } from "./rooms";
import { GameState, Player } from "../../shared-types/types";

const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

const runningLoops = new Map<string, NodeJS.Timeout>();
const restartGracePeriod = 30; // ticks to prevent immediate re-collision after restart
const restartGraceMap = new Map<string, number>();

function ensureTrailSegment(p: Player) {
    if (!Array.isArray(p.trail) || p.trail.length === 0) {
        p.trail = [[]];
    }
    if (!p.trail[p.trail.length - 1]) {
        p.trail.push([]);
    }
}

function appendTrailPoint(p: Player, x: number, y: number) {
    ensureTrailSegment(p);
    const seg = p.trail![p.trail!.length - 1];
    const last = seg[seg.length - 1];
    if (!last) {
        seg.push({ x, y });
        return;
    }
    const dx = x - last.x;
    const dy = y - last.y;
    if (Math.sqrt(dx * dx + dy * dy) > 0.1) {
        seg.push({ x, y });
    }
}

function splitTrailForWrap(
    p: Player,
    oldX: number,
    oldY: number,
    wrappedDx: number,
    wrappedDy: number,
    width: number,
    height: number,
) {
    const endX = oldX + wrappedDx;
    const endY = oldY + wrappedDy;

    const events: Array<{ t: number; axis: "x" | "y" }> = [];

    if (endX < 0 || endX >= width) {
        const boundaryX = endX < 0 ? 0 : width;
        const tx = (boundaryX - oldX) / (endX - oldX);
        if (tx > 0 && tx <= 1) events.push({ t: tx, axis: "x" });
    }

    if (endY < 0 || endY >= height) {
        const boundaryY = endY < 0 ? 0 : height;
        const ty = (boundaryY - oldY) / (endY - oldY);
        if (ty > 0 && ty <= 1) events.push({ t: ty, axis: "y" });
    }

    events.sort((a, b) => a.t - b.t);

    const grouped: Array<{ t: number; axes: Array<"x" | "y"> }> = [];
    for (const event of events) {
        const last = grouped[grouped.length - 1];
        if (last && Math.abs(last.t - event.t) < 1e-9) {
            last.axes.push(event.axis);
        } else {
            grouped.push({ t: event.t, axes: [event.axis] });
        }
    }

    for (const group of grouped) {
        const crossX = oldX + (endX - oldX) * group.t;
        const crossY = oldY + (endY - oldY) * group.t;
        const edgeX = Math.min(width, Math.max(0, crossX));
        const edgeY = Math.min(height, Math.max(0, crossY));

        appendTrailPoint(p, edgeX, edgeY);

        let entryX = edgeX;
        let entryY = edgeY;
        for (const axis of group.axes) {
            if (axis === "x") {
                entryX = wrappedDx > 0 ? 0 : width;
            }
            if (axis === "y") {
                entryY = wrappedDy > 0 ? 0 : height;
            }
        }

        p.trail!.push([]);
        appendTrailPoint(p, entryX, entryY);
    }

    const finalX = ((endX % width) + width) % width;
    const finalY = ((endY % height) + height) % height;
    appendTrailPoint(p, finalX, finalY);
}

function movePlayer(p: Player, width: number, height: number) {
    const speed = p.speed ?? 2.5;
    // simple forward movement using direction (radians)
    const oldX = p.x;
    const oldY = p.y;
    const rawNextX = oldX + Math.cos(p.direction) * speed;
    const rawNextY = oldY + Math.sin(p.direction) * speed;

    const wrappedX = ((rawNextX % width) + width) % width;
    const wrappedY = ((rawNextY % height) + height) % height;

    const crossedX = rawNextX < 0 || rawNextX >= width;
    const crossedY = rawNextY < 0 || rawNextY >= height;

    p.x = wrappedX;
    p.y = wrappedY;

    // Trail/gap logic
    if (!Array.isArray(p.trail) || p.trail.length === 0) p.trail = [[]];
    if (typeof p.distanceSinceLastGap !== "number") p.distanceSinceLastGap = 0;
    if (typeof p.gapInterval !== "number")
        p.gapInterval = 200 + Math.random() * 200;
    if (typeof p.gapLength !== "number") p.gapLength = 40 + Math.random() * 40;
    if (typeof p.inGap !== "boolean") p.inGap = false;
    if (typeof p.gapStartDistance !== "number") p.gapStartDistance = 0;

    // Distance moved
    const wrappedDeltaX =
        wrappedX - oldX > width / 2
            ? wrappedX - oldX - width
            : wrappedX - oldX < -width / 2
              ? wrappedX - oldX + width
              : wrappedX - oldX;
    const wrappedDeltaY =
        wrappedY - oldY > height / 2
            ? wrappedY - oldY - height
            : wrappedY - oldY < -height / 2
              ? wrappedY - oldY + height
              : wrappedY - oldY;
    const dist = Math.sqrt(
        wrappedDeltaX * wrappedDeltaX + wrappedDeltaY * wrappedDeltaY,
    );
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
        if (crossedX || crossedY) {
            splitTrailForWrap(
                p,
                oldX,
                oldY,
                wrappedDeltaX,
                wrappedDeltaY,
                width,
                height,
            );
        } else if (dist > 2) {
            appendTrailPoint(p, p.x, p.y);
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

function distanceToLineSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0)
        return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    const t = Math.max(
        0,
        Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq),
    );
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const distX = px - closestX;
    const distY = py - closestY;
    return Math.sqrt(distX * distX + distY * distY);
}

function checkCollisions(
    players: Player[],
    skipGraceTickCount: number,
): boolean {
    // Skip collision check during grace period after round restart
    if (skipGraceTickCount > 0) return false;

    const collisionRadius = 5;

    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.alive) continue;

        // Check player-to-player collision
        for (let j = i + 1; j < players.length; j++) {
            const other = players[j];
            if (!other.alive) continue;
            const dx = p.x - other.x;
            const dy = p.y - other.y;
            const distSq = dx * dx + dy * dy;
            // Players collide if they're within 10px of each other
            if (distSq < 100) {
                return true;
            }
        }

        // Check collision with opponent trails only (not own trail)
        for (const otherPlayer of players) {
            if (otherPlayer.id === p.id) continue; // Skip own trails entirely
            if (!Array.isArray(otherPlayer.trail)) continue;

            for (let segIdx = 0; segIdx < otherPlayer.trail.length; segIdx++) {
                const segment = otherPlayer.trail[segIdx];
                if (!Array.isArray(segment) || segment.length === 0) continue;

                for (let i = 0; i < segment.length - 1; i++) {
                    const pt1 = segment[i];
                    const pt2 = segment[i + 1];
                    if (!pt1 || !pt2) continue;

                    const dist = distanceToLineSegment(
                        p.x,
                        p.y,
                        pt1.x,
                        pt1.y,
                        pt2.x,
                        pt2.y,
                    );
                    if (dist < collisionRadius) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

export function startGameLoop(roomCode: string, io: Server) {
    if (runningLoops.has(roomCode)) return;

    // Assume 800x600 for now; could be made dynamic
    const width = 800;
    const height = 600;
    restartGraceMap.set(roomCode, 0);

    const tick = () => {
        const room = getRoom(roomCode);
        if (!room) return;

        for (const p of room.players.values()) {
            if (!p.alive) continue;
            movePlayer(p, width, height);
        }

        // Decrement grace period counter
        let graceTicksRemaining = restartGraceMap.get(roomCode) ?? 0;
        if (graceTicksRemaining > 0) {
            graceTicksRemaining--;
            restartGraceMap.set(roomCode, graceTicksRemaining);
        }

        // Check for collisions and restart round if detected
        const players = Array.from(room.players.values());
        if (checkCollisions(players, graceTicksRemaining)) {
            for (const p of players) {
                p.alive = true;
                p.x = Math.random() * width;
                p.y = Math.random() * height;
                p.direction = Math.random() * Math.PI * 2;
                p.trail = [[]];
                p.distanceSinceLastGap = 0;
                p.gapInterval = 200 + Math.random() * 200;
                p.gapLength = 40 + Math.random() * 40;
                p.inGap = false;
            }
            restartGraceMap.set(roomCode, restartGracePeriod);
            io.to(roomCode).emit("roundRestart");
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
