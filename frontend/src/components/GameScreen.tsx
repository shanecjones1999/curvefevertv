// src/components/GameScreen.tsx
import React from "react";
import { useParams } from "react-router-dom";
import HostLobby from "./HostLobby";
import PlayerLobby from "./PlayerLobby";

const GameScreen: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const queryParams = new URLSearchParams(window.location.search);
    const role = queryParams.get("role"); // 'host' or 'player'
    const playerName = queryParams.get("name") || "";

    if (!gameId) return <div>Error: no game ID</div>;

    return role === "host" ? (
        <HostLobby gameId={gameId} />
    ) : (
        <PlayerLobby gameId={gameId} playerName={playerName} />
    );
};

export default GameScreen;
