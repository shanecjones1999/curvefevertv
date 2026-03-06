import { useEffect, useMemo, useRef, useState } from "react";
import socket from "./socket";
import { EVENTS } from "../../shared-types/events.ts";

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

export default function Phone({ onLeave }: Props) {
    const storedSession = useMemo(() => getStoredPlayerSession(), []);
    const [roomCode, setRoomCode] = useState(storedSession?.roomCode ?? "");
    const [name, setName] = useState(storedSession?.name ?? "Player");
    const [joined, setJoined] = useState(!!storedSession);
    const playerIdRef = useRef<string | null>(storedSession?.playerId ?? null);
    const pressRef = useRef<{ left: boolean; right: boolean }>({
        left: false,
        right: false,
    });
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        const rejoinFromSession = () => {
            if (storedSession && playerIdRef.current) {
                socket.emit(
                    "rejoinRoom",
                    {
                        roomCode: storedSession.roomCode,
                        playerId: playerIdRef.current,
                        name: storedSession.name,
                    },
                    (res: JoinRoomResponse) => {
                        if (res?.ok && res.player?.id) {
                            playerIdRef.current = res.player.id;
                            setJoined(true);
                            localStorage.setItem(
                                PLAYER_SESSION_KEY,
                                JSON.stringify({
                                    roomCode: storedSession.roomCode,
                                    name: res.player.name ?? storedSession.name,
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
            } else if (localStorage.getItem(PLAYER_SESSION_KEY)) {
                playerIdRef.current = null;
                localStorage.removeItem(PLAYER_SESSION_KEY);
            }
        };

        socket.on("connect", rejoinFromSession);
        rejoinFromSession();

        // if the host deletes the room, the client should depart too
        const handleRoomClosed = () => {
            alert("Room has been closed by the host.");
            playerIdRef.current = null;
            setJoined(false);
            localStorage.removeItem(PLAYER_SESSION_KEY);
            onLeave();
        };
        socket.on(EVENTS.ROOM_CLOSED, handleRoomClosed);

        return () => {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            socket.off("connect", rejoinFromSession);
            socket.off(EVENTS.ROOM_CLOSED, handleRoomClosed);
        };
    }, [storedSession]);

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
    }, [joined]);

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

    function startSendingInput() {
        if (intervalRef.current) return;
        intervalRef.current = window.setInterval(() => {
            const payload = {
                turnLeft: pressRef.current.left,
                turnRight: pressRef.current.right,
            };
            socket.emit("input", payload);
        }, 50);
    }

    function stopSendingInput() {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }

    function handleLeftDown() {
        pressRef.current.left = true;
        startSendingInput();
    }

    function handleLeftUp() {
        pressRef.current.left = false;
    }

    function handleRightDown() {
        pressRef.current.right = true;
        startSendingInput();
    }

    function handleRightUp() {
        pressRef.current.right = false;
    }

    return (
        <div style={{ padding: 16 }}>
            <h2>Phone Controller</h2>
            {!joined ? (
                <div>
                    <div>
                        <label>Room Code: </label>
                        <input
                            value={roomCode}
                            onChange={(e) =>
                                setRoomCode(e.target.value.toUpperCase())
                            }
                        />
                    </div>
                    <div>
                        <label>Name: </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <button onClick={handleJoin}>Join</button>
                    <button onClick={onLeave} style={{ marginLeft: 12 }}>
                        Back
                    </button>
                </div>
            ) : (
                <div>
                    <p>
                        Joined room {roomCode} as {name}
                    </p>
                    <div style={{ display: "flex", gap: 12 }}>
                        <button
                            onMouseDown={handleLeftDown}
                            onMouseUp={handleLeftUp}
                            onTouchStart={handleLeftDown}
                            onTouchEnd={handleLeftUp}
                            style={{ padding: 24 }}
                        >
                            Turn Left
                        </button>
                        <button
                            onMouseDown={handleRightDown}
                            onMouseUp={handleRightUp}
                            onTouchStart={handleRightDown}
                            onTouchEnd={handleRightUp}
                            style={{ padding: 24 }}
                        >
                            Turn Right
                        </button>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <button
                            onClick={() => {
                                pressRef.current.left = false;
                                pressRef.current.right = false;
                                stopSendingInput();
                            }}
                        >
                            Stop
                        </button>
                        <button
                            style={{ marginLeft: 12 }}
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
                                                playerId: playerIdRef.current,
                                            },
                                            () => {},
                                        );
                                    }
                                    playerIdRef.current = null;
                                    setJoined(false);
                                    localStorage.removeItem(PLAYER_SESSION_KEY);
                                    onLeave();
                                }
                            }}
                        >
                            Leave game
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
