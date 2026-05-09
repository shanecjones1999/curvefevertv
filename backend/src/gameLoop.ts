import { getRoom } from "./rooms";
import { TypedServer } from "./socket/events";
import {
    GameMode,
    GameState,
    GameStatePlayer,
    LeaderboardEntry,
    Player,
    Trail,
    TrailPoint,
    TrailSegmentUpdate,
} from "./types";
import {
    GAME_HEIGHT,
    GAME_WIDTH,
    MIN_SPAWN_DISTANCE,
    SPAWN_WALL_MARGIN,
} from "./config";
import { calculateTargetScore } from "./domain/gameRules";
import {
    buildBattleRoyaleLeaderboard,
    buildClassicLeaderboard,
} from "./domain/leaderboard";
import { buildTeamLeaderboard, getAliveTeamIds } from "./domain/teamMode";
import { emitLobbyUpdate } from "./socket/lobbyEmitter";

const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;
const STATE_BROADCAST_EVERY_N_TICKS = 3;
const PLAYER_TURN_RATE_PER_TICK = 0.045;
const LOOP_METRIC_SAMPLE_SIZE = 45;

const runningLoops = new Map<string, NodeJS.Timeout>();
const restartGracePeriod = 30; // ticks to prevent immediate re-collision after restart
const restartGraceMap = new Map<string, number>();
const roomTickCounterMap = new Map<string, number>();
const ROUND_START_NO_TRAIL_TICKS = 120;
const roundStartNoTrailMap = new Map<string, number>();
const ROUND_START_FREEZE_MS = 3000;
const roundStartFreezeUntilMap = new Map<string, number>();
const ROUND_RESTART_DELAY_MS = 5000;
const GAME_OVER_RETURN_DELAY_MS = 10000;
const pendingRoundRestartMap = new Map<string, NodeJS.Timeout>();
const pendingGameOverReturnMap = new Map<string, NodeJS.Timeout>();
const MAX_SPAWN_ATTEMPTS = 40;
const TRAIL_SPATIAL_HASH_CELL_SIZE = 64;
const emittedGameStatePlayerMap = new Map<string, Map<string, EmittedGameStatePlayer>>();
const loopLastTickAtMap = new Map<string, number>();
const loopIntervalSamplesMap = new Map<string, number[]>();

type TrailCollisionEdge = {
    ownerPlayerId: string;
    segmentIndex: number;
    pointIndex: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

type EmittedGameStatePlayer = {
    id: string;
    name: string;
    score: number;
    socketId: string | null;
    color?: string;
    teamId?: number;
    alive: boolean;
    x: number;
    y: number;
    direction: number;
    speed?: number;
    distanceSinceLastGap?: number;
    gapInterval?: number;
    gapLength?: number;
    inGap?: boolean;
    gapStartDistance?: number;
    trailSegmentLengths: number[];
};

function pushSample(samples: number[], value: number) {
    samples.push(value);
    if (samples.length > LOOP_METRIC_SAMPLE_SIZE) {
        samples.shift();
    }
}

function average(samples: number[]) {
    if (samples.length === 0) {
        return 0;
    }

    return samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
}

function standardDeviation(samples: number[]) {
    if (samples.length < 2) {
        return 0;
    }

    const mean = average(samples);
    const variance =
        samples.reduce(
            (sum, sample) => sum + (sample - mean) * (sample - mean),
            0,
        ) / samples.length;

    return Math.sqrt(variance);
}

function recordLoopTick(roomCode: string, now: number) {
    const previousTickAt = loopLastTickAtMap.get(roomCode);
    if (typeof previousTickAt === "number" && now >= previousTickAt) {
        const samples = loopIntervalSamplesMap.get(roomCode) ?? [];
        pushSample(samples, now - previousTickAt);
        loopIntervalSamplesMap.set(roomCode, samples);
    }

    loopLastTickAtMap.set(roomCode, now);
}

function buildServerLoopDiagnostics(roomCode: string) {
    const samples = loopIntervalSamplesMap.get(roomCode);
    if (!samples || samples.length === 0) {
        return undefined;
    }

    return {
        intervalMs: average(samples),
        jitterMs: standardDeviation(samples),
        sampleCount: samples.length,
    };
}

function clearPendingGameOverReturn(roomCode: string) {
    const handle = pendingGameOverReturnMap.get(roomCode);
    if (!handle) return;

    clearTimeout(handle);
    pendingGameOverReturnMap.delete(roomCode);
}

function scheduleLobbyReturn(roomCode: string, io: TypedServer) {
    clearPendingGameOverReturn(roomCode);

    const handle = setTimeout(() => {
        pendingGameOverReturnMap.delete(roomCode);

        const room = getRoom(roomCode);
        if (!room || room.state !== "finished") {
            return;
        }

        restartRound(Array.from(room.players.values()));
        room.state = "lobby";
        room.battleRoyaleEliminatedPlayerIds = new Set<string>();
        room.roundStartScoreById = {};
        emitLobbyUpdate(io, room.code);
    }, GAME_OVER_RETURN_DELAY_MS);

    pendingGameOverReturnMap.set(roomCode, handle);
}

function emitFinalGameOver(
    roomCode: string,
    io: TypedServer,
    payload: {
        winnerId: string | null;
        gameMode: GameMode;
        targetScore?: number;
        teamCount?: number;
        leaderboard: LeaderboardEntry[];
    },
) {
    emitGameState(roomCode, io, { forceFullSnapshot: true });
    io.to(roomCode).emit("gameOver", payload);
}

function randomCoordinateAwayFromWalls(arenaSize: number, wallMargin: number) {
    const usableSize = arenaSize - wallMargin * 2;
    if (usableSize <= 0) {
        return arenaSize / 2;
    }
    return wallMargin + Math.random() * usableSize;
}

function distanceSquared(
    first: { x: number; y: number },
    second: { x: number; y: number },
) {
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    return dx * dx + dy * dy;
}

function getClosestSpawnDistanceSquared(
    candidate: { x: number; y: number },
    occupiedSpawnPositions: Array<{ x: number; y: number }>,
) {
    if (occupiedSpawnPositions.length === 0) {
        return Number.POSITIVE_INFINITY;
    }

    let closestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const occupiedSpawnPosition of occupiedSpawnPositions) {
        closestDistanceSquared = Math.min(
            closestDistanceSquared,
            distanceSquared(candidate, occupiedSpawnPosition),
        );
    }

    return closestDistanceSquared;
}

