import { Server } from "socket.io";
import { getRoom } from "./rooms";
import { GameState, Player } from "./types";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";

const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

const runningLoops = new Map<string, NodeJS.Timeout>();
const restartGracePeriod = 30; // ticks to prevent immediate re-collision after restart
const restartGraceMap = new Map<string, number>();
const ROUND_START_NO_TRAIL_TICKS = 120;
const roundStartNoTrailMap = new Map<string, number>();
const ROUND_RESTART_DELAY_MS = 2000;
const pendingRoundRestartMap = new Map<string, NodeJS.Timeout>();
const SPAWN_WALL_MARGIN = 60;

function randomCoordinateAwayFromWalls(arenaSize: number, wallMargin: number) {
    const usableSize = arenaSize - wallMargin * 2;
    if (usableSize <= 0) {
        return arenaSize / 2;
    }
    return wallMargin + Math.random() * usableSize;
}

export function generateSpawnPosition() {
    return {
        x: randomCoordinateAwayFromWalls(GAME_WIDTH, SPAWN_WALL_MARGIN),
        y: randomCoordinateAwayFromWalls(GAME_HEIGHT, SPAWN_WALL_MARGIN),
    };
}

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

function movePlayer(
    p: Player,
    width: number,
    height: number,
    suppressTrail: boolean,
) {
    const speed = p.speed ?? 2.5;
    // simple forward movement using direction (radians)
    const oldX = p.x;
    const oldY = p.y;
    const rawNextX = oldX + Math.cos(p.direction) * speed;
    const rawNextY = oldY + Math.sin(p.direction) * speed;

    p.x = rawNextX;
    p.y = rawNextY;

    if (suppressTrail) {
        p.trail = [[]];
        p.distanceSinceLastGap = 0;
        p.gapStartDistance = 0;
        p.inGap = false;
        return;
    }

    // Trail/gap logic
    if (!Array.isArray(p.trail) || p.trail.length === 0) p.trail = [[]];
    if (typeof p.distanceSinceLastGap !== "number") p.distanceSinceLastGap = 0;
    if (typeof p.gapInterval !== "number")
        p.gapInterval = 200 + Math.random() * 200;
    if (typeof p.gapLength !== "number") p.gapLength = 40 + Math.random() * 40;
    if (typeof p.inGap !== "boolean") p.inGap = false;
    if (typeof p.gapStartDistance !== "number") p.gapStartDistance = 0;

    // Distance moved
    const deltaX = p.x - oldX;
    const deltaY = p.y - oldY;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
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
        if (dist > 2) {
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
        score: p.score ?? 0,
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
): { deadPlayers: Set<string>; deathReasons: Map<string, string[]> } {
    // Skip collision check during grace period after round restart
    if (skipGraceTickCount > 0) {
        return {
            deadPlayers: new Set(),
            deathReasons: new Map(),
        };
    }

    const collisionRadius = 5;
    const selfCollisionIgnoreDistance = 60;
    const deadPlayers = new Set<string>();
    const deathReasonSets = new Map<string, Set<string>>();

    const markDead = (playerId: string, reason: string) => {
        deadPlayers.add(playerId);
        if (!deathReasonSets.has(playerId)) {
            deathReasonSets.set(playerId, new Set());
        }
        deathReasonSets.get(playerId)!.add(reason);
    };

    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const p = players[playerIndex];
        if (!p.alive) continue;

        if (p.x < 0 || p.x >= GAME_WIDTH || p.y < 0 || p.y >= GAME_HEIGHT) {
            markDead(p.id, "wall");
            continue;
        }

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
                markDead(p.id, `player:${other.id}`);
                markDead(other.id, `player:${p.id}`);
            }
        }

        // Check collision with all trails, including own trail
        for (const otherPlayer of players) {
            if (!Array.isArray(otherPlayer.trail)) continue;

            const isSelf = otherPlayer.id === p.id;
            const selfSkipFromBySegment = new Map<number, number>();

            if (isSelf) {
                let remainingIgnoreDistance = selfCollisionIgnoreDistance;

                for (
                    let reverseSegmentIndex = otherPlayer.trail.length - 1;
                    reverseSegmentIndex >= 0 && remainingIgnoreDistance > 0;
                    reverseSegmentIndex--
                ) {
                    const reverseSegment =
                        otherPlayer.trail[reverseSegmentIndex];
                    if (
                        !Array.isArray(reverseSegment) ||
                        reverseSegment.length < 2
                    ) {
                        continue;
                    }

                    let skipFromEdgeIndex = reverseSegment.length - 1;
                    for (
                        let edgeIndex = reverseSegment.length - 2;
                        edgeIndex >= 0;
                        edgeIndex--
                    ) {
                        const firstPoint = reverseSegment[edgeIndex];
                        const secondPoint = reverseSegment[edgeIndex + 1];
                        if (!firstPoint || !secondPoint) continue;

                        const dx = secondPoint.x - firstPoint.x;
                        const dy = secondPoint.y - firstPoint.y;
                        remainingIgnoreDistance -= Math.sqrt(dx * dx + dy * dy);
                        skipFromEdgeIndex = edgeIndex;

                        if (remainingIgnoreDistance <= 0) {
                            break;
                        }
                    }

                    selfSkipFromBySegment.set(
                        reverseSegmentIndex,
                        skipFromEdgeIndex,
                    );
                }
            }

            for (let segIdx = 0; segIdx < otherPlayer.trail.length; segIdx++) {
                const segment = otherPlayer.trail[segIdx];
                if (!Array.isArray(segment) || segment.length === 0) continue;
                const selfSkipFromSegmentIndex =
                    selfSkipFromBySegment.get(segIdx);

                for (
                    let segmentPointIndex = 0;
                    segmentPointIndex < segment.length - 1;
                    segmentPointIndex++
                ) {
                    if (
                        isSelf &&
                        typeof selfSkipFromSegmentIndex === "number" &&
                        segmentPointIndex >= selfSkipFromSegmentIndex
                    ) {
                        continue;
                    }

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
                        markDead(
                            p.id,
                            isSelf ? "self-trail" : `trail:${otherPlayer.id}`,
                        );
                        break;
                    }
                }

                if (deadPlayers.has(p.id)) break;
            }

            if (deadPlayers.has(p.id)) break;
        }
    }

    const deathReasons = new Map<string, string[]>();
    for (const [playerId, reasons] of deathReasonSets.entries()) {
        deathReasons.set(playerId, Array.from(reasons));
    }

    return { deadPlayers, deathReasons };
}

