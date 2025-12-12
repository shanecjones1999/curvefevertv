import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import './PlayerControls.css'

function PlayerControls() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [isAlive, setIsAlive] = useState(true)
  const [score, setScore] = useState(0)
  const [winner, setWinner] = useState(null)
  const [leftPressed, setLeftPressed] = useState(false)
  const [rightPressed, setRightPressed] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem('player_token')
    const storedPlayerId = localStorage.getItem('player_id')
    const storedPlayerName = localStorage.getItem('player_name')

    if (!storedToken || !storedPlayerId) {
      navigate('/player/join')
      return
    }

    setToken(storedToken)
    setPlayerId(storedPlayerId)
    setPlayerName(storedPlayerName || 'Player')
  }, [navigate])

  const handleMessage = useCallback((message) => {
    if (message.type === 'game_state') {
      const player = message.data.players.find(p => p.player_id === playerId)
      if (player) {
        setIsAlive(player.is_alive)
        setScore(player.score)
      }
    } else if (message.type === 'round_end') {
      setWinner(message.winner)
    } else if (message.type === 'game_restarted') {
      setWinner(null)
      setIsAlive(true)
      navigate('/player/lobby')
    }
  }, [playerId, navigate])

  const { sendMessage } = useWebSocket(token, handleMessage)

  const handleTouchStart = (direction) => {
    if (direction === 'left') {
      setLeftPressed(true)
    } else {
      setRightPressed(true)
    }
    sendMessage({
      type: 'control',
      direction: direction
    })
  }

  const handleTouchEnd = (direction) => {
    if (direction === 'left') {
      setLeftPressed(false)
    } else {
      setRightPressed(false)
    }
    sendMessage({
      type: 'control',
      direction: 'none'
    })
  }

  return (
    <div className="player-controls-container">
      <div className="controls-header">
        <div className="player-status-bar">
          <span className="player-name">{playerName}</span>
          <span className="player-score">Score: {score}</span>
        </div>
        {!isAlive && !winner && (
          <div className="death-message">
            💀 You're out! Watch the others...
          </div>
        )}
      </div>

      {winner && (
        <div className="winner-message">
          {winner === playerId ? (
            <>
              <h1>🏆 You Won!</h1>
              <p>Waiting for host to start next round...</p>
            </>
          ) : (
            <>
              <h1>Round Over</h1>
              <p>Waiting for host to start next round...</p>
            </>
          )}
        </div>
      )}

      <div className="controls-area">
        <button
          className={`control-btn control-btn-left ${leftPressed ? 'pressed' : ''}`}
          onTouchStart={(e) => {
            e.preventDefault()
            handleTouchStart('left')
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            handleTouchEnd('left')
          }}
          onMouseDown={() => handleTouchStart('left')}
          onMouseUp={() => handleTouchEnd('left')}
          onMouseLeave={() => handleTouchEnd('left')}
        >
          <span className="control-arrow">←</span>
          <span className="control-label">LEFT</span>
        </button>

        <button
          className={`control-btn control-btn-right ${rightPressed ? 'pressed' : ''}`}
          onTouchStart={(e) => {
            e.preventDefault()
            handleTouchStart('right')
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            handleTouchEnd('right')
          }}
          onMouseDown={() => handleTouchStart('right')}
          onMouseUp={() => handleTouchEnd('right')}
          onMouseLeave={() => handleTouchEnd('right')}
        >
          <span className="control-arrow">→</span>
          <span className="control-label">RIGHT</span>
        </button>
      </div>
    </div>
  )
}

export default PlayerControls
