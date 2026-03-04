import { useEffect, useState } from "react";
import socket from "./socket";
import { EVENTS } from "../../shared-types/events";
import type { Player } from "../../shared-types/types";
import PhaserGame from "./PhaserGame";

const HOST_SESSION_KEY = "curvefever:hostSession";

type ReconnectHostResponse = {
    ok: boolean;
    roomCode?: string;
    players?: Player[];
    state?: "lobby" | "playing" | "finished";
    error?: string;
};

type StartGameResponse = {
    ok: boolean;
    error?: string;
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
    useEffect(() => {
        const reconnectFromSession = () => {
            const rawSession = localStorage.getItem(HOST_SESSION_KEY);
            if (!rawSession) return;
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

        socket.on("lobbyUpdate", (data: { players: Player[] }) => {
            setPlayers(data.players);
        });

        socket.on("startGame", () => setPlaying(true));
        socket.on("gameState", (state) => {
            // host should render the game state; for now we replace player list
            if (state && Array.isArray(state.players))
                setPlayers(state.players);
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
            socket.off("gameState");
            socket.off(EVENTS.ROUND_RESTART);
            socket.off("connect", reconnectFromSession);
        };
    }, []);

    function handleCreateRoom() {
        socket.emit("createRoom", null, (res: { roomCode: string }) => {
            setRoomCode(res.roomCode);
            setStartError(null);
            localStorage.setItem(
                HOST_SESSION_KEY,
                JSON.stringify({ roomCode: res.roomCode }),
            );
        });
    }

    function handleStartGame() {
        if (!roomCode) return;
        socket.emit("startGame", { roomCode }, (res: StartGameResponse) => {
            if (res?.ok) {
                setStartError(null);
                setPlaying(true);
            } else {
                setStartError(res?.error ?? "Unable to start game");
            }
        });
    }

    return (
        <div style={{ padding: 16 }}>
            <h2>Host</h2>
            <button onClick={onLeave} style={{ marginBottom: 12 }}>
                Change Role
            </button>
            <div>
                <button onClick={handleCreateRoom} disabled={!!roomCode}>
                    Create Room
                </button>
                <span style={{ marginLeft: 12 }}>
                    {roomCode ? `Room: ${roomCode}` : "No room"}
                </span>
                {roomCode && (
                    <button
                        style={{ marginLeft: 12 }}
                        onClick={() => {
                            if (
                                window.confirm(
                                    "End session and leave the room?",
                                )
                            ) {
                                // tell server to delete the room
                                socket.emit(
                                    EVENTS.LEAVE_ROOM,
                                    { roomCode },
                                    () => {},
                                );
                                localStorage.removeItem(HOST_SESSION_KEY);
                                setRoomCode(null);
                                setPlayers([]);
                                setPlaying(false);
                                onLeave();
                            }
                        }}
                    >
                        Leave room
                    </button>
                )}
            </div>

            <div style={{ marginTop: 16 }}>
                <h3>Players</h3>
                <ul>
                    {players.map((p) => (
                        <li key={p.id}>
                            {p.name} {p.alive ? "" : "(dead)"}
                        </li>
                    ))}
                </ul>
            </div>

            <div style={{ marginTop: 16 }}>
                <button
                    onClick={handleStartGame}
                    disabled={playing || players.length < 2}
                >
                    Start Game
                </button>
                {startError && (
                    <div style={{ marginTop: 8, color: "#ff8080" }}>
                        {startError}
                    </div>
                )}
            </div>

            {playing && (
                <div style={{ marginTop: 24 }}>
                    <PhaserGame players={players} width={800} height={600} />
                </div>
            )}
        </div>
    );
}
