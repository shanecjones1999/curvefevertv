import { useEffect, useRef } from "react";
import socket from "../socket";
import { EVENTS } from "../events";
import { HOST_SESSION_KEY } from "../constants/storage";
import type {
    GameMode,
    GameState,
    GameStatePlayer,
    HostMotionState,
    LeaderboardEntry,
    Player,
    ServerLagDiagnostics,
    Trail,
} from "../types";
import type {
    GameConfig,
    GameOverPayload,
    RoundOverPayload,
} from "../components/host/types";
import { buildTeamLeaderboard } from "../utils/teamMode";

const LIVE_UI_PLAYER_SYNC_INTERVAL_MS = 100;

type ReconnectHostResponse = {
    ok: boolean;
    roomCode?: string;
    players?: Player[];
    state?: "lobby" | "playing" | "finished";
    gameMode?: GameMode;
    winnerId?: string | null;
    leaderboard?: GameOverPayload["leaderboard"];
    roundOver?: RoundOverPayload;
    targetScore?: number;
    teamCount?: number;
    gameConfig?: GameConfig;
    error?: string;
};

type UseHostRoomSyncParams = {
    setRoomCode: React.Dispatch<React.SetStateAction<string | null>>;
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
    setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setStartError: React.Dispatch<React.SetStateAction<string | null>>;
    setTargetScore: React.Dispatch<React.SetStateAction<number | null>>;
    setGameMode: React.Dispatch<React.SetStateAction<GameMode>>;
    setTeamCount: React.Dispatch<React.SetStateAction<number>>;
    setRoundStartRemainingMs: React.Dispatch<React.SetStateAction<number>>;
    setGameOverData: React.Dispatch<
        React.SetStateAction<GameOverPayload | null>
    >;
    setRoundOverData: React.Dispatch<
        React.SetStateAction<RoundOverPayload | null>
    >;
    setGameConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    livePlayersRef?: React.MutableRefObject<Player[]>;
    onServerLagDiagnostics?: (
        diagnostics: ServerLagDiagnostics | null,
    ) => void;
    onPlayerJoined?: (player: Player) => void;
    autoCreateRoom?: boolean;
};

