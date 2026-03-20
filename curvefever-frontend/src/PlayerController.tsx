import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { EVENTS } from "./events";
import { PLAYER_SESSION_KEY } from "./constants/storage";
import { ROOM_CODE_REGEX, sanitizeRoomCodeInput } from "./utils/roomCode";
import { getStoredPlayerSession } from "./utils/playerSession";
import PlayerJoinForm from "./components/player/PlayerJoinForm";
import PlayerLiveControls from "./components/player/PlayerLiveControls";
import { usePlayerRejoin } from "./hooks/usePlayerRejoin";

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
    const [roomCode, setRoomCode] = useState(storedSession?.roomCode ?? "");
    const [name, setName] = useState(storedSession?.name ?? "");
    const [joined, setJoined] = useState(false);
    const [leftPressed, setLeftPressed] = useState(false);
    const [rightPressed, setRightPressed] = useState(false);
    const [isRejoining, setIsRejoining] = useState(!!storedSession);
    const [rejoinError, setRejoinError] = useState<string | null>(null);
    const playerIdRef = useRef<string | null>(storedSession?.playerId ?? null);
    const pressRef = useRef<{ left: boolean; right: boolean }>({
        left: false,
        right: false,
    });
    const intervalRef = useRef<number | null>(null);

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
        pressRef.current.left = true;
        setLeftPressed(true);
        emitInput();
        startSendingInput();
    }, [emitInput, startSendingInput]);

    const handleLeftUp = useCallback(() => {
        pressRef.current.left = false;
        setLeftPressed(false);
        emitInput();
        if (!pressRef.current.left && !pressRef.current.right) {
            stopSendingInput();
        }
    }, [emitInput, stopSendingInput]);

    const handleRightDown = useCallback(() => {
        pressRef.current.right = true;
        setRightPressed(true);
        emitInput();
        startSendingInput();
    }, [emitInput, startSendingInput]);

    const handleRightUp = useCallback(() => {
        pressRef.current.right = false;
        setRightPressed(false);
        emitInput();
        if (!pressRef.current.left && !pressRef.current.right) {
            stopSendingInput();
        }
    }, [emitInput, stopSendingInput]);

    usePlayerRejoin({
        storedSession,
        playerIdRef,
        stopSendingInput,
        onLeave,
        setJoined,
        setIsRejoining,
        setRejoinError,
    });

    useEffect(() => {
        if (!joined) return;

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
    }, [joined, handleLeftDown, handleLeftUp, handleRightDown, handleRightUp]);

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

        const activeSession = getStoredPlayerSession();
        const candidatePlayerId =
            playerIdRef.current ??
            (activeSession?.roomCode === normalizedRoomCode
                ? activeSession.playerId
                : null);

        socket.emit(
            EVENTS.JOIN_ROOM,
            {
                roomCode: normalizedRoomCode,
                name: normalizedName,
                playerId: candidatePlayerId ?? undefined,
            },
            (res: JoinRoomResponse) => {
                if (res?.ok && res.player?.id) {
                    playerIdRef.current = res.player.id;
                    setJoined(true);
                    setRejoinError(null);
                    setRoomCode(normalizedRoomCode);
                    setName(normalizedName);
                    localStorage.setItem(
                        PLAYER_SESSION_KEY,
                        JSON.stringify({
                            roomCode: normalizedRoomCode,
                            name: normalizedName,
                            playerId: res.player.id,
                        }),
                    );
                } else {
                    playerIdRef.current = null;
                    setJoined(false);
                    setRejoinError(res?.error ?? "Unable to join room.");
                    localStorage.removeItem(PLAYER_SESSION_KEY);
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
            setJoined(false);
        }

        localStorage.removeItem(PLAYER_SESSION_KEY);
        onLeave();
    }

    // Show a loading state while attempting to rejoin
    if (isRejoining) {
        return (
            <main className="page-shell">
                <section className="panel controller-panel">
                    <p className="eyebrow">Controller</p>
                    <h2 className="title title-small">Reconnecting...</h2>
                    <p className="subtitle">
                        Restoring your previous game session.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="page-shell">
            <section className="panel controller-panel">
                <div className="panel-header">
                    <div>
                        <p className="eyebrow">Mobile Console</p>
                        <h2 className="title title-small">Join as Player</h2>
                    </div>
                    <button
                        className="ui-button ui-button-ghost"
                        onClick={handleLeaveGame}
                    >
                        Leave Game
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
                        leftPressed={leftPressed}
                        rightPressed={rightPressed}
                        onLeftDown={handleLeftDown}
                        onLeftUp={handleLeftUp}
                        onRightDown={handleRightDown}
                        onRightUp={handleRightUp}
                    />
                )}
            </section>
        </main>
    );
}