function randomSpawnPosition() {
    return {
        x: randomCoordinateAwayFromWalls(GAME_WIDTH, SPAWN_WALL_MARGIN),
        y: randomCoordinateAwayFromWalls(GAME_HEIGHT, SPAWN_WALL_MARGIN),
    };
}

export function generateSpawnPosition(
    occupiedSpawnPositions: Array<{ x: number; y: number }> = [],
) {
    const minAllowedDistanceSquared = MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE;
    let fallbackSpawnPosition = randomSpawnPosition();
    let fallbackDistanceSquared = getClosestSpawnDistanceSquared(
        fallbackSpawnPosition,
        occupiedSpawnPositions,
    );

    for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
        const candidateSpawnPosition = randomSpawnPosition();
        const closestDistanceSquared = getClosestSpawnDistanceSquared(
            candidateSpawnPosition,
            occupiedSpawnPositions,
        );

        if (closestDistanceSquared >= minAllowedDistanceSquared) {
            return candidateSpawnPosition;
        }

        if (closestDistanceSquared > fallbackDistanceSquared) {
            fallbackSpawnPosition = candidateSpawnPosition;
            fallbackDistanceSquared = closestDistanceSquared;
        }
    }

    return fallbackSpawnPosition;
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
        p.isFloating = true;
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

    p.isFloating = p.inGap;

    // Add trail point if not in gap
    if (!p.inGap) {
        if (dist > 2) {
            appendTrailPoint(p, p.x, p.y);
        }
    }
}

export function buildGameState(roomCode: string): GameState | null {
    return buildGameStatePayload(roomCode, true);
}

function cloneTrailPoint(point: TrailPoint): TrailPoint {
    return { x: point.x, y: point.y };
}

function cloneTrail(trail?: Trail): Trail | undefined {
    return trail?.map((segment) => segment.map(cloneTrailPoint));
}

function buildGameStatePlayer(player: Player, trail?: Trail): GameStatePlayer {
    return {
        id: player.id,
        name: player.name,
        score: player.score ?? 0,
        socketId: player.socketId,
        color: player.color,
        teamId: player.teamId,
        alive: player.alive,
        x: player.x,
        y: player.y,
        direction: player.direction,
        speed: player.speed,
        trail,
        distanceSinceLastGap: player.distanceSinceLastGap,
        gapInterval: player.gapInterval,
        gapLength: player.gapLength,
        inGap: player.inGap,
        gapStartDistance: player.gapStartDistance,
    };
}

function getPlayerTrailSegmentLengths(player: Player) {
    return Array.isArray(player.trail)
        ? player.trail.map((segment) => (Array.isArray(segment) ? segment.length : 0))
        : [];
}

function buildEmittedGameStatePlayer(player: Player): EmittedGameStatePlayer {
    return {
        id: player.id,
        name: player.name,
        score: player.score ?? 0,
        socketId: player.socketId,
        color: player.color,
        teamId: player.teamId,
        alive: player.alive,
        x: player.x,
        y: player.y,
        direction: player.direction,
        speed: player.speed,
        distanceSinceLastGap: player.distanceSinceLastGap,
        gapInterval: player.gapInterval,
        gapLength: player.gapLength,
        inGap: player.inGap,
        gapStartDistance: player.gapStartDistance,
        trailSegmentLengths: getPlayerTrailSegmentLengths(player),
    };
}

