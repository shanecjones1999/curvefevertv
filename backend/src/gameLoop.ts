import { Server } from "socket.io";
import { getRoom } from "./rooms";
import { GameState, Player } from "./types";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";

const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

const runningLoops = new Map<string, NodeJS.Timeout>();
const restartGracePeriod = 30; // ticks to prevent immediate re-collision after restart
const restartGraceMap = new Map<string, number>();

// Track how much trail data we've already sent per player so we only send deltas
const lastSentTrail = new Map<string, { segments: number; points: number }>();

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
        } else if (dist > 0.5) {
            appendTrailPoint(p, p.x, p.y);
        }
    }
}

// Tick counter for periodic full-state sync
let tickCounter = 0;
const FULL_SYNC_INTERVAL = 120; // send full trail every ~2 seconds at 60fps

function getDeltaTrail(
    playerId: string,
    trail: Array<Array<{ x: number; y: number }>>,
): { delta: Array<Array<{ x: number; y: number }>>; continues: boolean } {
    const last = lastSentTrail.get(playerId);
    if (!last) {
        // First time: send everything
        lastSentTrail.set(playerId, {
            segments: trail.length,
            points: trail.length > 0 ? trail[trail.length - 1].length : 0,
        });
        return { delta: trail, continues: false };
    }

    const delta: Array<Array<{ x: number; y: number }>> = [];
    // Track whether the first entry in delta is a continuation of the
    // last segment the client already has (true) vs a brand-new segment
    // that should NOT be merged into the previous one (false).
    let continues = false;

    for (let s = last.segments - 1; s < trail.length; s++) {
        if (s < 0) continue;
        const seg = trail[s];
        if (!seg) continue;
        if (s === last.segments - 1) {
            // Partial segment: only new points
            const startIdx = last.points;
            if (startIdx < seg.length) {
                delta.push(seg.slice(startIdx));
                continues = true; // these points extend the existing segment
            }
        } else {
            // Entirely new segment (gap boundary)
            delta.push(seg);
        }
    }

    lastSentTrail.set(playerId, {
        segments: trail.length,
        points: trail.length > 0 ? trail[trail.length - 1].length : 0,
    });

    return { delta, continues };
}

function buildGameState(roomCode: string): GameState | null {
    const room = getRoom(roomCode);
    if (!room) return null;

    const isFullSync = tickCounter % FULL_SYNC_INTERVAL === 0;

    const players = Array.from(room.players.values()).map((p) => {
        const trail = p.trail ?? [];
        let trailData: Array<Array<{ x: number; y: number }>>;
        let trailDeltaContinues = false;
        if (isFullSync) {
            trailData = trail;
        } else {
            const result = getDeltaTrail(p.id, trail);
            trailData = result.delta;
            trailDeltaContinues = result.continues;
        }
        return {
            id: p.id,
            name: p.name,
            score: p.score ?? 0,
            socketId: p.socketId,
            color: p.color,
            alive: p.alive,
            x: p.x,
            y: p.y,
            direction: p.direction,
            speed: p.speed,
            trail: trailData,
            trailFull: isFullSync,
            trailDeltaContinues,
        };
    });
    return {
        tick: Date.now(),
        arena: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
        },
        players,
    };
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

