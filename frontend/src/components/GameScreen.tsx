// src/components/GameScreen.tsx
import React, { useContext } from "react";
import { useParams } from "react-router-dom";
import HostLobby from "./HostLobby";
import PlayerLobby from "./PlayerLobby";
import { AuthContext } from "../contexts/AuthContext";
import { WebSocketProvider } from "../contexts/WebSocketProvider";

const GameScreen: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const { token } = useContext(AuthContext);

    const queryParams = new URLSearchParams(window.location.search);
    const role = queryParams.get("role");
    const playerName = queryParams.get("name") || "";

    if (!gameId) return <div>Error: no game ID</div>;
    if (!token) return <div>Missing auth token</div>;

    const wsUrl = `${import.meta.env.VITE_WS_URI}`;

    return (
        <WebSocketProvider url={wsUrl} jwt={token}>
            {role === "host" ? (
                <HostLobby gameId={gameId} />
            ) : (
                <PlayerLobby gameId={gameId} playerName={playerName} />
            )}
        </WebSocketProvider>
    );
};

export default GameScreen;
