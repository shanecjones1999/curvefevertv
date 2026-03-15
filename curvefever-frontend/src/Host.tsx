import { useEffect, useRef, useState } from "react";
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

    return (
        <main className="page-shell">
            <section className="panel host-panel">
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
                            {copiedCode
                                ? "Copied!"
                                : "Game Code · Click to copy"}
                        </span>
                        <span className="room-code-value">
                            {roomCode ?? "------"}
                        </span>
                    </button>
                </div>

                {!playing && (
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
                                <li key={player.id} className="player-row">
                                    <span className="player-name-with-status">
                                        <span
                                            className={`status-dot ${player.socketId ? "status-online" : "status-offline"}`}
                                            title={
                                                player.socketId
                                                    ? "Connected"
                                                    : "Disconnected"
                                            }
                                        />
                                        <span>{player.name}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="panel-row panel-row-bottom">
                    <button
                        className="ui-button"
                        onClick={handleStartGame}
                        disabled={playing || players.length < 2}
                    >
                        {playing ? "Game Running" : "Start Game"}
                    </button>
                    {startError && (
                        <div className="error-text">{startError}</div>
                    )}
                </div>

                {playing && (
                    <div className="host-game-layout">
                        <section className="panel inset-panel leaderboard-panel">
                            <h3 className="section-title">Leaderboard</h3>
                            <ul className="player-list">
                                {leaderboard.map((player) => (
                                    <li key={player.id} className="player-row">
                                        <span className="leaderboard-player-name">
                                            <span className="player-name-with-status">
                                                <span
                                                    className={`status-dot ${player.socketId ? "status-online" : "status-offline"}`}
                                                    title={
                                                        player.socketId
                                                            ? "Connected"
                                                            : "Disconnected"
                                                    }
                                                />
                                                <span>{player.name}</span>
                                            </span>
                                        </span>
                                        <span className="leaderboard-player-meta">
                                            <span>{player.score} pts · </span>
                                            <span
                                                className={
                                                    player.alive
                                                        ? "alive"
                                                        : "dead"
                                                }
                                            >
                                                {player.alive
                                                    ? "Alive"
                                                    : "Eliminated"}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <div className="game-stage">
                            <PhaserGame
                                players={players}
                                width={gameConfig.width}
                                height={gameConfig.height}
                            />
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
