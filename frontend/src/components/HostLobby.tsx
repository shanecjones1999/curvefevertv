import React, { useEffect, useState, useContext } from "react";
import { UserContext } from "../contexts/UserContext";
import { io, Socket } from "socket.io-client";

interface PlayerJoinedData {
    name: string;
}

const HostLobby: React.FC = () => {
    const [players, setPlayers] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);

    const roomCode = useContext(UserContext).roomCode;

    useEffect(() => {
        // Create the socket connection
        const newSocket = io(import.meta.env.VITE_WS_URI); // Replace with your server URL
        setSocket(newSocket);

        newSocket.on("connect", () => {
            console.log("Connected to server");
            setConnected(true);
            newSocket.emit("join_room", { room: roomCode });
        });

        newSocket.on("disconnect", () => {
            console.log("Disconnected from server");
            setConnected(false);
        });

        // Listen for player_joined events
        newSocket.on("player_joined", (data: PlayerJoinedData) => {
            console.log("Player joined:", data.name);
            setPlayers((prev) => [...prev, data.name]);
        });

        // Clean up on unmount
        return () => {
            newSocket.disconnect();
        };
    }, []);

    const startGame = () => {
        if (socket) {
            socket.emit("start_game", {});
        }
    };

    return (
        <div>
            <h2>Host Lobby</h2>
            <p>Status: {connected ? "Connected" : "Disconnected"}</p>

            <h3>Players:</h3>
            <ul>
                {players.map((p) => (
                    <li key={p}>{p}</li>
                ))}
            </ul>

            <button onClick={startGame} disabled={!connected}>
                Start Game
            </button>
        </div>
    );
};

export default HostLobby;
