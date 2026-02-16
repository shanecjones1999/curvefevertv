import { useEffect, useState } from "react";
import socket from "./socket";
import type { Player } from "../../shared-types/types";
import PhaserGame from "./PhaserGame";

export default function Host() {
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
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

        return () => {
            socket.off("roomCreated");
            socket.off("playerJoined");
            socket.off("lobbyUpdate");
            socket.off("startGame");
            socket.off("gameState");
        };
    }, []);

    function handleCreateRoom() {
        socket.emit("createRoom", null, (res: { roomCode: string }) => {
            setRoomCode(res.roomCode);
        });
    }

    function handleStartGame() {
        if (!roomCode) return;
        socket.emit("startGame", { roomCode }, (res: any) => {
            if (res?.ok) setPlaying(true);
        });
    }

    return (
        <div style={{ padding: 16 }}>
            <h2>Host</h2>
            <div>
                <button onClick={handleCreateRoom} disabled={!!roomCode}>
                    Create Room
                </button>
                <span style={{ marginLeft: 12 }}>
                    {roomCode ? `Room: ${roomCode}` : "No room"}
                </span>
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
            </div>

            {playing && (
                <div style={{ marginTop: 24 }}>
                    <PhaserGame players={players} width={800} height={600} />
                </div>
            )}
        </div>
    );
}
