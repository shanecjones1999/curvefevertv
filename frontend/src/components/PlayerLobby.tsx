import React, { useEffect } from "react";
import { io, Socket } from "socket.io-client";

interface PlayerLobbyProps {
    gameId: string;
    playerName: string;
}

const socket: Socket = io(import.meta.env.VITE_BACKEND_URI); // Singleton socket

const PlayerLobby: React.FC<PlayerLobbyProps> = ({ gameId, playerName }) => {
    useEffect(() => {
        if (!gameId || !playerName) return;

        // Join the room as a player
        socket.emit("join_room", {
            room: gameId,
            role: "player",
            name: playerName,
        });

        // Optionally listen for events like game start
        socket.on("start_game", () => {
            console.log("Host started the game!");
            // You could navigate to the game screen here
        });

        return () => {
            // Clean up listeners when component unmounts
            socket.off("start_game");
        };
    }, [gameId, playerName]);

    return (
        <div>
            <h1>Player Lobby</h1>
            <p>Room Code: {gameId}</p>
            <p>Your Name: {playerName}</p>
            <p>Waiting for host to start the game...</p>
        </div>
    );
};

export default PlayerLobby;