export function useHostRoomSync({
    setRoomCode,
    setPlayers,
    setPlaying,
    setStartError,
    setTargetScore,
    setGameMode,
    setTeamCount,
    setRoundStartRemainingMs,
    setGameOverData,
    setRoundOverData,
    setGameConfig,
    livePlayersRef,
    onServerLagDiagnostics,
    onPlayerJoined,
    autoCreateRoom = true,
}: UseHostRoomSyncParams) {
    const latestPlayersRef = useRef<Player[]>([]);
    const pendingUiPlayersRef = useRef<Player[] | null>(null);
    const uiPlayersSyncTimeoutRef = useRef<number | null>(null);
    const isPlayingRef = useRef(false);
    const gameStateLastReceivedAtRef = useRef<number | null>(null);
    const gameStateLastTickRef = useRef<number | null>(null);
    const gameStateArrivalIntervalsRef = useRef<number[]>([]);
    const gameStateTickDeltasRef = useRef<number[]>([]);
    const gameStateTrailPointSamplesRef = useRef<number[]>([]);
    const gameStateLastDiagnosticsEmitAtRef = useRef(0);

    useEffect(() => {
        const METRIC_SAMPLE_SIZE = 45;
        const DIAGNOSTIC_EMIT_INTERVAL_MS = 250;

        const pushSample = (samples: number[], value: number) => {
            samples.push(value);
            if (samples.length > METRIC_SAMPLE_SIZE) {
                samples.shift();
            }
        };

        const average = (samples: number[]) => {
            if (samples.length === 0) return 0;
            return samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
        };

        const standardDeviation = (samples: number[]) => {
            if (samples.length < 2) return 0;
            const mean = average(samples);
            const variance =
                samples.reduce(
                    (sum, sample) => sum + (sample - mean) * (sample - mean),
                    0,
                ) / samples.length;
            return Math.sqrt(variance);
        };

        const getTrailPointsFromState = (state: GameState) => {
            let totalTrailPoints = 0;
            for (const player of state.players) {
                if (Array.isArray(player.trail)) {
                    for (const segment of player.trail) {
                        totalTrailPoints += segment.length;
                    }
                    continue;
                }

                if (player.trailUpdate?.segments) {
                    for (const segment of player.trailUpdate.segments) {
                        totalTrailPoints += segment.points.length;
                    }
                }
            }
            return totalTrailPoints;
        };

        const resetServerLagDiagnostics = () => {
            gameStateLastReceivedAtRef.current = null;
            gameStateLastTickRef.current = null;
            gameStateArrivalIntervalsRef.current = [];
            gameStateTickDeltasRef.current = [];
            gameStateTrailPointSamplesRef.current = [];
            gameStateLastDiagnosticsEmitAtRef.current = 0;
            onServerLagDiagnostics?.(null);
        };

        const collectServerLagDiagnostics = (state: GameState) => {
            const now = performance.now();
            const previousReceivedAt = gameStateLastReceivedAtRef.current;
            const previousTick = gameStateLastTickRef.current;

            if (typeof previousReceivedAt === "number") {
                pushSample(
                    gameStateArrivalIntervalsRef.current,
                    now - previousReceivedAt,
                );
            }
            gameStateLastReceivedAtRef.current = now;

            if (
                typeof previousTick === "number" &&
                Number.isFinite(state.tick) &&
                state.tick >= previousTick
            ) {
                pushSample(
                    gameStateTickDeltasRef.current,
                    state.tick - previousTick,
                );
            }
            gameStateLastTickRef.current = state.tick;

            pushSample(
                gameStateTrailPointSamplesRef.current,
                getTrailPointsFromState(state),
            );

            if (
                now - gameStateLastDiagnosticsEmitAtRef.current <
                DIAGNOSTIC_EMIT_INTERVAL_MS
            ) {
                return;
            }

            gameStateLastDiagnosticsEmitAtRef.current = now;

            const updateIntervalMs = average(gameStateArrivalIntervalsRef.current);
            const updateRateHz = updateIntervalMs > 0 ? 1000 / updateIntervalMs : 0;
            const jitterMs = standardDeviation(gameStateArrivalIntervalsRef.current);
            const tickDelta = average(gameStateTickDeltasRef.current);
            const trailPointsPerUpdate = average(
                gameStateTrailPointSamplesRef.current,
            );
            const sampleCount = Math.max(
                gameStateArrivalIntervalsRef.current.length,
                gameStateTickDeltasRef.current.length,
                gameStateTrailPointSamplesRef.current.length,
            );

            onServerLagDiagnostics?.({
                updateIntervalMs,
                updateRateHz,
                jitterMs,
                tickDelta,
                serverLoopIntervalMs: state.serverLoopDiagnostics?.intervalMs,
                serverLoopJitterMs: state.serverLoopDiagnostics?.jitterMs,
                serverLoopSampleCount: state.serverLoopDiagnostics?.sampleCount,
                payloadPlayers: state.players.length,
                trailPointsPerUpdate,
                sampleCount,
            });
        };

        const cloneTrail = (trail?: Trail) =>
            trail?.map((segment) => segment.map((point) => ({ ...point })));

        const clonePlayer = (player: Player): Player => ({
            ...player,
            trail: cloneTrail(player.trail),
        });

        const clonePlayers = (players: Player[]) =>
            players.map((player) => clonePlayer(player));

        const stripTrailForUi = (player: Player): Player => {
            const { trail, ...rest } = player;
            void trail;
            return rest;
        };

        const buildUiPlayers = (players: Player[]) =>
            players.map((player) => stripTrailForUi(player));

        const toPlayerFromGameState = (player: GameStatePlayer): Player => {
            const { trailUpdate, ...rest } = player;
            void trailUpdate;
            return {
                ...rest,
                trail: cloneTrail(player.trail),
            };
        };

        const mergePlayerFromGameState = (
            existingPlayer: Player | undefined,
            playerUpdate: GameStatePlayer,
        ): Player => {
            const { trailUpdate, trail, ...rest } = playerUpdate;
            const nextPlayer: Player = existingPlayer ?? { ...rest, trail: [] };
            Object.assign(nextPlayer, rest);

            if (trail) {
                nextPlayer.trail = cloneTrail(trail);
                return nextPlayer;
            }

            if (!trailUpdate?.segments?.length) {
                if (!existingPlayer) {
                    nextPlayer.trail = [];
                }
                return nextPlayer;
            }

            const nextTrail = nextPlayer.trail ?? [];
            for (const segmentUpdate of trailUpdate.segments) {
                const nextSegment =
                    nextTrail[segmentUpdate.index] ??
                    (nextTrail[segmentUpdate.index] = []);
                nextSegment.push(
                    ...segmentUpdate.points.map((point) => ({ ...point })),
                );
            }
            nextPlayer.trail = nextTrail;
            return nextPlayer;
        };

        const clearScheduledUiPlayerSync = () => {
            if (uiPlayersSyncTimeoutRef.current === null) {
                return;
            }

            window.clearTimeout(uiPlayersSyncTimeoutRef.current);
            uiPlayersSyncTimeoutRef.current = null;
        };

        const flushUiPlayers = () => {
            clearScheduledUiPlayerSync();
            if (!pendingUiPlayersRef.current) {
                return;
            }

            setPlayers(buildUiPlayers(pendingUiPlayersRef.current));
            pendingUiPlayersRef.current = null;
        };

        const commitPlayers = (
            nextPlayers: Player[],
            options?: { immediateUi?: boolean },
        ) => {
            latestPlayersRef.current = nextPlayers;
            if (livePlayersRef) {
                livePlayersRef.current = nextPlayers;
            }

            if (options?.immediateUi || !isPlayingRef.current) {
                pendingUiPlayersRef.current = null;
                clearScheduledUiPlayerSync();
                setPlayers(buildUiPlayers(nextPlayers));
                return nextPlayers;
            }

            pendingUiPlayersRef.current = nextPlayers;
            if (uiPlayersSyncTimeoutRef.current === null) {
                uiPlayersSyncTimeoutRef.current = window.setTimeout(() => {
                    flushUiPlayers();
                }, LIVE_UI_PLAYER_SYNC_INTERVAL_MS);
            }

            return nextPlayers;
        };

        const applyPlayers = (
            players: Player[],
            options?: { immediateUi?: boolean },
        ) => {
            const nextPlayers = clonePlayers(players);
            return commitPlayers(nextPlayers, options);
        };

        const applyGameStatePlayers = (state: GameState) => {
            const previousPlayers = latestPlayersRef.current;
            if (!state.isDelta) {
                const nextPlayers = state.players.map((player) =>
                    toPlayerFromGameState(player),
                );
                commitPlayers(nextPlayers);
                return;
            }

            const removedPlayerIds = new Set(state.removedPlayerIds ?? []);
            const nextPlayers = previousPlayers
                .filter((player) => !removedPlayerIds.has(player.id))
                .map((player) => player);
            const playerIndexById = new Map(
                nextPlayers.map((player, index) => [player.id, index]),
            );

            for (const playerUpdate of state.players) {
                const playerIndex = playerIndexById.get(playerUpdate.id);
                const existingPlayer =
                    typeof playerIndex === "number"
                        ? nextPlayers[playerIndex]
                        : undefined;
                const nextPlayer = mergePlayerFromGameState(
                    existingPlayer,
                    playerUpdate,
                );

                if (typeof playerIndex === "number") {
                    nextPlayers[playerIndex] = nextPlayer;
                    continue;
                }

                playerIndexById.set(playerUpdate.id, nextPlayers.length);
                nextPlayers.push(nextPlayer);
            }

            commitPlayers(nextPlayers);
        };

        const applyHostMotionState = (state: HostMotionState) => {
            const previousPlayers = latestPlayersRef.current;
            if (previousPlayers.length === 0 || !livePlayersRef) {
                return;
            }

            const nextPlayers = previousPlayers.map((player) => player);
            const playerIndexById = new Map(
                nextPlayers.map((player, index) => [player.id, index]),
            );

            for (const playerMotion of state.players) {
                const existingIndex = playerIndexById.get(playerMotion.id);
                const existingPlayer =
                    typeof existingIndex === "number"
                        ? nextPlayers[existingIndex]
                        : undefined;

                if (!existingPlayer) {
                    playerIndexById.set(playerMotion.id, nextPlayers.length);
                    nextPlayers.push({
                        ...playerMotion,
                        trail: [],
                    });
                    continue;
                }

                existingPlayer.name = playerMotion.name;
                existingPlayer.score = playerMotion.score;
                existingPlayer.socketId = playerMotion.socketId;
                existingPlayer.color = playerMotion.color;
                existingPlayer.teamId = playerMotion.teamId;
                existingPlayer.alive = playerMotion.alive;
                existingPlayer.x = playerMotion.x;
                existingPlayer.y = playerMotion.y;
                existingPlayer.direction = playerMotion.direction;
                existingPlayer.speed = playerMotion.speed;
            }

            latestPlayersRef.current = nextPlayers;
            livePlayersRef.current = nextPlayers;
        };

        const applyGameConfig = (incoming?: GameConfig) => {
            if (!incoming) return;
            if (incoming.width <= 0 || incoming.height <= 0) return;
            setGameConfig((current) => {
                if (
                    current.width === incoming.width &&
                    current.height === incoming.height
                ) {
                    return current;
                }

                return {
                    width: incoming.width,
                    height: incoming.height,
                };
            });
        };

        const applyRoundStartRemainingMs = (incoming?: number) => {
            const nextRemainingMs = Math.max(0, incoming ?? 0);
            setRoundStartRemainingMs((current) => {
                const currentCountdown =
                    current > 0 ? Math.ceil(current / 1000) : 0;
                const nextCountdown =
                    nextRemainingMs > 0 ? Math.ceil(nextRemainingMs / 1000) : 0;
                return currentCountdown === nextCountdown
                    ? current
                    : nextRemainingMs;
            });
        };

        const applyPlayingState = (nextPlaying: boolean) => {
            isPlayingRef.current = nextPlaying;
            if (!nextPlaying) {
                flushUiPlayers();
                resetServerLagDiagnostics();
            }
            setPlaying(nextPlaying);
        };

        const applyTargetScore = (incoming?: number) => {
            if (typeof incoming !== "number") return;
            if (!Number.isFinite(incoming) || incoming <= 0) return;
            setTargetScore(Math.floor(incoming));
        };

        const applyGameMode = (incoming?: GameMode) => {
            if (incoming === "battle-royale") {
                setGameMode("battle-royale");
                return;
            }
            if (incoming === "teams") {
                setGameMode("teams");
                return;
            }
            if (incoming === "classic") {
                setGameMode("classic");
            }
        };

        const applyTeamCount = (incoming?: number) => {
            if (typeof incoming !== "number") return;
            if (!Number.isInteger(incoming) || incoming < 2 || incoming > 5) {
                return;
            }
            setTeamCount(incoming);
        };

        const buildFallbackLeaderboard = (
            players: Player[],
            gameMode?: GameMode,
        ): LeaderboardEntry[] => {
            if (gameMode === "teams") {
                return buildTeamLeaderboard(players);
            }

            return players
                .map((player) => ({
                    id: player.id,
                    name: player.name,
                    score: player.score ?? 0,
                    color: player.color,
                    alive: player.alive,
                    socketId: player.socketId,
                    teamId: player.teamId,
                    kind: "player" as const,
                }))
                .sort(
                    (firstPlayer, secondPlayer) =>
                        (gameMode === "battle-royale"
                            ? Number(secondPlayer.alive) -
                              Number(firstPlayer.alive)
                            : secondPlayer.score - firstPlayer.score) ||
                        firstPlayer.name.localeCompare(secondPlayer.name),
                );
        };

        const buildScoreMap = (
            players: Player[],
            gameMode?: GameMode,
        ): Record<string, number> => {
            return Object.fromEntries(
                buildFallbackLeaderboard(players, gameMode).map((entry) => [
                    entry.id,
                    entry.score ?? 0,
                ]),
            );
        };

        const reconnectFromSession = () => {
            const rawSession = localStorage.getItem(HOST_SESSION_KEY);
            if (!rawSession) {
                if (!autoCreateRoom) return;
                socket.emit(
                    EVENTS.CREATE_ROOM,
                    null,
                    (res: { roomCode: string; gameConfig?: GameConfig }) => {
                        if (!res?.roomCode) {
                            setStartError("Unable to create room");
                            return;
                        }
                        setRoomCode(res.roomCode);
                        if (res.gameConfig) {
                            setGameConfig(res.gameConfig);
                        }
                        setStartError(null);
                        localStorage.setItem(
                            HOST_SESSION_KEY,
                            JSON.stringify({ roomCode: res.roomCode }),
                        );
                    },
                );
                return;
            }
            try {
                const session = JSON.parse(rawSession) as { roomCode?: string };
                if (!session.roomCode) {
                    localStorage.removeItem(HOST_SESSION_KEY);
                    setRoomCode(null);
                    return;
                }
                socket.emit(
                    "reconnectHost",
                    { roomCode: session.roomCode },
                    (res: ReconnectHostResponse) => {
                        if (res?.ok) {
                            setRoomCode(
                                (res.roomCode ?? session.roomCode ?? null) as
                                    | string
                                    | null,
                            );
                            if (Array.isArray(res.players)) {
                                applyPlayers(res.players, { immediateUi: true });
                            }
                            applyGameMode(res.gameMode);
                            applyTargetScore(res.targetScore);
                            applyTeamCount(res.teamCount);
                            applyGameConfig(res.gameConfig);
                            if (res.state === "finished") {
                                setRoundOverData(null);
                                applyRoundStartRemainingMs(0);
                                const fallbackLeaderboard =
                                    buildFallbackLeaderboard(
                                        res.players ?? [],
                                        res.gameMode,
                                    );
                                setGameOverData({
                                    winnerId:
                                        res.winnerId ??
                                        res.leaderboard?.[0]?.id ??
                                        fallbackLeaderboard[0]?.id ??
                                        null,
                                    gameMode: res.gameMode,
                                    targetScore: res.targetScore,
                                    teamCount: res.teamCount,
                                    leaderboard:
                                        res.leaderboard ?? fallbackLeaderboard,
                                 });
                                applyPlayingState(true);
                            } else {
                                setGameOverData(null);
                                setRoundOverData(
                                    res.state === "playing"
                                        ? res.roundOver ?? null
                                        : null,
                                );
                                if (res.state !== "playing") {
                                    applyRoundStartRemainingMs(0);
                                }
                                applyPlayingState(res.state === "playing");
                            }
                        } else {
                            localStorage.removeItem(HOST_SESSION_KEY);
                            setRoomCode(null);
                            setStartError(
                                res?.error ??
                                    "Unable to reconnect host session",
                            );
                        }
                    },
                );
            } catch {
                localStorage.removeItem(HOST_SESSION_KEY);
            }
        };

        socket.on("roomCreated", (data: { roomCode: string }) => {
            setRoomCode(data.roomCode);
        });

        socket.on("playerJoined", (data: { player: Player }) => {
            onPlayerJoined?.(data.player);
            applyPlayers([...latestPlayersRef.current, { ...data.player }], {
                immediateUi: true,
            });
        });

        socket.on(
            "lobbyUpdate",
            (data: {
                players: Player[];
                gameMode?: GameMode;
                targetScore?: number;
                teamCount?: number;
                gameConfig?: GameConfig;
            }) => {
                applyPlayingState(false);
                applyPlayers(data.players, { immediateUi: true });
                applyGameMode(data.gameMode);
                applyTargetScore(data.targetScore);
                applyTeamCount(data.teamCount);
                applyGameConfig(data.gameConfig);
                setRoundOverData(null);
                applyRoundStartRemainingMs(0);
            },
        );

        socket.on(
            "startGame",
            (data?: {
                gameMode?: GameMode;
                targetScore?: number;
                teamCount?: number;
                gameConfig?: GameConfig;
            }) => {
                applyGameMode(data?.gameMode);
                applyTargetScore(data?.targetScore);
                applyTeamCount(data?.teamCount);
                applyGameConfig(data?.gameConfig);
                setGameOverData(null);
                setRoundOverData(null);
                applyPlayingState(true);
            },
        );

        socket.on(
            EVENTS.GAME_STATE,
            (state?: GameState) => {
                if (!state) return;

                collectServerLagDiagnostics(state);
                if (state?.arena) {
                    applyGameConfig(state.arena);
                }
                applyGameMode(state?.gameMode);
                applyTargetScore(state?.targetScore);
                applyTeamCount(state?.teamCount);
                applyRoundStartRemainingMs(state?.roundStartRemainingMs);
                if (Array.isArray(state.players)) {
                    applyGameStatePlayers(state);
                }
            },
        );

        socket.on(EVENTS.HOST_MOTION_STATE, (state?: HostMotionState) => {
            if (!state) return;
            applyHostMotionState(state);
        });

        socket.on(
            EVENTS.ROUND_OVER,
            (data?: RoundOverPayload) => {
                if (!data) return;
                applyRoundStartRemainingMs(0);
                setRoundOverData({
                    ...data,
                    scoreBeforeById:
                        data.scoreBeforeById ??
                        buildScoreMap(latestPlayersRef.current, data.gameMode),
                });
            },
        );

        socket.on(EVENTS.GAME_OVER, (data?: GameOverPayload) => {
            applyGameMode(data?.gameMode);
            applyTargetScore(data?.targetScore);
            applyTeamCount(data?.teamCount);
            setRoundOverData(null);
            if (data?.leaderboard && Array.isArray(data.leaderboard)) {
                setGameOverData(data);
            }
            applyRoundStartRemainingMs(0);
            applyPlayingState(true);
        });

        socket.on(EVENTS.ROUND_RESTART, () => {
            setRoundOverData(null);
        });

        socket.on("connect", reconnectFromSession);
        reconnectFromSession();

        return () => {
            socket.off("roomCreated");
            socket.off("playerJoined");
            socket.off("lobbyUpdate");
            socket.off("startGame");
            socket.off(EVENTS.GAME_STATE);
            socket.off(EVENTS.HOST_MOTION_STATE);
            socket.off(EVENTS.ROUND_OVER);
            socket.off(EVENTS.GAME_OVER);
            socket.off(EVENTS.ROUND_RESTART);
            socket.off("connect", reconnectFromSession);
            clearScheduledUiPlayerSync();
        };
    }, [
        setRoomCode,
        setPlayers,
        setPlaying,
        setStartError,
        setTargetScore,
        setGameMode,
        setTeamCount,
        setRoundStartRemainingMs,
        setGameOverData,
        setRoundOverData,
        setGameConfig,
        livePlayersRef,
        onServerLagDiagnostics,
        onPlayerJoined,
        autoCreateRoom,
    ]);
}