function isPlayerStateChanged(
    previousPlayer: EmittedGameStatePlayer | undefined,
    player: Player,
) {
    if (!previousPlayer) {
        return true;
    }

    return (
        previousPlayer.name !== player.name ||
        previousPlayer.score !== (player.score ?? 0) ||
        previousPlayer.socketId !== player.socketId ||
        previousPlayer.color !== player.color ||
        previousPlayer.teamId !== player.teamId ||
        previousPlayer.alive !== player.alive ||
        previousPlayer.x !== player.x ||
        previousPlayer.y !== player.y ||
        previousPlayer.direction !== player.direction ||
        previousPlayer.speed !== player.speed ||
        previousPlayer.distanceSinceLastGap !== player.distanceSinceLastGap ||
        previousPlayer.gapInterval !== player.gapInterval ||
        previousPlayer.gapLength !== player.gapLength ||
        previousPlayer.inGap !== player.inGap ||
        previousPlayer.gapStartDistance !== player.gapStartDistance
    );
}

function buildTrailSegmentUpdates(
    previousPlayer: EmittedGameStatePlayer | undefined,
    player: Player,
) {
    const currentTrail = Array.isArray(player.trail) ? player.trail : [];
    if (!previousPlayer) {
        return {
            reset: true,
            trail: cloneTrail(currentTrail) ?? [],
        };
    }

    const previousSegmentLengths = previousPlayer.trailSegmentLengths;
    if (currentTrail.length < previousSegmentLengths.length) {
        return {
            reset: true,
            trail: cloneTrail(currentTrail) ?? [],
        };
    }

    const segments: TrailSegmentUpdate[] = [];
    for (let segmentIndex = 0; segmentIndex < currentTrail.length; segmentIndex++) {
        const segment = currentTrail[segmentIndex];
        if (!Array.isArray(segment)) {
            continue;
        }

        const previousLength = previousSegmentLengths[segmentIndex] ?? 0;
        if (segment.length < previousLength) {
            return {
                reset: true,
                trail: cloneTrail(currentTrail) ?? [],
            };
        }

        if (segment.length === previousLength) {
            continue;
        }

        segments.push({
            index: segmentIndex,
            points: segment.slice(previousLength).map(cloneTrailPoint),
        });
    }

    return segments.length > 0
        ? {
              reset: false,
              segments,
          }
        : null;
}

function buildGameStatePayload(
    roomCode: string,
    forceFullSnapshot = false,
): GameState | null {
    const room = getRoom(roomCode);
    if (!room) return null;
    const roundStartFreezeUntil = roundStartFreezeUntilMap.get(roomCode) ?? 0;
    const roundStartRemainingMs = Math.max(
        0,
        roundStartFreezeUntil - Date.now(),
    );
    const roomPlayers = Array.from(room.players.values());
    const previousPlayers = emittedGameStatePlayerMap.get(roomCode) ?? new Map();
    const nextPlayers = new Map<string, EmittedGameStatePlayer>();
    const removedPlayerIds = Array.from(previousPlayers.keys()).filter(
        (playerId) => !room.players.has(playerId),
    );
    const shouldSendFullSnapshot =
        forceFullSnapshot ||
        previousPlayers.size === 0 ||
        roomPlayers.some((player) => {
            const trailUpdate = buildTrailSegmentUpdates(
                previousPlayers.get(player.id),
                player,
            );
            return !previousPlayers.has(player.id) || Boolean(trailUpdate?.reset);
        });

    const players: GameStatePlayer[] = [];

    for (const player of roomPlayers) {
        const previousPlayer = previousPlayers.get(player.id);
        nextPlayers.set(player.id, buildEmittedGameStatePlayer(player));

        if (shouldSendFullSnapshot) {
            players.push(buildGameStatePlayer(player, cloneTrail(player.trail)));
            continue;
        }

        const trailUpdate = buildTrailSegmentUpdates(previousPlayer, player);
        const playerChanged =
            isPlayerStateChanged(previousPlayer, player) || trailUpdate !== null;
        if (!playerChanged) {
            continue;
        }

        const nextPlayer = buildGameStatePlayer(player);
        if (trailUpdate?.segments) {
            nextPlayer.trailUpdate = { segments: trailUpdate.segments };
        }
        players.push(nextPlayer);
    }

    emittedGameStatePlayerMap.set(roomCode, nextPlayers);

    return {
        tick: Date.now(),
        arena: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
        },
        players,
        isDelta: !shouldSendFullSnapshot,
        removedPlayerIds:
            !shouldSendFullSnapshot && removedPlayerIds.length > 0
                ? removedPlayerIds
                : undefined,
        gameMode: room.gameMode,
        targetScore:
            room.gameMode === "battle-royale"
                ? undefined
                : room.targetScore ??
                  calculateTargetScore(
                      room.gameMode === "teams"
                          ? buildTeamLeaderboard(Array.from(room.players.values()))
                                .length
                          : room.players.size,
                  ),
        teamCount: room.teamCount,
        roundStartRemainingMs,
        serverLoopDiagnostics: buildServerLoopDiagnostics(roomCode),
    };
}

