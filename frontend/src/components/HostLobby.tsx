import React, { useState, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { UserContext } from "../contexts/UserContext";

interface HostLobbyProps {
    gameId: string;
}

const HostLobby: React.FC<HostLobbyProps> = ({ gameId }) => {
    const [players, setPlayers] = useState<string[]>([]);

    const { token } = useContext(AuthContext);
    const { role, userId, roomCode } = useContext(UserContext);

    const startGame = () => console.log("Start game for", gameId);

    return (
        <div>
            <h1>Host Lobby</h1>

            <p>
                <strong>Game ID:</strong> {gameId}
            </p>
            <p>
                <strong>User Role:</strong> {role ?? "unknown"}
            </p>
            <p>
                <strong>User ID:</strong> {userId ?? "unknown"}
            </p>
            <p>
                <strong>Room Code:</strong> {roomCode ?? "unknown"}
            </p>

            <p>
                <strong>JWT Token:</strong>
            </p>
            <pre style={{ maxWidth: 600, overflow: "auto" }}>
                {token ?? "Not set"}
            </pre>

            <h2>Players:</h2>
            <ul>
                {players.map((p, i) => (
                    <li key={i}>{p}</li>
                ))}
            </ul>

            <button onClick={startGame} disabled={players.length < 1}>
                Start Game
            </button>
        </div>
    );
};

export default HostLobby;
