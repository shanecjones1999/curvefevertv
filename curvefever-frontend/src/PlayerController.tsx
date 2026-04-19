import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { EVENTS } from "./events";
import { PLAYER_SESSION_KEY } from "./constants/storage";
import type { GameMode, Player, RoomState } from "./types";
import { ROOM_CODE_REGEX, sanitizeRoomCodeInput } from "./utils/roomCode";
import { getStoredPlayerSession } from "./utils/playerSession";
import { getRequestedRoomCodeFromUrl } from "./utils/joinLink";
import PlayerJoinForm from "./components/player/PlayerJoinForm";
import PlayerLiveControls from "./components/player/PlayerLiveControls";
import { LeaveGameIcon } from "./components/ActionIcons";
import { usePlayerRejoin } from "./hooks/usePlayerRejoin";
import { DEFAULT_TEAM_COUNT } from "./utils/teamMode";
import { buildPlayerColorById } from "./utils/playerColor";
import uiStyles from "./ui.module.css";
import { cx } from "./utils/cx";

const INPUT_SEND_INTERVAL_MS = 16;

type JoinRoomResponse = {
    ok: boolean;
    player?: {
        id: string;
        name: string;
    };
    error?: string;
};

type Props = { onLeave: () => void };

export default function PlayerController({ onLeave }: Props) {
    const storedSession = useMemo(() => getStoredPlayerSession(), []);
    const requestedRoomCode = useMemo(() => getRequestedRoomCodeFromUrl(), []);
    const rejoinSession = requestedRoomCode ? null : storedSession;
    const [roomCode, setRoomCode] = useState(
        requestedRoomCode ?? storedSession?.roomCode ?? "",
    );
    const [name, setName] = useState(storedSession?.name ?? "");
    const [joined, setJoined] = useState(false);
    const [leftPressed, setLeftPressed] = useState(false);
    const [rightPressed, setRightPressed] = useState(false);
    const [isRejoining, setIsRejoining] = useState(Boolean(rejoinSession));
    const [rejoinError, setRejoinError] = useState<string | null>(null);
    const [roomState, setRoomState] = useState<RoomState>("lobby");
    const [gameMode, setGameMode] = useState<GameMode>("classic");
    const [teamCount, setTeamCount] = useState(DEFAULT_TEAM_COUNT);
    const [players, setPlayers] = useState<Player[]>([]);
    const playerIdRef = useRef<string | null>(rejoinSession?.playerId ?? null);
    const [playerId, setPlayerId] = useState<string | null>(
        rejoinSession?.playerId ?? null,
    );
    const pressRef = useRef<{ left: boolean; right: boolean }>({
        left: false,
        right: false,
    });
    const intervalRef = useRef<number | null>(null);
    const currentPlayer = useMemo(
        () => players.find((player) => player.id === playerId) ?? null,
        [playerId, players],
    );
    const playerColorById = useMemo(() => buildPlayerColorById(players), [players]);
    const currentPlayerColor = useMemo(() => {
        if (!currentPlayer) {
            return null;
        }

        return playerColorById.get(currentPlayer.id) ?? null;
    }, [currentPlayer, playerColorById]);
    const isCurrentPlayerAlive = currentPlayer?.alive !== false;

    const emitInput = useCallback(() => {
        socket.emit("input", {
            turnLeft: pressRef.current.left,
            turnRight: pressRef.current.right,
        });
    }, []);

    const stopSendingInput = useCallback(() => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const resetInputState = useCallback(() => {
        const hadInput = pressRef.current.left || pressRef.current.right;
        pressRef.current.left = false;
        pressRef.current.right = false;
        setLeftPressed(false);
        setRightPressed(false);
        stopSendingInput();
        if (hadInput) {
            emitInput();
        }
    }, [emitInput, stopSendingInput]);

    const applyRoomSnapshot = useCallback(
        (snapshot?: {
            players?: Player[];
            state?: RoomState;
            gameMode?: GameMode;
            teamCount?: number;
        }) => {
            const nextCurrentPlayer = Array.isArray(snapshot?.players)
                ? snapshot.players.find(
                      (player) => player.id === playerIdRef.current,
                  ) ?? null
                : null;
            const shouldDisableControls =
                snapshot?.state !== "playing" || nextCurrentPlayer?.alive === false;

            if (shouldDisableControls) {
                resetInputState();
            }

            if (Array.isArray(snapshot?.players)) {
                setPlayers(snapshot.players);
            }
            if (snapshot?.state) {
                setRoomState(snapshot.state);
            }
            if (snapshot?.gameMode) {
                setGameMode(snapshot.gameMode);
            }
            if (
                typeof snapshot?.teamCount === "number" &&
                Number.isInteger(snapshot.teamCount) &&
                snapshot.teamCount >= 2 &&
                snapshot.teamCount <= 5
            ) {
                setTeamCount(snapshot.teamCount);
            }
        },
        [resetInputState],
    );

    const requestRoomState = useCallback(
        (requestedRoomCode: string) => {
            socket.emit(
                EVENTS.REQUEST_LOBBY_STATE,
                { roomCode: requestedRoomCode },
                (res: {
                    ok: boolean;
                    error?: string;
                    players?: Player[];
                    state?: RoomState;
                    gameMode?: GameMode;
                    teamCount?: number;
                }) => {
                    if (res?.ok) {
                        applyRoomSnapshot(res);
                        return;
                    }

                    if (res?.error) {
                        setRejoinError(res.error);
                    }
                },
            );
        },
        [applyRoomSnapshot],
    );

    const startSendingInput = useCallback(() => {
        if (intervalRef.current) return;
        intervalRef.current = window.setInterval(() => {
            if (!pressRef.current.left && !pressRef.current.right) {
                stopSendingInput();
                return;
            }
            emitInput();
        }, INPUT_SEND_INTERVAL_MS);
    }, [emitInput, stopSendingInput]);

    const handleLeftDown = useCallback(() => {
        if (!isCurrentPlayerAlive || roomState !== "playing") return;
        pressRef.current.left = true;
        setLeftPressed(true);
        emitInput();
        startSendingInput();
    }, [emitInput, isCurrentPlayerAlive, roomState, startSendingInput]);

    const handleLeftUp = useCallback(() => {
        pressRef.current.left = false;
        setLeftPressed(false);
        emitInput();
        if (!pressRef.current.left && !pressRef.current.right) {
            stopSendingInput();
        }
    }, [emitInput, stopSendingInput]);

    const handleRightDown = useCallback(() => {
        if (!isCurrentPlayerAlive || roomState !== "playing") return;
        pressRef.current.right = true;
        setRightPressed(true);
        emitInput();
        startSendingInput();
    }, [emitInput, isCurrentPlayerAlive, roomState, startSendingInput]);

    const handleRightUp = useCallback(() => {
        pressRef.current.right = false;
        setRightPressed(false);
        emitInput();
        if (!pressRef.current.left && !pressRef.current.right) {
            stopSendingInput();
        }
    }, [emitInput, stopSendingInput]);

    usePlayerRejoin({
        storedSession: rejoinSession,
        playerIdRef,
        setPlayerId,
        stopSendingInput,
        onLeave,
        setJoined,
        setIsRejoining,
        setRejoinError,
    });

    useEffect(() => {
        if (!joined || roomState !== "playing") return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                handleLeftDown();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                handleRightDown();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                handleLeftUp();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                handleRightUp();
            }
        };

        const handleRoundRestart = () => {
            // Silently restart, game state updates automatically
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        socket.on(EVENTS.ROUND_RESTART, handleRoundRestart);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            socket.off(EVENTS.ROUND_RESTART, handleRoundRestart);
        };
    }, [
        joined,
        roomState,
        isCurrentPlayerAlive,
        handleLeftDown,
        handleLeftUp,
        handleRightDown,
        handleRightUp,
    ]);

    useEffect(() => {
        if (!joined || !roomCode) return;

        const handleLobbyUpdate = (data: {
            players: Player[];
            gameMode?: GameMode;
            teamCount?: number;
        }) => {
            applyRoomSnapshot({
                players: data.players,
                state: "lobby",
                gameMode: data.gameMode,
                teamCount: data.teamCount,
            });
        };

        const handleStartGame = (data?: {
            gameMode?: GameMode;
            teamCount?: number;
        }) => {
            applyRoomSnapshot({
                state: "playing",
                gameMode: data?.gameMode,
                teamCount: data?.teamCount,
            });
        };

        const handleGameState = (state?: {
            players?: Player[];
            gameMode?: GameMode;
            teamCount?: number;
        }) => {
            applyRoomSnapshot({
                players: state?.players,
                state: "playing",
                gameMode: state?.gameMode,
                teamCount: state?.teamCount,
            });
        };

        const handleGameOver = (data?: {
            gameMode?: GameMode;
            teamCount?: number;
        }) => {
            applyRoomSnapshot({
                state: "finished",
                gameMode: data?.gameMode,
                teamCount: data?.teamCount,
            });
        };

        const handleConnect = () => {
            requestRoomState(roomCode);
        };

        socket.on(EVENTS.LOBBY_UPDATE, handleLobbyUpdate);
        socket.on(EVENTS.START_GAME, handleStartGame);
        socket.on(EVENTS.GAME_STATE, handleGameState);
        socket.on(EVENTS.GAME_OVER, handleGameOver);
        socket.on("connect", handleConnect);
        requestRoomState(roomCode);

        return () => {
            socket.off(EVENTS.LOBBY_UPDATE, handleLobbyUpdate);
            socket.off(EVENTS.START_GAME, handleStartGame);
            socket.off(EVENTS.GAME_STATE, handleGameState);
            socket.off(EVENTS.GAME_OVER, handleGameOver);
            socket.off("connect", handleConnect);
        };
    }, [applyRoomSnapshot, joined, requestRoomState, roomCode]);

    function handleJoin() {
        const normalizedRoomCode = sanitizeRoomCodeInput(roomCode);
        if (!ROOM_CODE_REGEX.test(normalizedRoomCode)) {
            setRejoinError("Room code must be 4 letters.");
            return;
        }

        const normalizedName = name.trim();
        if (!normalizedName) {
            setRejoinError("Name is required.");
            return;
        }

        socket.emit(
            EVENTS.JOIN_ROOM,
            { roomCode: normalizedRoomCode, name: normalizedName },
            (res: JoinRoomResponse) => {
                if (res?.ok && res.player?.id) {
                    playerIdRef.current = res.player.id;
                    setPlayerId(res.player.id);
                    setJoined(true);
                    setRejoinError(null);
                    setRoomCode(normalizedRoomCode);
                    setName(normalizedName);
                    setRoomState("lobby");
                    localStorage.setItem(
                        PLAYER_SESSION_KEY,
                        JSON.stringify({
                            roomCode: normalizedRoomCode,
                            name: normalizedName,
                            playerId: res.player.id,
                        }),
                    );
                    requestRoomState(normalizedRoomCode);
                } else {
                    playerIdRef.current = null;
                    setPlayerId(null);
                    setJoined(false);
                    setRejoinError(res?.error ?? "Unable to join room.");
                    localStorage.removeItem(PLAYER_SESSION_KEY);
                }
            },
        );
    }

    function handleTeamChange(teamId: number) {
        if (!joined || !roomCode || roomState !== "lobby" || gameMode !== "teams") {
            return;
        }

        socket.emit(
            EVENTS.SWITCH_TEAM,
            { roomCode, teamId },
            (res: { ok: boolean; error?: string }) => {
                if (!res?.ok) {
                    setRejoinError(res?.error ?? "Unable to switch teams.");
                } else {
                    setRejoinError(null);
                }
            },
        );
    }

    function handleLeaveGame() {
        if (joined) {
            const shouldLeave = window.confirm(
                "Are you sure you want to leave the game?",
            );
            if (!shouldLeave) return;

            pressRef.current.left = false;
            pressRef.current.right = false;
            setLeftPressed(false);
            setRightPressed(false);
            stopSendingInput();
            if (playerIdRef.current && roomCode) {
                socket.emit(
                    EVENTS.LEAVE_ROOM,
                    {
                        roomCode,
                        playerId: playerIdRef.current,
                    },
                    () => {},
                );
            }
            playerIdRef.current = null;
            setPlayerId(null);
            setJoined(false);
        }

        localStorage.removeItem(PLAYER_SESSION_KEY);
        setPlayers([]);
        setRoomState("lobby");
        setGameMode("classic");
        setTeamCount(DEFAULT_TEAM_COUNT);
        onLeave();
    }

    // Show a loading state while attempting to rejoin
    if (isRejoining) {
        return (
            <main className={uiStyles["page-shell"]}>
                <section className={cx(uiStyles.panel, uiStyles["controller-panel"])}>
                    <p className={uiStyles.eyebrow}>Controller</p>
                    <h2 className={cx(uiStyles.title, uiStyles["title-small"])}>
                        Reconnecting...
                    </h2>
                    <p className={uiStyles.subtitle}>
                        Restoring your previous game session.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className={uiStyles["page-shell"]}>
            <section className={cx(uiStyles.panel, uiStyles["controller-panel"])}>
                <div className={uiStyles["panel-header"]}>
                    <div>
                        <p className={uiStyles.eyebrow}>Mobile Console</p>
                        <h2 className={cx(uiStyles.title, uiStyles["title-small"])}>
                            Join as Player
                        </h2>
                    </div>
                    <button
                        className={cx(
                            uiStyles["ui-button"],
                            uiStyles["ui-button-ghost"],
                            uiStyles["ui-icon-button"],
                        )}
                        onClick={handleLeaveGame}
                        aria-label="Leave game"
                        title="Leave game"
                    >
                        <LeaveGameIcon className={uiStyles["ui-button-icon"]} />
                    </button>
                </div>

                {!joined ? (
                    <PlayerJoinForm
                        roomCode={roomCode}
                        name={name}
                        rejoinError={rejoinError}
                        onRoomCodeChange={(value) =>
                            setRoomCode(sanitizeRoomCodeInput(value))
                        }
                        onNameChange={setName}
                        onJoin={handleJoin}
                    />
                ) : (
                    <PlayerLiveControls
                        roomCode={roomCode}
                        name={name}
                        playerColor={currentPlayerColor}
                        isAlive={isCurrentPlayerAlive}
                        gameMode={gameMode}
                        roomState={roomState}
                        teamCount={teamCount}
                        currentTeamId={currentPlayer?.teamId ?? null}
                        leftPressed={leftPressed}
                        rightPressed={rightPressed}
                        onLeftDown={handleLeftDown}
                        onLeftUp={handleLeftUp}
                        onRightDown={handleRightDown}
                        onRightUp={handleRightUp}
                        onTeamChange={handleTeamChange}
                    />
                )}
            </section>
        </main>
    );
}
