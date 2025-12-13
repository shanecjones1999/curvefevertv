import React, { useState } from "react";

// Screens
const Home = ({ goTo }) => (
    <div>
        <h1>CurveFever Party Game</h1>
        <button onClick={() => goTo("hostLobby")}>Host</button>
        <button onClick={() => goTo("playerJoin")}>Player</button>
    </div>
);

const HostLobby = ({ goTo }) => {
    const [players, setPlayers] = useState([]);
    const startGame = () => goTo("hostGame");

    return (
        <div>
            <h1>Host Lobby</h1>
            <p>Room Code: ABCD</p>
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

const PlayerJoin = ({ goTo }) => {
    const [name, setName] = useState("");
    const [roomCode, setRoomCode] = useState("");

    const joinGame = () => goTo("playerLobby");

    return (
        <div>
            <h1>Join Game</h1>
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
            <button onClick={joinGame}>Join Game</button>
        </div>
    );
};

const PlayerLobby = ({ goTo }) => (
    <div>
        <h1>Lobby</h1>
        <p>Room Code: ABCD</p>
        <p>Your Name: Player1</p>
        <p>Waiting for host to start the game...</p>
        <button onClick={() => goTo("playerControls")}>
            Enter Controls (test)
        </button>
    </div>
);

const PlayerControls = () => {
    const turnLeft = () => console.log("Turn Left");
    const turnRight = () => console.log("Turn Right");

    return (
        <div>
            <h1>Player Controls</h1>
            <button onClick={turnLeft}>Left</button>
            <button onClick={turnRight}>Right</button>
        </div>
    );
};

const HostGameView = () => (
    <div>
        <h1>Game Arena</h1>
        <canvas width={800} height={600}></canvas>
    </div>
);

// Main App
const App = () => {
    const [currentScreen, setCurrentScreen] = useState("home");

    const renderScreen = () => {
        switch (currentScreen) {
            case "home":
                return <Home goTo={setCurrentScreen} />;
            case "hostLobby":
                return <HostLobby goTo={setCurrentScreen} />;
            case "playerJoin":
                return <PlayerJoin goTo={setCurrentScreen} />;
            case "playerLobby":
                return <PlayerLobby goTo={setCurrentScreen} />;
            case "playerControls":
                return <PlayerControls />;
            case "hostGame":
                return <HostGameView />;
            default:
                return <Home goTo={setCurrentScreen} />;
        }
    };

    return <div>{renderScreen()}</div>;
};

export default App;
