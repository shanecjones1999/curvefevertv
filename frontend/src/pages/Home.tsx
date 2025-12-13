import React from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
    const navigate = useNavigate();

    return (
        <div>
            <h1>CurveFever Party Game</h1>
            <button onClick={() => navigate("/host-lobby")}>Host</button>
            <button onClick={() => navigate("/player-join")}>Player</button>
        </div>
    );
};

export default Home;
