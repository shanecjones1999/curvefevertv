import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./PlayerController.module.css";
import socket from "./socket";
import { EVENTS } from "./events";

const PLAYER_SESSION_KEY = "curvefever:playerSession";

type PlayerSession = {
    roomCode: string;
    name: string;
    playerId: string;
};

type JoinRoomResponse = {
    ok: boolean;
    player?: {
        id: string;
        name: string;
    };
    error?: string;
};

function getStoredPlayerSession(): PlayerSession | null {
    const raw = localStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<PlayerSession>;
        if (!parsed.roomCode || !parsed.name || !parsed.playerId) return null;
        return {
            roomCode: parsed.roomCode.toUpperCase(),
            name: parsed.name,
            playerId: parsed.playerId,
        };
    } catch {
        return null;
    }
}

type Props = { onLeave: () => void };

export default function PlayerController({ onLeave }: Props) {
    const storedSession = useMemo(() => getStoredPlayerSession(), []);
    const [roomCode, setRoomCode] = useState(storedSession?.roomCode ?? "");
    const [name, setName] = useState(storedSession?.name ?? "Player");
    const [joined, setJoined] = useState(false);
    const [isRejoining, setIsRejoining] = useState(!!storedSession);
    const playerIdRef = useRef<string | null>(storedSession?.playerId ?? null);
    const pressRef = useRef<{ left: boolean; right: boolean }>({
        left: false,
        right: false,
    });
    const intervalRef = useRef<number | null>(null);

    const startSendingInput = useCallback(() => {
        if (intervalRef.current) return;
        intervalRef.current = window.setInterval(() => {
            const payload = {
                turnLeft: pressRef.current.left,
                turnRight: pressRef.current.right,
            };
            socket.emit("input", payload);
        }, 50);
    }, []);

    const stopSendingInput = useCallback(() => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const handleLeftDown = useCallback(() => {
        pressRef.current.left = true;
        startSendingInput();
    }, [startSendingInput]);

    const handleLeftUp = useCallback(() => {
        pressRef.current.left = false;
    }, []);

    const handleRightDown = useCallback(() => {
        pressRef.current.right = true;
        startSendingInput();
    }, [startSendingInput]);

    const handleRightUp = useCallback(() => {
        pressRef.current.right = false;
    }, []);

    useEffect(() => {
        const rejoinFromSession = () => {
            // Only attempt rejoin if we have a stored session with a valid player ID
            if (!storedSession || !playerIdRef.current) {
                setIsRejoining(false);
                // Clean up any orphaned session data
                if (localStorage.getItem(PLAYER_SESSION_KEY)) {
                    playerIdRef.current = null;
                    localStorage.removeItem(PLAYER_SESSION_KEY);
                }
                return;
            }

            console.log(
                "[PlayerController] Attempting to rejoin room",
                storedSession.roomCode,
                "as player",
                playerIdRef.current,
            );

            socket.emit(
                "rejoinRoom",
                {
                    roomCode: storedSession.roomCode,
                    playerId: playerIdRef.current,
                    name: storedSession.name,
                },
                (res: JoinRoomResponse) => {
                    console.log("[PlayerController] rejoinRoom response:", res);
                    if (res?.ok && res.player?.id) {
                        console.log(
                            "[PlayerController] Successfully rejoined room",
                        );
                        playerIdRef.current = res.player.id;
                        setJoined(true);
                        setIsRejoining(false);
                        localStorage.setItem(
                            PLAYER_SESSION_KEY,
                            JSON.stringify({
                                roomCode: storedSession.roomCode,
                                name: res.player.name ?? storedSession.name,
                                playerId: res.player.id,
                            }),
                        );
                    } else {
                        console.log(
                            "[PlayerController] Rejoin failed:",
                            res?.error ?? "Unknown error",
                        );
                        playerIdRef.current = null;
                        setJoined(false);
                        setIsRejoining(false);
                        localStorage.removeItem(PLAYER_SESSION_KEY);
                    }
                },
            );
        };

        // Set up listener for socket connection
        socket.on("connect", rejoinFromSession);

        // Try to rejoin immediately if socket is already connected
        if (socket.connected) {
            console.log(
                "[PlayerController] Socket already connected, attempting rejoin",
            );
            rejoinFromSession();
        } else {
            console.log(
                "[PlayerController] Socket not connected yet, waiting for connection event",
            );
        }

        // if the host deletes the room, the client should depart too
        const handleRoomClosed = () => {
            alert("Room has been closed by the host.");
            playerIdRef.current = null;
            setJoined(false);
            setIsRejoining(false);
            localStorage.removeItem(PLAYER_SESSION_KEY);
            onLeave();
        };
        socket.on(EVENTS.ROOM_CLOSED, handleRoomClosed);

        return () => {
            stopSendingInput();
            socket.off("connect", rejoinFromSession);
            socket.off(EVENTS.ROOM_CLOSED, handleRoomClosed);
        };
    }, [storedSession, onLeave, stopSendingInput]);

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
        socket.emit(
            EVENTS.JOIN_ROOM,
            { roomCode, name },
            (res: JoinRoomResponse) => {
                if (res?.ok && res.player?.id) {
                    playerIdRef.current = res.player.id;
                    setJoined(true);
                    localStorage.setItem(
                        PLAYER_SESSION_KEY,
                        JSON.stringify({
                            roomCode: roomCode.toUpperCase(),
                            name,
                            playerId: res.player.id,
                        }),
                    );
                } else {
                    playerIdRef.current = null;
                    setJoined(false);
                    localStorage.removeItem(PLAYER_SESSION_KEY);
                }
            },
        );
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
                        <h2 className="title title-small">Player Controller</h2>
                    </div>
                    <button
                        className="ui-button ui-button-ghost"
                        onClick={onLeave}
                    >
                        Change Role
                    </button>
                </div>

                {!joined ? (
                    <div className="form-grid">
                        <div className="field-group">
                            <label htmlFor="room-code">Room Code</label>
                            <input
                                id="room-code"
                                className="ui-input"
                                value={roomCode}
                                onChange={(e) =>
                                    setRoomCode(e.target.value.toUpperCase())
                                }
                                maxLength={6}
                                placeholder="ABCD12"
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="player-name">Name</label>
                            <input
                                id="player-name"
                                className="ui-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={16}
                                placeholder="Player"
                            />
                        </div>

                        <div className="panel-row">
                            <button className="ui-button" onClick={handleJoin}>
                                Join Room
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.controllerLive}>
                        <p className="status-pill controller-status-pill">
                            Joined room {roomCode} as {name}
                        </p>
                        <div className={styles["button-row"]}>
                            <button
                                className={styles.button}
                                onMouseDown={handleLeftDown}
                                onMouseUp={handleLeftUp}
                                onTouchStart={handleLeftDown}
                                onTouchEnd={handleLeftUp}
                            >
                                Turn Left
                            </button>
                            <button
                                className={styles.button}
                                onMouseDown={handleRightDown}
                                onMouseUp={handleRightUp}
                                onTouchStart={handleRightDown}
                                onTouchEnd={handleRightUp}
                            >
                                Turn Right
                            </button>
                        </div>
                        <div className={styles.leaveWrap}>
                            <button
                                className="ui-button ui-button-danger"
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            "Are you sure you want to leave the game?",
                                        )
                                    ) {
                                        // clean up and notify server
                                        pressRef.current.left = false;
                                        pressRef.current.right = false;
                                        stopSendingInput();
                                        if (playerIdRef.current && roomCode) {
                                            socket.emit(
                                                EVENTS.LEAVE_ROOM,
                                                {
                                                    roomCode,
                                                    playerId:
                                                        playerIdRef.current,
                                                },
                                                () => {},
                                            );
                                        }
                                        playerIdRef.current = null;
                                        setJoined(false);
                                        localStorage.removeItem(
                                            PLAYER_SESSION_KEY,
                                        );
                                        onLeave();
                                    }
                                }}
                            >
                                Leave Game
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
