import { useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { EVENTS } from "./events";
import type { GameMode, Player } from "./types";
import PhaserGame from "./PhaserGame";
import { DEFAULT_GAME_HEIGHT, DEFAULT_GAME_WIDTH } from "./gameConfig";
import { PLAYER_COLORS, DISCONNECTED_DOT_COLOR } from "./constants/gameUi";
import { HOST_SESSION_KEY } from "./constants/storage";
import HostControls from "./components/host/HostControls";
import HostPlayerList from "./components/host/HostPlayerList";
import HostLeaderboard from "./components/host/HostLeaderboard";
import HostGameOverOverlay from "./components/host/HostGameOverOverlay";
import type { GameConfig, GameOverPayload } from "./components/host/types";

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

type Props = { onLeave: () => void };

const PLAYER_COLOR_CLASS_BY_HEX: Record<string, string> = PLAYER_COLORS.reduce(
    (map, color, index) => {
        map[color.toLowerCase()] = `bar-color-${index}`;
        return map;
    },
    {} as Record<string, string>,
);

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
        <HostControls
            copiedCode={copiedCode}
            roomCode={roomCode}
            gameMode={gameMode}
            effectiveTargetScore={effectiveTargetScore}
            playing={playing}
            playersCount={players.length}
            startError={startError}
            onLeaveGame={handleLeaveGame}
            onCopyGameCode={handleCopyGameCode}
            onGameModeChange={handleGameModeChange}
            onStartGame={handleStartGame}
        />
    );

    if (!playing) {
        return (
            <main className="page-shell">
                <section className="panel host-panel">
                    {hostControls}
                    <HostPlayerList
                        players={players}
                        getPlayerRowClassName={getPlayerRowClassName}
                        getPlayerDotColor={getPlayerDotColor}
                    />
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
                    <HostLeaderboard
                        leaderboard={leaderboard}
                        gameMode={gameMode}
                        getPlayerRowClassName={getPlayerRowClassName}
                        getPlayerDotColor={getPlayerDotColor}
                    />
                </div>

                <div className="game-stage">
                    <PhaserGame
                        players={players}
                        width={gameConfig.width}
                        height={gameConfig.height}
                    />
                </div>

                {gameOverData && (
                    <HostGameOverOverlay
                        gameMode={gameMode}
                        gameOverData={gameOverData}
                        winnerName={winnerName}
                        displayLeaderboard={displayLeaderboard}
                        highestScore={highestScore}
                        playersCount={players.length}
                        getBarColorClassName={getBarColorClassName}
                        onPlayAgain={handleStartGame}
                        onEndGame={handleLeaveGame}
                    />
                )}
            </div>
        </main>
    );
}