function emitGameState(
    roomCode: string,
    io: TypedServer,
    options?: { forceFullSnapshot?: boolean },
) {
    const state = buildGameStatePayload(roomCode, options?.forceFullSnapshot);
    if (state) {
        io.to(roomCode).emit("gameState", state);
    }
}

function buildRoundStartScoreMap(room: {
    gameMode: GameMode;
    players: Map<string, Player>;
}) {
    const players = Array.from(room.players.values());

    if (room.gameMode === "teams") {
        return Object.fromEntries(
            buildTeamLeaderboard(players).map((entry) => [entry.id, entry.score ?? 0]),
        );
    }

    return Object.fromEntries(
        players.map((player) => [player.id, player.score ?? 0]),
    );
}

export function getPendingRoundOverPayload(roomCode: string) {
    const room = getRoom(roomCode);
    if (!room || !pendingRoundRestartMap.has(roomCode)) {
        return undefined;
    }

    const players = Array.from(room.players.values());

    if (room.gameMode === "battle-royale") {
        const eliminatedPlayerIds =
            room.battleRoyaleEliminatedPlayerIds ?? new Set<string>();
        const survivingPlayers = players.filter(
            (player) => !eliminatedPlayerIds.has(player.id),
        );

        if (survivingPlayers.length <= 1) {
            return undefined;
        }

        return {
            winnerId: null,
            gameMode: room.gameMode,
            eliminatedPlayerIds: Array.from(eliminatedPlayerIds),
            scoreBeforeById: room.roundStartScoreById,
        };
    }

    if (room.gameMode === "teams") {
        const sortedLeaderboard = buildTeamLeaderboard(players);
        const aliveTeamIds = new Set(
            getAliveTeamIds(players.filter((player) => player.alive)),
        );

        if (aliveTeamIds.size > 1 || sortedLeaderboard.length < 1) {
            return undefined;
        }

        const winningTeamId = Array.from(aliveTeamIds)[0];

        return {
            winnerId:
                typeof winningTeamId === "number"
                    ? `team-${winningTeamId}`
                    : null,
            gameMode: room.gameMode,
            leaderboard: sortedLeaderboard,
            scoreBeforeById: room.roundStartScoreById,
        };
    }

    const alivePlayers = players.filter((player) => player.alive);

    if (alivePlayers.length > 1 || players.length < 1) {
        return undefined;
    }

    const winner = alivePlayers[0] ?? null;

    return {
        winnerId: winner?.id ?? null,
        gameMode: room.gameMode,
        leaderboard: players
            .map((player) => ({
                id: player.id,
                name: player.name,
                score: player.score ?? 0,
            }))
            .sort((firstPlayer, secondPlayer) => {
                return (
                    secondPlayer.score - firstPlayer.score ||
                    firstPlayer.name.localeCompare(secondPlayer.name)
                );
            }),
        scoreBeforeById: room.roundStartScoreById,
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

function getTrailSpatialHashKey(cellX: number, cellY: number) {
    return `${cellX},${cellY}`;
}

function getTrailSpatialHashCellRange(min: number, max: number) {
    return {
        start: Math.floor(min / TRAIL_SPATIAL_HASH_CELL_SIZE),
        end: Math.floor(max / TRAIL_SPATIAL_HASH_CELL_SIZE),
    };
}

function buildTrailSpatialHash(players: Player[]) {
    const trailSpatialHash = new Map<string, TrailCollisionEdge[]>();

    for (const player of players) {
        if (!Array.isArray(player.trail)) continue;

        for (
            let segmentIndex = 0;
            segmentIndex < player.trail.length;
            segmentIndex++
        ) {
            const segment = player.trail[segmentIndex];
            if (!Array.isArray(segment) || segment.length < 2) continue;

            for (
                let pointIndex = 0;
                pointIndex < segment.length - 1;
                pointIndex++
            ) {
                const firstPoint = segment[pointIndex];
                const secondPoint = segment[pointIndex + 1];
                if (!firstPoint || !secondPoint) continue;

                const minX = Math.min(firstPoint.x, secondPoint.x);
                const maxX = Math.max(firstPoint.x, secondPoint.x);
                const minY = Math.min(firstPoint.y, secondPoint.y);
                const maxY = Math.max(firstPoint.y, secondPoint.y);

                const edge: TrailCollisionEdge = {
                    ownerPlayerId: player.id,
                    segmentIndex,
                    pointIndex,
                    x1: firstPoint.x,
                    y1: firstPoint.y,
                    x2: secondPoint.x,
                    y2: secondPoint.y,
                    minX,
                    maxX,
                    minY,
                    maxY,
                };

                const xRange = getTrailSpatialHashCellRange(minX, maxX);
                const yRange = getTrailSpatialHashCellRange(minY, maxY);

                for (let cellX = xRange.start; cellX <= xRange.end; cellX++) {
                    for (let cellY = yRange.start; cellY <= yRange.end; cellY++) {
                        const key = getTrailSpatialHashKey(cellX, cellY);
                        const cellEdges = trailSpatialHash.get(key);
                        if (cellEdges) {
                            cellEdges.push(edge);
                            continue;
                        }

                        trailSpatialHash.set(key, [edge]);
                    }
                }
            }
        }
    }

    return trailSpatialHash;
}

function getNearbyTrailCollisionEdges(
    trailSpatialHash: Map<string, TrailCollisionEdge[]>,
    x: number,
    y: number,
    collisionRadius: number,
) {
    const xRange = getTrailSpatialHashCellRange(x - collisionRadius, x + collisionRadius);
    const yRange = getTrailSpatialHashCellRange(y - collisionRadius, y + collisionRadius);
    const nearbyEdges = new Set<TrailCollisionEdge>();

    for (let cellX = xRange.start; cellX <= xRange.end; cellX++) {
        for (let cellY = yRange.start; cellY <= yRange.end; cellY++) {
            const cellEdges = trailSpatialHash.get(getTrailSpatialHashKey(cellX, cellY));
            if (!cellEdges) continue;

            for (const edge of cellEdges) {
                nearbyEdges.add(edge);
            }
        }
    }

    return nearbyEdges;
}

function buildSelfCollisionSkipMap(
    player: Player,
    selfCollisionIgnoreDistance: number,
) {
    const selfSkipFromBySegment = new Map<number, number>();
    if (!Array.isArray(player.trail)) {
        return selfSkipFromBySegment;
    }

    let remainingIgnoreDistance = selfCollisionIgnoreDistance;

    for (
        let reverseSegmentIndex = player.trail.length - 1;
        reverseSegmentIndex >= 0 && remainingIgnoreDistance > 0;
        reverseSegmentIndex--
    ) {
        const reverseSegment = player.trail[reverseSegmentIndex];
        if (!Array.isArray(reverseSegment) || reverseSegment.length < 2) {
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

        selfSkipFromBySegment.set(reverseSegmentIndex, skipFromEdgeIndex);
    }

    return selfSkipFromBySegment;
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
    const trailSpatialHash = buildTrailSpatialHash(players);

    const markDead = (playerId: string, reason: string) => {
        deadPlayers.add(playerId);
        if (!deathReasonSets.has(playerId)) {
            deathReasonSets.set(playerId, new Set());
        }
        deathReasonSets.get(playerId)!.add(reason);
    };

    const isPlayerFloating = (player: Player) =>
        Boolean(player.isFloating || player.inGap);

    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const p = players[playerIndex];
        if (!p.alive) continue;
        const playerIsFloating = isPlayerFloating(p);

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
            if (playerIsFloating || isPlayerFloating(other)) continue;
            const dx = p.x - other.x;
            const dy = p.y - other.y;
            const distSq = dx * dx + dy * dy;
            // Players collide if they're within 10px of each other
            if (distSq < 100) {
                markDead(p.id, `player:${other.id}`);
                markDead(other.id, `player:${p.id}`);
            }
        }

        if (playerIsFloating) {
            continue;
        }

        const selfSkipFromBySegment = buildSelfCollisionSkipMap(
            p,
            selfCollisionIgnoreDistance,
        );
        const nearbyEdges = getNearbyTrailCollisionEdges(
            trailSpatialHash,
            p.x,
            p.y,
            collisionRadius,
        );

        for (const edge of nearbyEdges) {
            const isSelf = edge.ownerPlayerId === p.id;
            const selfSkipFromSegmentIndex = selfSkipFromBySegment.get(
                edge.segmentIndex,
            );
            if (
                isSelf &&
                typeof selfSkipFromSegmentIndex === "number" &&
                edge.pointIndex >= selfSkipFromSegmentIndex
            ) {
                continue;
            }

            if (
                p.x < edge.minX - collisionRadius ||
                p.x > edge.maxX + collisionRadius ||
                p.y < edge.minY - collisionRadius ||
                p.y > edge.maxY + collisionRadius
            ) {
                continue;
            }

            const dist = distanceToLineSegment(
                p.x,
                p.y,
                edge.x1,
                edge.y1,
                edge.x2,
                edge.y2,
            );
            if (dist < collisionRadius) {
                markDead(
                    p.id,
                    isSelf ? "self-trail" : `trail:${edge.ownerPlayerId}`,
                );
                break;
            }
        }
    }

    const deathReasons = new Map<string, string[]>();
    for (const [playerId, reasons] of deathReasonSets.entries()) {
        deathReasons.set(playerId, Array.from(reasons));
    }

    return { deadPlayers, deathReasons };
}

export function restartRound(
    players: Player[],
    options?: { battleRoyaleEliminatedPlayerIds?: Set<string> },
) {
    const eliminatedIds = options?.battleRoyaleEliminatedPlayerIds;
    const occupiedSpawnPositions: Array<{ x: number; y: number }> = [];

    for (const p of players) {
        const isEliminated = eliminatedIds?.has(p.id) ?? false;
        if (isEliminated) {
            p.alive = false;
            p.trail = [[]];
            p.isFloating = false;
            p.turnLeftHeld = false;
            p.turnRightHeld = false;
            continue;
        }

        const spawn = generateSpawnPosition(occupiedSpawnPositions);
        occupiedSpawnPositions.push(spawn);
        p.alive = true;
        p.x = spawn.x;
        p.y = spawn.y;
        p.direction = Math.random() * Math.PI * 2;
        p.trail = [[]];
        p.distanceSinceLastGap = 0;
        p.gapInterval = 200 + Math.random() * 200;
        p.gapLength = 40 + Math.random() * 40;
        p.inGap = false;
        p.isFloating = false;
        p.turnLeftHeld = false;
        p.turnRightHeld = false;
    }
}

export function startGameLoop(roomCode: string, io: TypedServer) {
    if (runningLoops.has(roomCode)) return;

    clearPendingGameOverReturn(roomCode);

    const room = getRoom(roomCode);
    if (room) {
        room.roundStartScoreById = buildRoundStartScoreMap(room);
    }

    restartGraceMap.set(roomCode, restartGracePeriod);
    roundStartNoTrailMap.set(roomCode, ROUND_START_NO_TRAIL_TICKS);
    roundStartFreezeUntilMap.set(roomCode, Date.now() + ROUND_START_FREEZE_MS);
    roomTickCounterMap.set(roomCode, 0);

    const tick = () => {
        recordLoopTick(roomCode, Date.now());
        const room = getRoom(roomCode);
        if (!room) return;

        const currentTickCount = (roomTickCounterMap.get(roomCode) ?? 0) + 1;
        roomTickCounterMap.set(roomCode, currentTickCount);
        const shouldBroadcastState =
            currentTickCount === 1 ||
            currentTickCount % STATE_BROADCAST_EVERY_N_TICKS === 0;

        const roundRestartPending = pendingRoundRestartMap.has(roomCode);

        const roundStartRemainingMs =
            (roundStartFreezeUntilMap.get(roomCode) ?? 0) - Date.now();
        if (roundStartRemainingMs > 0) {
            if (shouldBroadcastState) {
                emitGameState(roomCode, io);
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

            if (p.turnLeftHeld && !p.turnRightHeld) {
                p.direction -= PLAYER_TURN_RATE_PER_TICK;
            } else if (p.turnRightHeld && !p.turnLeftHeld) {
                p.direction += PLAYER_TURN_RATE_PER_TICK;
            }

            movePlayer(p, GAME_WIDTH, GAME_HEIGHT, suppressTrailThisTick);
        }

        // Decrement grace period counter
        const graceTicksRemaining = restartGraceMap.get(roomCode) ?? 0;
        if (graceTicksRemaining > 0) {
            restartGraceMap.set(roomCode, graceTicksRemaining - 1);
        }

        const players = Array.from(room.players.values());
        const aliveTeamIdsBeforeDeath = new Set(
            getAliveTeamIds(players.filter((player) => player.alive)),
        );
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
        }

        if (roundRestartPending) {
            if (room.gameMode === "battle-royale" && deadPlayerIds.size > 0) {
                const eliminatedPlayerIds =
                    room.battleRoyaleEliminatedPlayerIds ?? new Set<string>();
                room.battleRoyaleEliminatedPlayerIds = eliminatedPlayerIds;
                for (const deadPlayerId of deadPlayerIds) {
                    eliminatedPlayerIds.add(deadPlayerId);
                }

                const survivingPlayers = players.filter(
                    (player) => !eliminatedPlayerIds.has(player.id),
                );

                if (survivingPlayers.length <= 1) {
                    const winner = survivingPlayers[0] ?? null;
                    const sortedLeaderboard = buildBattleRoyaleLeaderboard(
                        players,
                        eliminatedPlayerIds,
                    );

                    room.state = "finished";
                    emitFinalGameOver(roomCode, io, {
                        winnerId: winner?.id ?? null,
                        gameMode: room.gameMode,
                        leaderboard: sortedLeaderboard,
                    });
                    stopGameLoop(roomCode);
                    scheduleLobbyReturn(roomCode, io);
                    return;
                }
            }

            if (shouldBroadcastState || deadPlayerIds.size > 0) {
                emitGameState(roomCode, io);
            }
            return;
        }

        // Check for collisions and determine round winner
        if (deadPlayerIds.size > 0) {
            const isBattleRoyale = room.gameMode === "battle-royale";
            const isTeamMode = room.gameMode === "teams";

            if (isBattleRoyale) {
                const eliminatedPlayerIds =
                    room.battleRoyaleEliminatedPlayerIds ?? new Set<string>();
                room.battleRoyaleEliminatedPlayerIds = eliminatedPlayerIds;
                for (const deadPlayerId of deadPlayerIds) {
                    eliminatedPlayerIds.add(deadPlayerId);
                }

                const survivingPlayers = players.filter(
                    (player) => !eliminatedPlayerIds.has(player.id),
                );

                if (survivingPlayers.length <= 1) {
                    const winner = survivingPlayers[0] ?? null;
                    const sortedLeaderboard = buildBattleRoyaleLeaderboard(
                        players,
                        eliminatedPlayerIds,
                    );

                    room.state = "finished";
                    emitFinalGameOver(roomCode, io, {
                        winnerId: winner?.id ?? null,
                        gameMode: room.gameMode,
                        leaderboard: sortedLeaderboard,
                    });
                    stopGameLoop(roomCode);
                    scheduleLobbyReturn(roomCode, io);
                    return;
                }

                if (!pendingRoundRestartMap.has(roomCode)) {
                    io.to(roomCode).emit("roundOver", {
                        winnerId: null,
                        gameMode: room.gameMode,
                        eliminatedPlayerIds: Array.from(eliminatedPlayerIds),
                        scoreBeforeById: room.roundStartScoreById,
                    });

                    const restartHandle = setTimeout(() => {
                        pendingRoundRestartMap.delete(roomCode);
                        const latestRoom = getRoom(roomCode);
                        if (!latestRoom) return;

                        const latestPlayers = Array.from(
                            latestRoom.players.values(),
                        );
                        restartRound(latestPlayers, {
                            battleRoyaleEliminatedPlayerIds:
                                latestRoom.battleRoyaleEliminatedPlayerIds,
                        });
                        latestRoom.roundStartScoreById =
                            buildRoundStartScoreMap(latestRoom);
                        restartGraceMap.set(roomCode, restartGracePeriod);
                        roundStartNoTrailMap.set(
                            roomCode,
                            ROUND_START_NO_TRAIL_TICKS,
                        );
                        roundStartFreezeUntilMap.set(
                            roomCode,
                            Date.now() + ROUND_START_FREEZE_MS,
                        );
                        io.to(roomCode).emit("roundRestart");
                        emitGameState(roomCode, io, { forceFullSnapshot: true });
                    }, ROUND_RESTART_DELAY_MS);

                    pendingRoundRestartMap.set(roomCode, restartHandle);
                }

                if (shouldBroadcastState) {
                    emitGameState(roomCode, io);
                }
                return;
            }

            if (isTeamMode) {
                const aliveTeamIds = new Set(
                    getAliveTeamIds(players.filter((player) => player.alive)),
                );
                const newlyEliminatedTeamIds = Array.from(
                    aliveTeamIdsBeforeDeath,
                ).filter((teamId) => !aliveTeamIds.has(teamId));

                if (newlyEliminatedTeamIds.length > 0 && aliveTeamIds.size > 0) {
                    for (const player of players) {
                        if (
                            typeof player.teamId === "number" &&
                            aliveTeamIds.has(player.teamId)
                        ) {
                            player.score =
                                (player.score ?? 0) +
                                newlyEliminatedTeamIds.length;
                        }
                    }
                }

                const sortedLeaderboard = buildTeamLeaderboard(players);
                const targetScore =
                    room.targetScore ??
                    calculateTargetScore(sortedLeaderboard.length);
                room.targetScore = targetScore;

                if (sortedLeaderboard.some((team) => team.score >= targetScore)) {
                    room.state = "finished";
                    emitFinalGameOver(roomCode, io, {
                        winnerId: sortedLeaderboard[0]?.id ?? null,
                        gameMode: room.gameMode,
                        targetScore,
                        teamCount: room.teamCount,
                        leaderboard: sortedLeaderboard,
                    });
                    stopGameLoop(roomCode);
                    scheduleLobbyReturn(roomCode, io);
                    return;
                }

                if (aliveTeamIds.size <= 1 && sortedLeaderboard.length >= 1) {
                    if (!pendingRoundRestartMap.has(roomCode)) {
                        const winningTeamId = Array.from(aliveTeamIds)[0];

                        io.to(roomCode).emit("roundOver", {
                            winnerId:
                                typeof winningTeamId === "number"
                                    ? `team-${winningTeamId}`
                                    : null,
                            gameMode: room.gameMode,
                            leaderboard: sortedLeaderboard,
                            scoreBeforeById: room.roundStartScoreById,
                        });

                        const restartHandle = setTimeout(() => {
                            pendingRoundRestartMap.delete(roomCode);
                            const latestRoom = getRoom(roomCode);
                            if (!latestRoom) return;

                            const latestPlayers = Array.from(
                                latestRoom.players.values(),
                            );
                            restartRound(latestPlayers);
                            latestRoom.roundStartScoreById =
                                buildRoundStartScoreMap(latestRoom);
                            restartGraceMap.set(roomCode, restartGracePeriod);
                            roundStartNoTrailMap.set(
                                roomCode,
                                ROUND_START_NO_TRAIL_TICKS,
                            );
                            roundStartFreezeUntilMap.set(
                                roomCode,
                                Date.now() + ROUND_START_FREEZE_MS,
                            );
                            io.to(roomCode).emit("roundRestart");
                            emitGameState(roomCode, io, {
                                forceFullSnapshot: true,
                            });
                        }, ROUND_RESTART_DELAY_MS);

                        pendingRoundRestartMap.set(roomCode, restartHandle);
                    }
                }

                if (shouldBroadcastState) {
                    emitGameState(roomCode, io);
                }
                return;
            }

            const alivePlayers = players.filter((player) => player.alive);
            if (alivePlayers.length > 0) {
                const pointsPerAlivePlayer = deadPlayerIds.size;
                for (const alivePlayer of alivePlayers) {
                    alivePlayer.score =
                        (alivePlayer.score ?? 0) + pointsPerAlivePlayer;
                }
            }

            if (players.length === 1) {
                players[0].score = (players[0].score ?? 0) + 1;
            }

            const targetScore =
                room.targetScore ?? calculateTargetScore(players.length);
            room.targetScore = targetScore;
            const playersAtOrAboveTarget = players.filter(
                (player) => (player.score ?? 0) >= targetScore,
            );
            if (playersAtOrAboveTarget.length > 0) {
                const sortedLeaderboard = buildClassicLeaderboard(players);

                room.state = "finished";
                emitFinalGameOver(roomCode, io, {
                    winnerId: sortedLeaderboard[0]?.id ?? null,
                    gameMode: room.gameMode,
                    targetScore,
                    leaderboard: sortedLeaderboard,
                });
                stopGameLoop(roomCode);
                scheduleLobbyReturn(roomCode, io);
                return;
            }

            if (alivePlayers.length <= 1 && players.length >= 1) {
                if (!pendingRoundRestartMap.has(roomCode)) {
                    const winner = alivePlayers[0] ?? null;

                    io.to(roomCode).emit("roundOver", {
                        winnerId: winner?.id ?? null,
                        leaderboard: players
                            .map((player) => ({
                                id: player.id,
                                name: player.name,
                                score: player.score ?? 0,
                            }))
                            .sort((a, b) => b.score - a.score),
                        scoreBeforeById: room.roundStartScoreById,
                    });

                    const restartHandle = setTimeout(() => {
                        pendingRoundRestartMap.delete(roomCode);
                        const latestRoom = getRoom(roomCode);
                        if (!latestRoom) return;

                        const latestPlayers = Array.from(
                            latestRoom.players.values(),
                        );
                        restartRound(latestPlayers);
                        latestRoom.roundStartScoreById =
                            buildRoundStartScoreMap(latestRoom);
                        restartGraceMap.set(roomCode, restartGracePeriod);
                        roundStartNoTrailMap.set(
                            roomCode,
                            ROUND_START_NO_TRAIL_TICKS,
                        );
                        roundStartFreezeUntilMap.set(
                            roomCode,
                            Date.now() + ROUND_START_FREEZE_MS,
                        );
                        io.to(roomCode).emit("roundRestart");
                        emitGameState(roomCode, io, {
                            forceFullSnapshot: true,
                        });
                    }, ROUND_RESTART_DELAY_MS);

                    pendingRoundRestartMap.set(roomCode, restartHandle);
                }
            }
        }

        if (shouldBroadcastState) {
            emitGameState(roomCode, io);
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
    roundStartFreezeUntilMap.delete(roomCode);
    roomTickCounterMap.delete(roomCode);
    emittedGameStatePlayerMap.delete(roomCode);
    loopLastTickAtMap.delete(roomCode);
    loopIntervalSamplesMap.delete(roomCode);
    clearPendingGameOverReturn(roomCode);
}
