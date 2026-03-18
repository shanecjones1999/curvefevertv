import { useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { EVENTS } from "./events";
import type { GameMode, Player } from "./types";
import PhaserGame from "./PhaserGame";
import { DEFAULT_GAME_HEIGHT, DEFAULT_GAME_WIDTH } from "./gameConfig";

const HOST_SESSION_KEY = "curvefever:hostSession";

type ReconnectHostResponse = {
    ok: boolean;
    roomCode?: string;
    players?: Player[];
    state?: "lobby" | "playing" | "finished";
    gameMode?: GameMode;
    targetScore?: number;
    gameConfig?: GameConfig;
    error?: string;
};

type StartGameResponse = {
    ok: boolean;
    gameMode?: GameMode;
    targetScore?: number;
    gameConfig?: GameConfig;
    error?: string;
};

type SetGameModeResponse = {
    ok: boolean;
    gameMode?: GameMode;
    error?: string;
};

type TelemetryPingResponse = {
    clientSentAt: number | null;
    serverRecvAt: number;
    serverSendAt: number;
};

type GameOverLeaderboardEntry = {
    id: string;
    name: string;
    score: number;
    color?: string;
};

type GameOverPayload = {
    winnerId: string | null;
    gameMode?: GameMode;
    targetScore?: number;
    leaderboard: GameOverLeaderboardEntry[];
};

type GameConfig = {
    width: number;
    height: number;
};

type Props = { onLeave: () => void };

const PLAYER_COLORS = [
    "#e6194b",
    "#3cb44b",
    "#ffe119",
    "#4363d8",
    "#f58231",
    "#911eb4",
    "#46f0f0",
    "#f032e6",
    "#bcf60c",
    "#fabebe",
    "#008080",
    "#e6beff",
    "#9a6324",
    "#fffac8",
    "#800000",
    "#aaffc3",
    "#808000",
    "#ffd8b1",
    "#000075",
    "#808080",
    "#ffffff",
    "#000000",
];

const PLAYER_COLOR_CLASS_BY_HEX: Record<string, string> = PLAYER_COLORS.reduce(
    (map, color, index) => {
        map[color.toLowerCase()] = `bar-color-${index}`;
        return map;
    },
    {} as Record<string, string>,
);

const DISCONNECTED_DOT_COLOR = "#8f98ad";

export default function Host({ onLeave }: Props) {
    const [roomCode, setRoomCode] = useState<string | null>(() => {
        const raw = localStorage.getItem(HOST_SESSION_KEY);
        if (!raw) return null;
        try {
            const session = JSON.parse(raw) as { roomCode?: string };
            return session.roomCode ?? null;
        } catch {
            return null;
        }
    });
    const [players, setPlayers] = useState<Player[]>([]);
    const [playing, setPlaying] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState(false);
    const [targetScore, setTargetScore] = useState<number | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>("classic");
    const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(
        null,
    );
    const [gameConfig, setGameConfig] = useState<GameConfig>({
        width: DEFAULT_GAME_WIDTH,
        height: DEFAULT_GAME_HEIGHT,
    });
    const [latencyRttMs, setLatencyRttMs] = useState<number | null>(null);
    const [latencyOneWayMs, setLatencyOneWayMs] = useState<number | null>(null);
    const [serverProcessingMs, setServerProcessingMs] = useState<number | null>(
        null,
    );
    const [telemetryStatus, setTelemetryStatus] = useState<
        "ok" | "timeout" | "disconnected"
    >("disconnected");
    const hasRequestedRoomCreation = useRef(false);

    const playerColorById = useMemo(() => {
        const colorById = new Map<string, string>();
        players.forEach((player, index) => {
            const fallbackColor = PLAYER_COLORS[index % PLAYER_COLORS.length];
            const hasValidHexColor =
                typeof player.color === "string" && /^#/.test(player.color);
            colorById.set(
                player.id,
                hasValidHexColor ? player.color! : fallbackColor,
            );
        });
        return colorById;
    }, [players]);

    const getPlayerRowClassName = (player: Player) => {
        const classes = ["player-row"];
        if (!player.socketId) {
            classes.push("player-row-disconnected");
        }
        if (!player.alive) {
            classes.push("player-row-eliminated");
        }
        return classes.join(" ");
    };

    const getPlayerDotColor = (player: Player) => {
        if (!player.socketId) {
            return DISCONNECTED_DOT_COLOR;
        }
        return playerColorById.get(player.id) ?? PLAYER_COLORS[0];
    };

    const getBarColorClassName = (color: string | undefined, index: number) => {
        const normalizedColor = color?.toLowerCase();
        if (normalizedColor && PLAYER_COLOR_CLASS_BY_HEX[normalizedColor]) {
            return PLAYER_COLOR_CLASS_BY_HEX[normalizedColor];
        }
        return `bar-color-${index % PLAYER_COLORS.length}`;
    };

    const leaderboard = useMemo(() => {
        return [...players].sort((firstPlayer, secondPlayer) => {
            if (gameMode === "battle-royale") {
                return (
                    Number(secondPlayer.alive) - Number(firstPlayer.alive) ||
                    firstPlayer.name.localeCompare(secondPlayer.name)
                );
            }

            return (
                secondPlayer.score - firstPlayer.score ||
                firstPlayer.name.localeCompare(secondPlayer.name)
            );
        });
    }, [gameMode, players]);
    const effectiveTargetScore =
        targetScore ?? Math.max(10, players.length * 10 - 10);
    const displayLeaderboard = useMemo(() => {
        const source =
            gameOverData?.leaderboard && gameOverData.leaderboard.length > 0
                ? gameOverData.leaderboard
                : leaderboard;

        return source.map((entry, index) => {
            const fallbackColor = PLAYER_COLORS[index % PLAYER_COLORS.length];
            const colorFromPlayer = playerColorById.get(entry.id);
            const hasValidEntryColor =
                typeof entry.color === "string" && /^#/.test(entry.color);
            return {
                ...entry,
                color:
                    (hasValidEntryColor ? entry.color : undefined) ??
                    colorFromPlayer ??
                    fallbackColor,
            };
        });
    }, [gameOverData, leaderboard, playerColorById]);
    const highestScore = displayLeaderboard[0]?.score ?? 0;
    const winnerName =
        displayLeaderboard.find((entry) => entry.id === gameOverData?.winnerId)
            ?.name ?? displayLeaderboard[0]?.name;

    useEffect(() => {
        const runTelemetryPing = () => {
            if (!socket.connected) {
                setTelemetryStatus("disconnected");
                setLatencyRttMs(null);
                setLatencyOneWayMs(null);
                setServerProcessingMs(null);
                return;
            }

            const clientSentAt = Date.now();
            socket
                .timeout(2500)
                .emit(
                    EVENTS.TELEMETRY_PING,
                    { clientSentAt },
                    (err: unknown, response?: TelemetryPingResponse) => {
                        if (err || !response) {
                            setTelemetryStatus("timeout");
                            return;
                        }

                        const now = Date.now();
                        const rttMs = Math.max(0, now - clientSentAt);
                        const processingMs = Math.max(
                            0,
                            response.serverSendAt - response.serverRecvAt,
                        );
                        const oneWayMs = Math.max(
                            0,
                            Math.round((rttMs - processingMs) / 2),
                        );

                        setTelemetryStatus("ok");
                        setLatencyRttMs(rttMs);
                        setLatencyOneWayMs(oneWayMs);
                        setServerProcessingMs(processingMs);
                    },
                );
        };

        runTelemetryPing();
        const intervalId = window.setInterval(runTelemetryPing, 3000);

        const handleDisconnect = () => {
            setTelemetryStatus("disconnected");
        };
        socket.on("disconnect", handleDisconnect);

        return () => {
            window.clearInterval(intervalId);
            socket.off("disconnect", handleDisconnect);
        };
    }, []);

    useEffect(() => {
        const applyGameConfig = (incoming?: GameConfig) => {
            if (!incoming) return;
            if (incoming.width <= 0 || incoming.height <= 0) return;
            setGameConfig({
                width: incoming.width,
                height: incoming.height,
            });
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
            if (incoming === "classic") {
                setGameMode("classic");
            }
        };

        const requestCreateRoom = () => {
            socket.emit(
                "createRoom",
                null,
                (res: { roomCode: string; gameConfig?: GameConfig }) => {
                    if (!res?.roomCode) {
                        hasRequestedRoomCreation.current = false;
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
        };

        const reconnectFromSession = () => {
            const rawSession = localStorage.getItem(HOST_SESSION_KEY);
            if (!rawSession) {
                if (!hasRequestedRoomCreation.current) {
                    hasRequestedRoomCreation.current = true;
                    requestCreateRoom();
                }
                return;
            }
            try {
                const session = JSON.parse(rawSession) as { roomCode?: string };
                if (!session.roomCode) return;
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
                                setPlayers(res.players);
                            }
                            applyGameMode(res.gameMode);
                            applyTargetScore(res.targetScore);
                            applyGameConfig(res.gameConfig);
                            if (res.state === "finished") {
                                const fallbackLeaderboard = (res.players ?? [])
                                    .map((player) => ({
                                        id: player.id,
                                        name: player.name,
                                        score: player.score ?? 0,
                                        color: player.color,
                                        alive: player.alive,
                                    }))
                                    .sort(
                                        (firstPlayer, secondPlayer) =>
                                            (res.gameMode === "battle-royale"
                                                ? Number(secondPlayer.alive) -
                                                  Number(firstPlayer.alive)
                                                : secondPlayer.score -
                                                  firstPlayer.score) ||
                                            firstPlayer.name.localeCompare(
                                                secondPlayer.name,
                                            ),
                                    );
                                setGameOverData({
                                    winnerId:
                                        fallbackLeaderboard[0]?.id ?? null,
                                    gameMode: res.gameMode,
                                    targetScore: res.targetScore,
                                    leaderboard: fallbackLeaderboard,
                                });
                                setPlaying(true);
                            } else {
                                setGameOverData(null);
                                setPlaying(res.state === "playing");
                            }
                        } else {
                            localStorage.removeItem(HOST_SESSION_KEY);
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
            setPlayers((p) => [...p, data.player]);
        });

        socket.on(
            "lobbyUpdate",
            (data: {
                players: Player[];
                gameMode?: GameMode;
                targetScore?: number;
                gameConfig?: GameConfig;
            }) => {
                setPlayers(data.players);
                applyGameMode(data.gameMode);
                applyTargetScore(data.targetScore);
                applyGameConfig(data.gameConfig);
            },
        );

        socket.on(
            "startGame",
            (data?: {
                gameMode?: GameMode;
                targetScore?: number;
                gameConfig?: GameConfig;
            }) => {
                applyGameMode(data?.gameMode);
                applyTargetScore(data?.targetScore);
                applyGameConfig(data?.gameConfig);
                setGameOverData(null);
                setPlaying(true);
            },
        );
        socket.on(
            EVENTS.GAME_STATE,
            (state?: {
                players?: Player[];
                gameMode?: GameMode;
                targetScore?: number;
                arena?: GameConfig;
            }) => {
                if (state?.arena) {
                    applyGameConfig(state.arena);
                }
                applyGameMode(state?.gameMode);
                applyTargetScore(state?.targetScore);
                if (state && Array.isArray(state.players)) {
                    setPlayers(state.players);
                }
            },
        );
        socket.on(EVENTS.GAME_OVER, (data?: GameOverPayload) => {
            applyGameMode(data?.gameMode);
            applyTargetScore(data?.targetScore);
            if (data?.leaderboard && Array.isArray(data.leaderboard)) {
                setGameOverData(data);
            }
            setPlaying(true);
        });
        socket.on(EVENTS.ROUND_RESTART, () => {
            // Silently restart, game state updates automatically
        });
        socket.on("connect", reconnectFromSession);
        reconnectFromSession();

        return () => {
            socket.off("roomCreated");
            socket.off("playerJoined");
            socket.off("lobbyUpdate");
            socket.off("startGame");
            socket.off(EVENTS.GAME_STATE);
            socket.off(EVENTS.GAME_OVER);
            socket.off(EVENTS.ROUND_RESTART);
            socket.off("connect", reconnectFromSession);
        };
    }, []);

    useEffect(() => {
        if (!copiedCode) return;
        const timeoutId = window.setTimeout(() => {
            setCopiedCode(false);
        }, 1500);
        return () => window.clearTimeout(timeoutId);
    }, [copiedCode]);

    function handleStartGame() {
        if (!roomCode) return;
        socket.emit(
            "startGame",
            { roomCode, gameMode },
            (res: StartGameResponse) => {
                if (res?.ok) {
                    setStartError(null);
                    setGameOverData(null);
                    if (res.gameMode) {
                        setGameMode(res.gameMode);
                    }
                    if (typeof res.targetScore === "number") {
                        setTargetScore(Math.floor(res.targetScore));
                    }
                    if (res.gameConfig) {
                        setGameConfig(res.gameConfig);
                    }
                    setPlaying(true);
                } else {
                    setStartError(res?.error ?? "Unable to start game");
                }
            },
        );
    }

    function handleGameModeChange(nextGameMode: GameMode) {
        setGameMode(nextGameMode);

        if (!roomCode || playing) return;

        socket.emit(
            EVENTS.SET_GAME_MODE,
            { roomCode, gameMode: nextGameMode },
            (res: SetGameModeResponse) => {
                if (!res?.ok) {
                    setStartError(res?.error ?? "Unable to update game mode");
                    return;
                }
                setStartError(null);
                if (res.gameMode) {
                    setGameMode(res.gameMode);
                }
            },
        );
    }

    function handleLeaveGame() {
        if (roomCode && !window.confirm("End session and leave the room?")) {
            return;
        }

        if (roomCode) {
            socket.emit(EVENTS.LEAVE_ROOM, { roomCode }, () => {});
        }

        localStorage.removeItem(HOST_SESSION_KEY);
        setRoomCode(null);
        setPlayers([]);
        setPlaying(false);
        onLeave();
    }

    async function handleCopyGameCode() {
        if (!roomCode) return;

        let copySucceeded = true;
        try {
            await navigator.clipboard.writeText(roomCode);
        } catch {
            try {
                const input = document.createElement("textarea");
                input.value = roomCode;
                input.setAttribute("readonly", "");
                input.style.position = "absolute";
                input.style.left = "-9999px";
                document.body.appendChild(input);
                input.select();
                document.execCommand("copy");
                document.body.removeChild(input);
            } catch {
                copySucceeded = false;
            }
        }

        if (copySucceeded) {
            setCopiedCode(true);
        }
    }

    const hostControls = (
        <>
            <div className="panel-header">
                <div>
                    <p className="eyebrow">Host Console</p>
                </div>
                <button
                    className="ui-button ui-button-ghost"
                    onClick={handleLeaveGame}
                >
                    Leave Game
                </button>
            </div>

            <div className="panel-row">
                <button
                    type="button"
                    className="status-pill room-code-pill room-code-button"
                    onClick={handleCopyGameCode}
                    disabled={!roomCode}
                    title={
                        roomCode
                            ? "Click to copy game code"
                            : "No game code available"
                    }
                >
                    <span className="room-code-label">
                        {copiedCode ? "Copied!" : "Game Code"}
                    </span>
                    <span className="room-code-value">
                        {roomCode ?? "------"}
                    </span>
                </button>
                <div className="status-pill target-score-pill" role="status">
                    {gameMode === "classic"
                        ? `Race to ${effectiveTargetScore} pts`
                        : "Battle Royale · Last player standing"}
                </div>
            </div>

            <div className="panel-row">
                <div className="status-pill" role="status">
                    {telemetryStatus === "ok"
                        ? `Latency RTT ${latencyRttMs ?? 0}ms · ~${latencyOneWayMs ?? 0}ms one-way · srv ${serverProcessingMs ?? 0}ms`
                        : telemetryStatus === "timeout"
                          ? "Latency check timeout"
                          : "Latency waiting for socket"}
                </div>
            </div>

            <div className="panel-row host-mode-row">
                <span className="host-mode-label">Game Mode</span>
                <div
                    className="host-mode-toggle"
                    role="group"
                    aria-label="Select game mode"
                >
                    <button
                        type="button"
                        className={`host-mode-option ${gameMode === "classic" ? "is-active" : ""}`}
                        onClick={() => handleGameModeChange("classic")}
                        disabled={playing}
                    >
                        Classic
                    </button>
                    <button
                        type="button"
                        className={`host-mode-option ${gameMode === "battle-royale" ? "is-active" : ""}`}
                        onClick={() => handleGameModeChange("battle-royale")}
                        disabled={playing}
                    >
                        Battle Royale
                    </button>
                </div>
            </div>

            <div className="panel-row panel-row-bottom">
                <button
                    className="ui-button"
                    onClick={handleStartGame}
                    disabled={playing || players.length < 1}
                >
                    {playing ? "Game Running" : "Start Game"}
                </button>
                {startError && <div className="error-text">{startError}</div>}
            </div>
        </>
    );

    if (!playing) {
        return (
            <main className="page-shell">
                <section className="panel host-panel">
                    {hostControls}
                    <section className="panel inset-panel">
                        <h3 className="section-title">
                            Players ({players.length})
                        </h3>
                        <ul className="player-list">
                            {players.length === 0 && (
                                <li className="player-row player-empty">
                                    Waiting for players to join...
                                </li>
                            )}
                            {players.map((player) => (
                                <li
                                    key={player.id}
                                    className={getPlayerRowClassName(player)}
                                >
                                    <span className="player-name-with-status">
                                        <span
                                            className="status-dot-wrap"
                                            title={
                                                player.socketId
                                                    ? "Connected"
                                                    : "Disconnected"
                                            }
                                        >
                                            <svg
                                                className="status-dot"
                                                viewBox="0 0 10 10"
                                                aria-hidden="true"
                                            >
                                                <circle
                                                    cx="5"
                                                    cy="5"
                                                    r="4"
                                                    fill={getPlayerDotColor(
                                                        player,
                                                    )}
                                                />
                                            </svg>
                                        </span>
                                        <span>{player.name}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </section>
            </main>
        );
    }

    return (
        <main className="page-shell page-shell-host-playing">
            <div className="host-playing-screen">
                <div className="host-side-column">
                    <section className="panel host-panel host-control-panel">
                        {hostControls}
                    </section>

                    <section className="panel inset-panel leaderboard-panel">
                        <h3 className="section-title">Leaderboard</h3>
                        <ul className="player-list">
                            {leaderboard.map((player) => (
                                <li
                                    key={player.id}
                                    className={getPlayerRowClassName(player)}
                                >
                                    <span className="leaderboard-player-name">
                                        <span className="player-name-with-status">
                                            <span
                                                className="status-dot-wrap"
                                                title={
                                                    player.socketId
                                                        ? "Connected"
                                                        : "Disconnected"
                                                }
                                            >
                                                <svg
                                                    className="status-dot"
                                                    viewBox="0 0 10 10"
                                                    aria-hidden="true"
                                                >
                                                    <circle
                                                        cx="5"
                                                        cy="5"
                                                        r="4"
                                                        fill={getPlayerDotColor(
                                                            player,
                                                        )}
                                                    />
                                                </svg>
                                            </span>
                                            <span>{player.name}</span>
                                        </span>
                                    </span>
                                    <span className="leaderboard-player-meta">
                                        <span>
                                            {gameMode === "battle-royale"
                                                ? player.alive
                                                    ? "Alive"
                                                    : "Eliminated"
                                                : `${player.score} pts`}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>

                <div className="game-stage">
                    <PhaserGame
                        players={players}
                        width={gameConfig.width}
                        height={gameConfig.height}
                    />
                </div>

                {gameOverData && (
                    <section className="game-over-overlay">
                        <div className="game-over-panel">
                            <h2 className="game-over-title">
                                {gameMode === "battle-royale"
                                    ? "Battle Royale Over"
                                    : "Game Over"}
                            </h2>
                            <p className="game-over-subtitle">
                                {winnerName
                                    ? `${winnerName} wins!`
                                    : "Final standings"}
                            </p>

                            <div className="game-over-bars" role="list">
                                {displayLeaderboard.map((entry, index) => {
                                    return (
                                        <div
                                            key={entry.id}
                                            className="game-over-bar-row"
                                            role="listitem"
                                        >
                                            <div className="game-over-bar-meta">
                                                <span className="game-over-rank">
                                                    #{index + 1}
                                                </span>
                                                <span className="game-over-name">
                                                    {entry.name}
                                                </span>
                                                <span className="game-over-score">
                                                    {gameMode ===
                                                    "battle-royale"
                                                        ? entry.id ===
                                                          gameOverData.winnerId
                                                            ? "Winner"
                                                            : "Eliminated"
                                                        : `${entry.score} pts`}
                                                </span>
                                            </div>
                                            {gameMode !== "battle-royale" && (
                                                <div className="game-over-bar-track">
                                                    <progress
                                                        className={`game-over-progress ${getBarColorClassName(entry.color, index)}`}
                                                        value={Math.max(
                                                            0,
                                                            entry.score,
                                                        )}
                                                        max={Math.max(
                                                            1,
                                                            highestScore,
                                                        )}
                                                        aria-label={`${entry.name} score bar`}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="game-over-actions">
                                <button
                                    className="ui-button"
                                    onClick={handleStartGame}
                                    disabled={players.length < 1}
                                >
                                    Play Again
                                </button>
                                <button
                                    className="ui-button ui-button-ghost"
                                    onClick={handleLeaveGame}
                                >
                                    End Game
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
