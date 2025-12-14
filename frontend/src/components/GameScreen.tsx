// src/components/GameScreen.tsx
import React, { useContext } from "react";
import { useParams } from "react-router-dom";
import HostLobby from "./HostLobby";
import PlayerLobby from "./PlayerLobby";
import { AuthContext } from "../contexts/AuthContext";
import { UserContext } from "../contexts/UserContext";

const GameScreen: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const { token } = useContext(AuthContext);

    const role = useContext(UserContext).role;
    const playerName = useContext(UserContext).name || "";

    if (!gameId) return <div>Error: no game ID</div>;
    if (!token) return <div>Missing auth token</div>;

    return (
        <div>
            {role === "host" ? (
                <HostLobby />
            ) : (
                <PlayerLobby gameId={gameId} playerName={playerName} />
            )}
        </div>
    );
};

export default GameScreen;
