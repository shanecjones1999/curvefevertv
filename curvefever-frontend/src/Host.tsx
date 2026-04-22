import { useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { EVENTS } from "./events";
import type { GameMode, LeaderboardEntry, Player } from "./types";
import PhaserGame from "./PhaserGame";
import { DEFAULT_GAME_HEIGHT, DEFAULT_GAME_WIDTH } from "./gameConfig";
import { PLAYER_COLORS, DISCONNECTED_DOT_COLOR } from "./constants/gameUi";
import { HOST_SESSION_KEY } from "./constants/storage";
import HostControls from "./components/host/HostControls";
import HostGameSetup from "./components/host/HostGameSetup";
import HostPlayerList from "./components/host/HostPlayerList";
import HostLeaderboard from "./components/host/HostLeaderboard";
import HostRoundOverOverlay from "./components/host/HostRoundOverOverlay";
import AppPopupDialog from "./components/AppPopupDialog";
import type {
    GameConfig,
    GameOverPayload,
    RoundOverPayload,
} from "./components/host/types";
import { useHostBackgroundMusic } from "./hooks/useHostBackgroundMusic";
import { useHostRoomSync } from "./hooks/useHostRoomSync";
import styles from "./ui.module.css";
import { cx } from "./utils/cx";
import { buildPlayerJoinUrl } from "./utils/joinLink";
import {
    areSoundEffectsMuted,
    getRoundCountdownSoundEffect,
    playSoundEffect,
    preloadHostSoundEffects,
    setSoundEffectsMuted,
} from "./utils/soundEffects";
import { buildTeamLeaderboard, DEFAULT_TEAM_COUNT, getActiveTeamCount } from "./utils/teamMode";
import {
    buildPlayerColorById,
    getFallbackPlayerColor,
    isValidHexColor,
} from "./utils/playerColor";

function buildDisplayLeaderboard(
    source: LeaderboardEntry[],
    playerColorById: Map<string, string>,
) {
    return source.map((entry, index) => {
        const fallbackColor = getFallbackPlayerColor(index);
        const colorFromPlayer =
            entry.kind === "team" ? entry.color : playerColorById.get(entry.id);
        return {
            ...entry,
            color:
                (isValidHexColor(entry.color) ? entry.color : undefined) ??
                colorFromPlayer ??
                fallbackColor,
        };
    });
}

type StartGameResponse = {
    ok: boolean;
    gameMode?: GameMode;
    targetScore?: number;
    teamCount?: number;
    gameConfig?: GameConfig;
    error?: string;
};

type SetGameModeResponse = {
    ok: boolean;
    gameMode?: GameMode;
    teamCount?: number;
    error?: string;
};

type CreateRoomResponse = {
    roomCode?: string;
    gameMode?: GameMode;
    teamCount?: number;
    gameConfig?: GameConfig;
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

const GAME_OVER_RETURN_DELAY_MS = 10000;

type PopupDialogState = {
    eyebrow?: string;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    cancelLabel?: string;
    onCancel?: () => void;
    confirmTone?: "default" | "danger";
};

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
    const [teamCount, setTeamCount] = useState(DEFAULT_TEAM_COUNT);
    const [roundStartRemainingMs, setRoundStartRemainingMs] = useState(0);
    const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(
        null,
    );
    const [roundOverData, setRoundOverData] = useState<RoundOverPayload | null>(
        null,
    );
    const [gameConfig, setGameConfig] = useState<GameConfig>({
        width: DEFAULT_GAME_WIDTH,
        height: DEFAULT_GAME_HEIGHT,
    });
    const [isSubmittingGameSetup, setIsSubmittingGameSetup] = useState(false);
    const [isEditingGameSetup, setIsEditingGameSetup] = useState(false);
    const [draftGameMode, setDraftGameMode] = useState<GameMode>("classic");
    const [draftTeamCount, setDraftTeamCount] = useState(DEFAULT_TEAM_COUNT);
    const [dialogState, setDialogState] = useState<PopupDialogState | null>(null);
    const hostScreenRef = useRef<HTMLElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(() =>
        Boolean(
            document.fullscreenElement ??
            (document as FullscreenCapableDocument).webkitFullscreenElement ??
            null,
        ),
    );
    const [isFullscreenSupported] = useState(() =>
        Boolean(
            document.fullscreenEnabled ??
            (document as FullscreenCapableDocument).webkitFullscreenEnabled,
        ),
    );
    const [isSoundMuted, setIsSoundMuted] = useState(() =>
        areSoundEffectsMuted(),
    );
    useHostBackgroundMusic(playing && !gameOverData, isSoundMuted);
    const previousCanStartRef = useRef<boolean | null>(null);
    const previousRoundStartCountdownRef = useRef(0);
    const lastTeamRoundWinKeyRef = useRef<string | null>(null);
    const lastTeamGameWinKeyRef = useRef<string | null>(null);

    const playerColorById = useMemo(() => {
        return buildPlayerColorById(players);
    }, [players]);

    const getPlayerRowClassName = (player: Player) => {
        return cx(
            styles["player-row"],
            !player.socketId && styles["player-row-disconnected"],
            !player.alive && styles["player-row-eliminated"],
        );
    };

    const getPlayerDotColor = (player: Player) => {
        if (!player.socketId) {
            return DISCONNECTED_DOT_COLOR;
        }
        return playerColorById.get(player.id) ?? PLAYER_COLORS[0];
    };

    const leaderboard = useMemo(() => {
        if (gameMode === "teams") {
            return buildTeamLeaderboard(players);
        }

        return [...players]
            .map((player) => ({
                id: player.id,
                name: player.name,
                score: player.score,
                color: player.color,
                alive: player.alive,
                socketId: player.socketId,
                teamId: player.teamId,
                kind: "player" as const,
            }))
            .sort((firstPlayer, secondPlayer) => {
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
    const activeTeamCount = useMemo(() => getActiveTeamCount(players), [players]);
    const teamPlayersByTeamId = useMemo(() => {
        const groupedPlayers = new Map<number, Player[]>();
        for (const player of players) {
            if (typeof player.teamId !== "number") continue;
            const teamPlayers = groupedPlayers.get(player.teamId) ?? [];
            teamPlayers.push(player);
            groupedPlayers.set(player.teamId, teamPlayers);
        }
        return groupedPlayers;
    }, [players]);
    const canStart =
        gameMode === "teams" ? activeTeamCount >= 2 : players.length >= 1;
    const effectiveTargetScore =
        targetScore ??
        Math.max(
            10,
            (gameMode === "teams" ? activeTeamCount : players.length) * 10 - 10,
        );
    const joinUrl = useMemo(() => {
        if (!roomCode) {
            return null;
        }

        return buildPlayerJoinUrl(roomCode);
    }, [roomCode]);
    const displayLeaderboard = useMemo(() => {
        const source =
            gameOverData?.leaderboard && gameOverData.leaderboard.length > 0
                ? gameOverData.leaderboard
                : leaderboard;

        return buildDisplayLeaderboard(source, playerColorById);
    }, [gameOverData, leaderboard, playerColorById]);
    const roundDisplayLeaderboard = useMemo(() => {
        const source =
            roundOverData?.leaderboard && roundOverData.leaderboard.length > 0
                ? roundOverData.leaderboard
                : leaderboard;

        return buildDisplayLeaderboard(source, playerColorById);
    }, [leaderboard, playerColorById, roundOverData]);
    const roundOverOverlayKey = useMemo(() => {
        if (!roundOverData) return null;

        return JSON.stringify({
            winnerId: roundOverData.winnerId ?? null,
            scoreBeforeById: roundOverData.scoreBeforeById ?? null,
            leaderboard: roundDisplayLeaderboard.map((entry) => ({
                id: entry.id,
                score: entry.score ?? 0,
            })),
        });
    }, [roundDisplayLeaderboard, roundOverData]);
    const gameOverOverlayData = useMemo(() => {
        if (!gameOverData) return null;

        return {
            winnerId: gameOverData.winnerId,
            gameMode: gameOverData.gameMode ?? gameMode,
            leaderboard: displayLeaderboard,
            scoreBeforeById: Object.fromEntries(
                displayLeaderboard.map((entry) => [entry.id, 0]),
            ),
        } satisfies RoundOverPayload;
    }, [displayLeaderboard, gameMode, gameOverData]);
    const gameOverOverlayKey = useMemo(() => {
        if (!gameOverData) return null;

        return JSON.stringify({
            winnerId: gameOverData.winnerId ?? null,
            leaderboard: displayLeaderboard.map((entry) => ({
                id: entry.id,
                score: entry.score ?? 0,
            })),
        });
    }, [displayLeaderboard, gameOverData]);
    const roundStartCountdown =
        roundStartRemainingMs > 0 ? Math.ceil(roundStartRemainingMs / 1000) : 0;
    const renderPlayers = players;
    const hasDraftGameSetupChanges =
        draftGameMode !== gameMode ||
        (draftGameMode === "teams" && draftTeamCount !== teamCount);
    const willReshuffleTeams =
        players.length > 0 &&
        (gameMode === "teams" || draftGameMode === "teams") &&
        hasDraftGameSetupChanges;

    useHostRoomSync({
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
        onPlayerJoined: () => playSoundEffect("lobbyJoin"),
        autoCreateRoom: false,
    });

    useEffect(() => {
        preloadHostSoundEffects();
    }, []);

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

    useEffect(() => {
        if (
            previousCanStartRef.current !== null &&
            !playing &&
            canStart &&
            !previousCanStartRef.current &&
            players.length > 0
        ) {
            playSoundEffect("lobbyReady");
        }

        previousCanStartRef.current = canStart;
    }, [canStart, players.length, playing]);

    useEffect(() => {
        const previousCountdown = previousRoundStartCountdownRef.current;

        if (playing && !roundOverData && !gameOverData) {
            if (
                roundStartCountdown > 0 &&
                roundStartCountdown <= 3 &&
                roundStartCountdown !== previousCountdown
            ) {
                const countdownEffect =
                    getRoundCountdownSoundEffect(roundStartCountdown);
                if (countdownEffect) {
                    playSoundEffect(countdownEffect);
                }
            }

            if (previousCountdown > 0 && roundStartCountdown === 0) {
                playSoundEffect("roundGo");
            }
        }

        previousRoundStartCountdownRef.current = roundStartCountdown;
    }, [gameOverData, playing, roundOverData, roundStartCountdown]);

    useEffect(() => {
        if (gameMode !== "teams" || !roundOverData?.winnerId) {
            return;
        }

        const nextKey = `${roundOverData.winnerId}:${roundOverOverlayKey ?? ""}`;
        if (lastTeamRoundWinKeyRef.current === nextKey) {
            return;
        }

        lastTeamRoundWinKeyRef.current = nextKey;
        playSoundEffect("teamWin");
    }, [gameMode, roundOverData, roundOverOverlayKey]);

    useEffect(() => {
        if (gameMode !== "teams" || !gameOverData?.winnerId) {
            return;
        }

        const nextKey = `${gameOverData.winnerId}:${gameOverOverlayKey ?? ""}`;
        if (lastTeamGameWinKeyRef.current === nextKey) {
            return;
        }

        lastTeamGameWinKeyRef.current = nextKey;
        playSoundEffect("teamWin");
    }, [gameMode, gameOverData, gameOverOverlayKey]);

    useEffect(() => {
        if (!gameOverData) return;

        const timeoutId = window.setTimeout(() => {
            setGameOverData(null);
            setRoundOverData(null);
            setRoundStartRemainingMs(0);
            setPlaying(false);
        }, GAME_OVER_RETURN_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [gameOverData]);

    function submitGameSetup() {
        if (roomCode && !hasDraftGameSetupChanges) {
            setStartError(null);
            setIsEditingGameSetup(false);
            return;
        }

        setStartError(null);
        setIsSubmittingGameSetup(true);

        if (!roomCode) {
            socket.emit(
                EVENTS.CREATE_ROOM,
                { gameMode: draftGameMode, teamCount: draftTeamCount },
                (res: CreateRoomResponse) => {
                    setIsSubmittingGameSetup(false);
                    if (!res?.roomCode) {
                        setStartError("Unable to create room");
                        return;
                    }

                    const nextGameMode = res.gameMode ?? draftGameMode;
                    const nextTeamCount = res.teamCount ?? draftTeamCount;
                    setRoomCode(res.roomCode);
                    setGameMode(nextGameMode);
                    setTeamCount(nextTeamCount);
                    setDraftGameMode(nextGameMode);
                    setDraftTeamCount(nextTeamCount);
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

        socket.emit(
            EVENTS.SET_GAME_MODE,
            {
                roomCode,
                gameMode: draftGameMode,
                teamCount: draftTeamCount,
            },
            (res: SetGameModeResponse) => {
                setIsSubmittingGameSetup(false);
                if (!res?.ok) {
                    setStartError(res?.error ?? "Unable to update game mode");
                    return;
                }

                const nextGameMode = res.gameMode ?? draftGameMode;
                const nextTeamCount = res.teamCount ?? draftTeamCount;
                setGameMode(nextGameMode);
                setTeamCount(nextTeamCount);
                setDraftGameMode(nextGameMode);
                setDraftTeamCount(nextTeamCount);
                setIsEditingGameSetup(false);
                setStartError(null);
            },
        );
    }

    function handleSubmitGameSetup() {
        if (roomCode && willReshuffleTeams) {
            setDialogState({
                eyebrow: "Update setup",
                title: "Apply the new team setup?",
                description:
                    "Players already in the room may be reassigned when the team configuration changes.",
                confirmLabel: "Apply changes",
                cancelLabel: "Keep current setup",
                onCancel: () => setDialogState(null),
                onConfirm: () => {
                    setDialogState(null);
                    submitGameSetup();
                },
            });
            return;
        }

        submitGameSetup();
    }

    function handleStartGame() {
        if (!roomCode) return;
        socket.emit(
            "startGame",
            { roomCode, gameMode, teamCount },
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
                    if (typeof res.teamCount === "number") {
                        setTeamCount(res.teamCount);
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

    function handleDraftGameModeChange(nextGameMode: GameMode) {
        setStartError(null);
        setDraftGameMode(nextGameMode);
    }

    function handleDraftTeamCountChange(nextTeamCount: number) {
        setStartError(null);
        setDraftTeamCount(nextTeamCount);
    }

    function handleToggleSound() {
        setIsSoundMuted((current) => {
            const next = !current;
            setSoundEffectsMuted(next);
            return next;
        });
    }

    function handleOpenGameSetup() {
        setDraftGameMode(gameMode);
        setDraftTeamCount(teamCount);
        setStartError(null);
        setIsEditingGameSetup(true);
    }

    function handleCloseGameSetup() {
        setDraftGameMode(gameMode);
        setDraftTeamCount(teamCount);
        setStartError(null);
        setIsEditingGameSetup(false);
    }

    function handleLeaveGame() {
        if (roomCode) {
            setDialogState({
                eyebrow: "Leave host mode",
                title: "End this session?",
                description:
                    "This will close the room for players and return you to role selection.",
                confirmLabel: "End session",
                cancelLabel: "Stay here",
                confirmTone: "danger",
                onCancel: () => setDialogState(null),
                onConfirm: () => {
                    setDialogState(null);
                    if (roomCode) {
                        socket.emit(EVENTS.LEAVE_ROOM, { roomCode }, () => {});
                    }

                    localStorage.removeItem(HOST_SESSION_KEY);
                    setRoomCode(null);
                    setPlayers([]);
                    setPlaying(false);
                    setTargetScore(null);
                    setGameMode("classic");
                    setTeamCount(DEFAULT_TEAM_COUNT);
                    setDraftGameMode("classic");
                    setDraftTeamCount(DEFAULT_TEAM_COUNT);
                    setGameOverData(null);
                    setRoundOverData(null);
                    setRoundStartRemainingMs(0);
                    setIsSubmittingGameSetup(false);
                    setIsEditingGameSetup(false);
                    onLeave();
                },
            });
            return;
        }

        localStorage.removeItem(HOST_SESSION_KEY);
        setRoomCode(null);
        setPlayers([]);
        setPlaying(false);
        setTargetScore(null);
        setGameMode("classic");
        setTeamCount(DEFAULT_TEAM_COUNT);
        setDraftGameMode("classic");
        setDraftTeamCount(DEFAULT_TEAM_COUNT);
        setGameOverData(null);
        setRoundOverData(null);
        setRoundStartRemainingMs(0);
        setIsSubmittingGameSetup(false);
        setIsEditingGameSetup(false);
        onLeave();
    }

    const popupDialog = (
        <AppPopupDialog
            isOpen={Boolean(dialogState)}
            eyebrow={dialogState?.eyebrow}
            title={dialogState?.title ?? ""}
            description={dialogState?.description ?? ""}
            confirmLabel={dialogState?.confirmLabel ?? "OK"}
            onConfirm={dialogState?.onConfirm ?? (() => {})}
            cancelLabel={dialogState?.cancelLabel}
            onCancel={dialogState?.onCancel}
            confirmTone={dialogState?.confirmTone}
        />
    );

    const getLeaderboardRowClassName = (entry: LeaderboardEntry) => {
        if (entry.kind === "team") {
            return cx(
                styles["player-row"],
                !entry.alive && styles["player-row-eliminated"],
            );
        }

        const player = players.find((candidate) => candidate.id === entry.id);
        return player ? getPlayerRowClassName(player) : styles["player-row"];
    };

    const getLeaderboardDotColor = (entry: LeaderboardEntry) => {
        if (entry.kind === "team" && entry.color) {
            return entry.color;
        }

        const player = players.find((candidate) => candidate.id === entry.id);
        return player ? getPlayerDotColor(player) : entry.color ?? PLAYER_COLORS[0];
    };

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

        const element = hostScreenRef.current;
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
            joinUrl={joinUrl}
            gameMode={gameMode}
            teamCount={teamCount}
            effectiveTargetScore={effectiveTargetScore}
            playing={playing}
            canStart={canStart}
            startError={startError}
            isFullscreen={isFullscreen}
            isFullscreenSupported={isFullscreenSupported}
            isSoundMuted={isSoundMuted}
            layout={playing ? "sidebar" : "lobby"}
            playersSlot={
                !playing ? (
                    <HostPlayerList
                        className={styles["host-lobby-player-panel"]}
                        players={players}
                        gameMode={gameMode}
                        teamCount={teamCount}
                        getPlayerRowClassName={getPlayerRowClassName}
                        getPlayerDotColor={getPlayerDotColor}
                    />
                ) : null
            }
            onLeaveGame={handleLeaveGame}
            onChangeMode={handleOpenGameSetup}
            onCopyGameCode={handleCopyGameCode}
            onStartGame={handleStartGame}
            onToggleSound={handleToggleSound}
            onToggleFullscreen={handleFullscreenToggle}
        />
    );

    if (!roomCode || isEditingGameSetup) {
        if (!roomCode) {
            return (
                <main
                    className={cx(
                        styles["page-shell"],
                        styles["page-shell-host-lobby"],
                    )}
                >
                    <HostGameSetup
                        gameMode={draftGameMode}
                        teamCount={draftTeamCount}
                        submitting={isSubmittingGameSetup}
                        isEditing={false}
                        canSubmit
                        error={startError}
                        onBack={handleLeaveGame}
                        onSubmit={handleSubmitGameSetup}
                        onGameModeChange={handleDraftGameModeChange}
                        onTeamCountChange={handleDraftTeamCountChange}
                    />
                    {popupDialog}
                </main>
            );
        }
    }

    if (!playing) {
        return (
            <main
                className={cx(
                    styles["page-shell"],
                    styles["page-shell-host-lobby"],
                )}
                ref={hostScreenRef}
            >
                <section
                    className={cx(
                        styles.panel,
                        styles["host-panel"],
                        styles["host-lobby-panel"],
                    )}
                >
                    {hostControls}
                </section>
                {isEditingGameSetup && (
                    <div
                        className={styles["host-setup-overlay"]}
                        role="dialog"
                        aria-modal="true"
                    >
                        <HostGameSetup
                            gameMode={draftGameMode}
                            teamCount={draftTeamCount}
                            submitting={isSubmittingGameSetup}
                            isEditing
                            canSubmit={hasDraftGameSetupChanges}
                            error={startError}
                            onBack={handleCloseGameSetup}
                            onSubmit={handleSubmitGameSetup}
                            onGameModeChange={handleDraftGameModeChange}
                            onTeamCountChange={handleDraftTeamCountChange}
                        />
                    </div>
                )}
                {popupDialog}
            </main>
        );
    }

    return (
        <main
            className={cx(
                styles["page-shell"],
                styles["page-shell-host-playing"],
            )}
            ref={hostScreenRef}
        >
            <div className={styles["host-playing-screen"]}>
                <div className={styles["host-side-column"]}>
                    <section
                        className={cx(
                            styles.panel,
                            styles["host-panel"],
                            styles["host-control-panel"],
                        )}
                    >
                        {hostControls}
                    </section>
                    <HostLeaderboard
                        leaderboard={leaderboard}
                        gameMode={gameMode}
                        getRowClassName={getLeaderboardRowClassName}
                        getDotColor={getLeaderboardDotColor}
                        getTeamPlayers={(teamId) =>
                            teamPlayersByTeamId.get(teamId) ?? []
                        }
                    />
                </div>

                <div className={styles["game-stage"]}>
                    <PhaserGame
                        players={renderPlayers}
                        gameMode={gameMode}
                        showTeamLabels={gameMode === "teams" && roundStartCountdown > 0}
                        width={gameConfig.width}
                        height={gameConfig.height}
                    />
                    {roundStartCountdown > 0 && !gameOverData && !roundOverData && (
                        <div
                            className={styles["round-start-overlay"]}
                            aria-live="polite"
                        >
                            <p className={styles["round-start-countdown"]}>
                                {roundStartCountdown}
                            </p>
                        </div>
                    )}
                    {roundOverData && !gameOverData && (
                        <HostRoundOverOverlay
                            key={roundOverOverlayKey ?? undefined}
                            gameMode={gameMode}
                            roundOverData={roundOverData}
                            goalScore={
                                gameMode === "battle-royale"
                                    ? null
                                    : effectiveTargetScore
                            }
                            displayLeaderboard={roundDisplayLeaderboard}
                        />
                    )}
                    {gameOverData && gameOverOverlayData && (
                        <HostRoundOverOverlay
                            key={gameOverOverlayKey ?? undefined}
                            gameMode={gameMode}
                            roundOverData={gameOverOverlayData}
                            goalScore={
                                gameMode === "battle-royale"
                                    ? null
                                    : effectiveTargetScore
                            }
                            displayLeaderboard={displayLeaderboard}
                            title={
                                gameMode === "battle-royale"
                                    ? "Battle Royale Over"
                                    : "Game Over"
                            }
                            winnerStatusLabel="Game winner"
                            countdownLabel="Returning to lobby in"
                            countdownDurationMs={GAME_OVER_RETURN_DELAY_MS}
                        />
                    )}
                </div>
            </div>
            {popupDialog}
        </main>
    );
}
