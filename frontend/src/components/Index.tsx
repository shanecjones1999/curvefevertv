// src/components/Index.tsx
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { UserContext } from "../contexts/UserContext";

const Index: React.FC = () => {
    const navigate = useNavigate();

    const { setToken } = useContext(AuthContext);
    const { setUser } = useContext(UserContext);

    const [name, setName] = useState<string>("");
    const [roomCode, setRoomCode] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const handleHost = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URI}/games`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_type: "host" }),
                }
            );

            if (!response.ok) throw new Error("Failed to create room");

            const data = await response.json();

            const jwtToken = data.auth.token;
            const userId = data.auth.user_id;
            const role = data.auth.user_role; // "host"
            const roomCode = data.room_code;

            // 1️⃣ Store JWT
            setToken(jwtToken);

            // 2️⃣ Store user info
            setUser({
                role,
                userId,
                roomCode,
            });

            // 3️⃣ Navigate
            navigate(`/game/${roomCode}`);
        } catch (err) {
            console.error(err);
            alert("Error creating room");
        } finally {
            setLoading(false);
        }
    };

    const handlePlayer = () => {
        if (!name || !roomCode) return alert("Enter your name and room code");

        // Players usually get userId/JWT after joining via websocket or API
        setUser({
            role: "player",
            userId: null,
            roomCode,
        });

        navigate(`/game/${roomCode}`);
    };

    return (
        <div>
            <h1>CurveFever Party Game</h1>

            <button onClick={handleHost} disabled={loading}>
                {loading ? "Creating Room..." : "Host"}
            </button>

            <h2>Join as Player</h2>
            <input
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <input
                placeholder="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
            />
            <button onClick={handlePlayer}>Join Game</button>
        </div>
    );
};

export default Index;
