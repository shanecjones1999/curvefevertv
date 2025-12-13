// src/components/HostLobby.tsx
import React, { useState } from 'react';

interface HostLobbyProps {
  gameId: string;
}

const HostLobby: React.FC<HostLobbyProps> = ({ gameId }) => {
  const [players, setPlayers] = useState<string[]>([]);

  const startGame = () => console.log('Start game for', gameId);

  return (
    <div>
      <h1>Host Lobby</h1>
      <p>Room Code: {gameId}</p>
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

export default HostLobby;
