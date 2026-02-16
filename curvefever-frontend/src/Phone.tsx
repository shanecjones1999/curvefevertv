import { useEffect, useRef, useState } from "react";
import socket from "./socket";

export default function Phone() {
    const [roomCode, setRoomCode] = useState("");
    const [name, setName] = useState("Player");
    const [joined, setJoined] = useState(false);
    const pressRef = useRef<{ left: boolean; right: boolean }>({
        left: false,
        right: false,
    });
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
        };
    }, []);

    function handleJoin() {
        socket.emit("joinRoom", { roomCode, name }, (res: any) => {
            if (res?.ok) setJoined(true);
        });
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
                    </div>
                </div>
            )}
        </div>
    );
}
