import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import './PlayerLobby.css'

function PlayerLobby() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [players, setPlayers] = useState([])

  useEffect(() => {
    const storedToken = localStorage.getItem('player_token')
    const storedRoomCode = localStorage.getItem('room_code')
    const storedPlayerName = localStorage.getItem('player_name')

    if (!storedToken || !storedRoomCode || !storedPlayerName) {
      navigate('/player/join')
      return
    }

    setToken(storedToken)
    setRoomCode(storedRoomCode)
    setPlayerName(storedPlayerName)
  }, [navigate])

  const handleMessage = useCallback((message) => {
    if (message.type === 'lobby_update') {
      setPlayers(message.players)
    } else if (message.type === 'game_started') {
      navigate('/player/controls')
    }
  }, [navigate])

  const { isConnected } = useWebSocket(token, handleMessage)

  return (
    <div className="player-lobby-container">
      <div className="container">
        <div className="card">
          <h1>Waiting for Host</h1>

          <div className="player-info-card">
            <div className="info-item">
              <span className="info-label">Room Code</span>
              <span className="info-value room-code">{roomCode}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Your Name</span>
              <span className="info-value">{playerName}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Status</span>
              <span className={`info-value status ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
              </span>
            </div>
          </div>

          <div className="players-section">
            <h2>Players in Lobby ({players.length})</h2>
            <ul className="players-list">
              {players.map((player) => (
                <li key={player.player_id} className="player-item">
                  <span className="player-name">{player.name}</span>
                  <span className={`player-status ${player.connected ? 'online' : 'offline'}`}>
                    {player.connected ? '🟢' : '🔴'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="waiting-animation">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>

          <p className="waiting-text">
            Waiting for host to start the game...
          </p>
        </div>
      </div>
    </div>
  )
}

export default PlayerLobby