function detectCollisions(
    players: Player[],
    skipGraceTickCount: number,
): Set<string> {
    // Skip collision check during grace period after round restart
    if (skipGraceTickCount > 0) return new Set();

    const collisionRadius = 5;
    const deadPlayers = new Set<string>();

    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const p = players[playerIndex];
        if (!p.alive) continue;

        // Check player-to-player collision
        for (
            let otherPlayerIndex = playerIndex + 1;
            otherPlayerIndex < players.length;
            otherPlayerIndex++
        ) {
            const other = players[otherPlayerIndex];
            if (!other.alive) continue;
            const dx = p.x - other.x;
            const dy = p.y - other.y;
            const distSq = dx * dx + dy * dy;
            // Players collide if they're within 10px of each other
            if (distSq < 100) {
                deadPlayers.add(p.id);
                deadPlayers.add(other.id);
            }
        }

        // Check collision with opponent trails only (not own trail)
        for (const otherPlayer of players) {
            if (otherPlayer.id === p.id) continue; // Skip own trails entirely
            if (!Array.isArray(otherPlayer.trail)) continue;

            for (let segIdx = 0; segIdx < otherPlayer.trail.length; segIdx++) {
                const segment = otherPlayer.trail[segIdx];
                if (!Array.isArray(segment) || segment.length === 0) continue;

                for (
                    let segmentPointIndex = 0;
                    segmentPointIndex < segment.length - 1;
                    segmentPointIndex++
                ) {
                    const pt1 = segment[segmentPointIndex];
                    const pt2 = segment[segmentPointIndex + 1];
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
                        deadPlayers.add(p.id);
                        break;
                    }
                }

                if (deadPlayers.has(p.id)) break;
            }

            if (deadPlayers.has(p.id)) break;
        }
    }

    return deadPlayers;
}

function restartRound(players: Player[]) {
    for (const p of players) {
        p.alive = true;
        p.x = Math.random() * GAME_WIDTH;
        p.y = Math.random() * GAME_HEIGHT;
        p.direction = Math.random() * Math.PI * 2;
        p.trail = [[]];
        p.distanceSinceLastGap = 0;
        p.gapInterval = 200 + Math.random() * 200;
        p.gapLength = 40 + Math.random() * 40;
        p.inGap = false;
        // Reset delta trail tracking so next emit sends fresh state
        lastSentTrail.delete(p.id);
    }
}

export function startGameLoop(roomCode: string, io: Server) {
    if (runningLoops.has(roomCode)) return;

    restartGraceMap.set(roomCode, 0);

    const tick = () => {
        const room = getRoom(roomCode);
        if (!room) return;

        const turnRate = 0.04;
        for (const p of room.players.values()) {
            if (!p.alive) continue;
            // Apply pending input (set by the "input" socket handler)
            if ((p as any).__inputLeft) p.direction -= turnRate;
            if ((p as any).__inputRight) p.direction += turnRate;
            movePlayer(p, GAME_WIDTH, GAME_HEIGHT);
        }

        // Decrement grace period counter
        let graceTicksRemaining = restartGraceMap.get(roomCode) ?? 0;
        if (graceTicksRemaining > 0) {
            graceTicksRemaining--;
            restartGraceMap.set(roomCode, graceTicksRemaining);
        }

        // Check for collisions and determine round winner
        const players = Array.from(room.players.values());
        const deadPlayerIds = detectCollisions(players, graceTicksRemaining);
        if (deadPlayerIds.size > 0) {
            for (const p of players) {
                if (deadPlayerIds.has(p.id)) {
                    p.alive = false;
                }
            }

            const alivePlayers = players.filter((player) => player.alive);
            if (alivePlayers.length <= 1 && players.length >= 2) {
                const winner = alivePlayers[0] ?? null;
                if (winner) {
                    winner.score = (winner.score ?? 0) + 1;
                }

                io.to(roomCode).emit("roundOver", {
                    winnerId: winner?.id ?? null,
                    leaderboard: players
                        .map((player) => ({
                            id: player.id,
                            name: player.name,
                            score: player.score ?? 0,
                        }))
                        .sort((a, b) => b.score - a.score),
                });

                restartRound(players);
                restartGraceMap.set(roomCode, restartGracePeriod);
                io.to(roomCode).emit("roundRestart");
            }
        }

        tickCounter++;
        const state = buildGameState(roomCode);
        if (state) {
            io.to(roomCode).volatile.emit("gameState", state);
        }
    };

    const handle = setInterval(tick, MS_PER_TICK);
    runningLoops.set(roomCode, handle);
}

export function cleanupPlayerTrailTracking(playerId: string) {
    lastSentTrail.delete(playerId);
}

export function stopGameLoop(roomCode: string) {
    const handle = runningLoops.get(roomCode);
    if (handle) {
        clearInterval(handle);
        runningLoops.delete(roomCode);
    }
}
