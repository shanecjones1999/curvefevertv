import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import './HostLobby.css'

function HostLobby() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [token, setToken] = useState('')
  const [players, setPlayers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('host_token')
    const storedRoomCode = localStorage.getItem('room_code')

    if (storedToken && storedRoomCode) {
      setToken(storedToken)
      setRoomCode(storedRoomCode)
      setIsLoading(false)
    } else {
      createRoom()
    }
  }, [])

  const createRoom = async () => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      setRoomCode(data.room_code)
      setToken(data.token)
      localStorage.setItem('host_token', data.token)
      localStorage.setItem('room_code', data.room_code)
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to create room:', error)
    }
  }

  const handleMessage = useCallback((message) => {
    if (message.type === 'lobby_update') {
      setPlayers(message.players)
    } else if (message.type === 'game_started') {
      navigate('/host/game')
    }
  }, [navigate])

  const { isConnected, sendMessage } = useWebSocket(token, handleMessage)

  const startGame = () => {
    if (players.length > 0) {
      sendMessage({ type: 'start_game' })
    }
  }

  if (isLoading) {
    return (
      <div className="host-lobby-container">
        <div className="container">
          <div className="card">
            <h2>Creating room...</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="host-lobby-container">
      <div className="container">
        <div className="card">
          <h1>Game Lobby</h1>

          <div className="room-code-display">
            <div className="room-code-label">Room Code</div>
            <div className="room-code">{roomCode}</div>
            <div className="room-code-hint">
              Players: Open your phone and enter this code
            </div>
          </div>

          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>

          <div className="players-section">
            <h2>Players ({players.length})</h2>
            {players.length === 0 ? (
              <p className="waiting-text">Waiting for players to join...</p>
            ) : (
              <ul className="players-list">
                {players.map((player) => (
                  <li key={player.player_id} className="player-item">
                    <span className="player-name">{player.name}</span>
                    <div className="player-info">
                      <span className="player-score">Score: {player.score}</span>
                      <span className={`player-status ${player.connected ? 'online' : 'offline'}`}>
                        {player.connected ? '🟢' : '🔴'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            className="btn btn-success btn-large"
            onClick={startGame}
            disabled={players.length === 0}
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  )
}

export default HostLobby
