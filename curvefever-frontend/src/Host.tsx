import { useEffect, useState } from "react";
import socket from "./socket";
import { EVENTS } from "./events";
import type { Player } from "./types";
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
        <main className="page-shell">
            <section className="panel host-panel">
                <div className="panel-header">
                    <div>
                        <p className="eyebrow">Host Console</p>
                        <h2 className="title title-small">
                            Game Control Center
                        </h2>
                    </div>
                    <button
                        className="ui-button ui-button-ghost"
                        onClick={onLeave}
                    >
                        Change Role
                    </button>
                </div>

                <div className="panel-row">
                    <button
                        className="ui-button"
                        onClick={handleCreateRoom}
                        disabled={!!roomCode}
                    >
                        Create Room
                    </button>
                    <div className="status-pill">
                        {roomCode ? `Room ${roomCode}` : "No active room"}
                    </div>
                    {roomCode && (
                        <button
                            className="ui-button ui-button-danger"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "End session and leave the room?",
                                    )
                                ) {
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
                            Leave Room
                        </button>
                    )}
                </div>

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
                        {players.map((p) => (
                            <li key={p.id} className="player-row">
                                <span>{p.name}</span>
                                <span className={p.alive ? "alive" : "dead"}>
                                    {p.alive ? "Ready" : "Eliminated"}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

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
                    <div className="game-stage">
                        <PhaserGame
                            players={players}
                            width={1280}
                            height={720}
                        />
                    </div>
                )}
            </section>
        </main>
    );
}