export function restartRound(players: Player[]) {
    for (const p of players) {
        const spawn = generateSpawnPosition();
        p.alive = true;
        p.x = spawn.x;
        p.y = spawn.y;
        p.direction = Math.random() * Math.PI * 2;
        p.trail = [[]];
        p.distanceSinceLastGap = 0;
        p.gapInterval = 200 + Math.random() * 200;
        p.gapLength = 40 + Math.random() * 40;
        p.inGap = false;
    }
}

export function startGameLoop(roomCode: string, io: Server) {
    if (runningLoops.has(roomCode)) return;

    restartGraceMap.set(roomCode, restartGracePeriod);
    roundStartNoTrailMap.set(roomCode, ROUND_START_NO_TRAIL_TICKS);

    const tick = () => {
        const room = getRoom(roomCode);
        if (!room) return;

        const roundPaused = pendingRoundRestartMap.has(roomCode);
        if (roundPaused) {
            const state = buildGameState(roomCode);
            if (state) {
                io.to(roomCode).emit("gameState", state);
            }
            return;
        }

        const noTrailTicksRemaining = roundStartNoTrailMap.get(roomCode) ?? 0;
        const suppressTrailThisTick = noTrailTicksRemaining > 0;
        if (noTrailTicksRemaining > 0) {
            roundStartNoTrailMap.set(roomCode, noTrailTicksRemaining - 1);
        }

        for (const p of room.players.values()) {
            if (!p.alive) continue;
            movePlayer(p, GAME_WIDTH, GAME_HEIGHT, suppressTrailThisTick);
        }

        // Decrement grace period counter
        const graceTicksRemaining = restartGraceMap.get(roomCode) ?? 0;
        if (graceTicksRemaining > 0) {
            restartGraceMap.set(roomCode, graceTicksRemaining - 1);
        }

        // Check for collisions and determine round winner
        const players = Array.from(room.players.values());
        const { deadPlayers: deadPlayerIds, deathReasons } = detectCollisions(
            players,
            graceTicksRemaining,
        );
        if (deadPlayerIds.size > 0) {
            for (const p of players) {
                if (deadPlayerIds.has(p.id)) {
                    p.alive = false;
                    const reasons = deathReasons.get(p.id) ?? ["unknown"];
                    console.log(
                        `[death] room=${roomCode} player=${p.id} name="${p.name}" x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} reasons=${reasons.join("|")}`,
                    );
                }
            }

            const alivePlayers = players.filter((player) => player.alive);
            if (alivePlayers.length <= 1 && players.length >= 2) {
                if (!pendingRoundRestartMap.has(roomCode)) {
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

                    const restartHandle = setTimeout(() => {
                        pendingRoundRestartMap.delete(roomCode);
                        const latestRoom = getRoom(roomCode);
                        if (!latestRoom) return;

                        const latestPlayers = Array.from(
                            latestRoom.players.values(),
                        );
                        restartRound(latestPlayers);
                        restartGraceMap.set(roomCode, restartGracePeriod);
                        roundStartNoTrailMap.set(
                            roomCode,
                            ROUND_START_NO_TRAIL_TICKS,
                        );
                        io.to(roomCode).emit("roundRestart");
                    }, ROUND_RESTART_DELAY_MS);

                    pendingRoundRestartMap.set(roomCode, restartHandle);
                }
            }
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

    const restartHandle = pendingRoundRestartMap.get(roomCode);
    if (restartHandle) {
        clearTimeout(restartHandle);
        pendingRoundRestartMap.delete(roomCode);
    }

    restartGraceMap.delete(roomCode);
    roundStartNoTrailMap.delete(roomCode);
}
