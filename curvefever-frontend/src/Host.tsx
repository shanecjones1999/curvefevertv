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
import { useHostRoomSync } from "./hooks/useHostRoomSync";

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

type FullscreenCapableElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenCapableDocument = Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
    webkitFullscreenEnabled?: boolean;
};

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
    const hostPlayingScreenRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(() =>
        Boolean(
            document.fullscreenElement ??
                (document as FullscreenCapableDocument)
                    .webkitFullscreenElement ??
                null,
        ),
    );
    const [isFullscreenSupported] = useState(() =>
        Boolean(
            document.fullscreenEnabled ??
                (document as FullscreenCapableDocument)
                    .webkitFullscreenEnabled,
        ),
    );

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

    useHostRoomSync({
        hasRequestedRoomCreation,
        setRoomCode,
        setPlayers,
        setPlaying,
        setStartError,
        setTargetScore,
        setGameMode,
        setGameOverData,
        setGameConfig,
    });

    useEffect(() => {
        const fullscreenDocument = document as FullscreenCapableDocument;

        const syncFullscreenState = () => {
            const fullscreenElement =
                document.fullscreenElement ??
                fullscreenDocument.webkitFullscreenElement ??
                null;
            setIsFullscreen(Boolean(fullscreenElement));
        };

        syncFullscreenState();
        document.addEventListener("fullscreenchange", syncFullscreenState);
        document.addEventListener(
            "webkitfullscreenchange",
            syncFullscreenState as EventListener,
        );

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                syncFullscreenState,
            );
            document.removeEventListener(
                "webkitfullscreenchange",
                syncFullscreenState as EventListener,
            );
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

    async function handleFullscreenToggle() {
        const fullscreenDocument = document as FullscreenCapableDocument;

        if (!isFullscreenSupported) return;

        const activeFullscreenElement =
            document.fullscreenElement ??
            fullscreenDocument.webkitFullscreenElement ??
            null;

        if (activeFullscreenElement) {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
                return;
            }
            if (fullscreenDocument.webkitExitFullscreen) {
                await fullscreenDocument.webkitExitFullscreen();
            }
            return;
        }

        const element = hostPlayingScreenRef.current;
        if (!element) return;

        const fullscreenElement = element as FullscreenCapableElement;

        if (element.requestFullscreen) {
            await element.requestFullscreen();
            return;
        }

        if (fullscreenElement.webkitRequestFullscreen) {
            await fullscreenElement.webkitRequestFullscreen();
        }
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
            isFullscreen={isFullscreen}
            isFullscreenSupported={isFullscreenSupported}
            showFullscreenControl={playing}
            onLeaveGame={handleLeaveGame}
            onCopyGameCode={handleCopyGameCode}
            onGameModeChange={handleGameModeChange}
            onStartGame={handleStartGame}
            onToggleFullscreen={handleFullscreenToggle}
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
            <div className="host-playing-screen" ref={hostPlayingScreenRef}>
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
