// src/components/PlayerLobby.tsx
import React from "react";

interface PlayerLobbyProps {
    gameId: string;
    playerName: string;
}

const PlayerLobby: React.FC<PlayerLobbyProps> = ({ gameId, playerName }) => (
    <div>
        <h1>Player Lobby</h1>
        <p>Room Code: {gameId}</p>
        <p>Your Name: {playerName}</p>
        <p>Waiting for host to start the game...</p>
    </div>
);

export default PlayerLobby;
