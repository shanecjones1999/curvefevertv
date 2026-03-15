import { useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { EVENTS } from "./events";
import type { Player } from "./types";
import PhaserGame from "./PhaserGame";
import { DEFAULT_GAME_HEIGHT, DEFAULT_GAME_WIDTH } from "./gameConfig";

const HOST_SESSION_KEY = "curvefever:hostSession";

type ReconnectHostResponse = {
    ok: boolean;
    roomCode?: string;
    players?: Player[];
    state?: "lobby" | "playing" | "finished";
    gameConfig?: GameConfig;
    error?: string;
};

type StartGameResponse = {
    ok: boolean;
    gameConfig?: GameConfig;
    error?: string;
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
    const [gameConfig, setGameConfig] = useState<GameConfig>({
        width: DEFAULT_GAME_WIDTH,
        height: DEFAULT_GAME_HEIGHT,
    });
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

    const leaderboard = [...players].sort(
        (firstPlayer, secondPlayer) =>
            secondPlayer.score - firstPlayer.score ||
            firstPlayer.name.localeCompare(secondPlayer.name),
    );

    useEffect(() => {
        const applyGameConfig = (incoming?: GameConfig) => {
            if (!incoming) return;
            if (incoming.width <= 0 || incoming.height <= 0) return;
            setGameConfig({
                width: incoming.width,
                height: incoming.height,
            });
        };

        const reconnectFromSession = () => {
            const rawSession = localStorage.getItem(HOST_SESSION_KEY);
            if (!rawSession) {
                if (!hasRequestedRoomCreation.current) {
                    hasRequestedRoomCreation.current = true;
                    handleCreateRoom();
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
                            applyGameConfig(res.gameConfig);
                            setPlaying(res.state === "playing");
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
            (data: { players: Player[]; gameConfig?: GameConfig }) => {
                setPlayers(data.players);
                applyGameConfig(data.gameConfig);
            },
        );

        socket.on("startGame", (data?: { gameConfig?: GameConfig }) => {
            applyGameConfig(data?.gameConfig);
            setPlaying(true);
        });
        socket.on(
            "gameState",
            (state?: { players?: Player[]; arena?: GameConfig }) => {
                if (state?.arena) {
                    applyGameConfig(state.arena);
                }
                if (state && Array.isArray(state.players)) {
                    setPlayers(state.players);
                }
            },
        );
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
            socket.off("gameState");
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

    function handleCreateRoom() {
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
    }

    function handleStartGame() {
        if (!roomCode) return;
        socket.emit("startGame", { roomCode }, (res: StartGameResponse) => {
            if (res?.ok) {
                setStartError(null);
                if (res.gameConfig) {
                    setGameConfig(res.gameConfig);
                }
                setPlaying(true);
            } else {
                setStartError(res?.error ?? "Unable to start game");
            }
        });
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
                        {copiedCode ? "Copied!" : "Game Code · Click to copy"}
                    </span>
                    <span className="room-code-value">
                        {roomCode ?? "------"}
                    </span>
                </button>
            </div>

            <div className="panel-row panel-row-bottom">
                <button
                    className="ui-button"
                    onClick={handleStartGame}
                    disabled={playing || players.length < 2}
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
                                        <span>{player.score} pts</span>
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
            </div>
        </main>
    );
}
