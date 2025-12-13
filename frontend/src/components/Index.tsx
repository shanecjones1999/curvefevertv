// src/components/Index.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Index: React.FC = () => {
    const navigate = useNavigate();
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
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ user_type: "host" }),
                }
            );

            if (!response.ok) {
                throw new Error("Failed to create room");
            }

            const data = await response.json();
            const gameId = data.room_code;

            navigate(`/game/${gameId}`);
        } catch (err) {
            console.error(err);
            alert("Error creating room");
        } finally {
            setLoading(false);
        }
    };

    const handlePlayer = () => {
        if (!name || !roomCode) return alert("Enter your name and room code");
        navigate(`/game/${roomCode}?role=player&name=${name}`);
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
