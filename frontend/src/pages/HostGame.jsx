import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import './HostGame.css'

function HostGame() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [token, setToken] = useState('')
  const [gameState, setGameState] = useState(null)
  const [winner, setWinner] = useState(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('host_token')
    if (!storedToken) {
      navigate('/host/lobby')
      return
    }
    setToken(storedToken)
  }, [navigate])

  const handleMessage = useCallback((message) => {
    if (message.type === 'game_state') {
      setGameState(message.data)
    } else if (message.type === 'round_end') {
      setWinner(message.winner)
    } else if (message.type === 'game_restarted') {
      setWinner(null)
      navigate('/host/lobby')
    }
  }, [navigate])

  const { sendMessage } = useWebSocket(token, handleMessage)

  useEffect(() => {
    if (!gameState || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#0a0e27'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    gameState.players.forEach((player, index) => {
      const trail = gameState.trails[index]
      if (!trail || trail.length < 2) return

      ctx.strokeStyle = player.color
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      ctx.moveTo(trail[0][0], trail[0][1])

      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i][0], trail[i][1])
      }

      ctx.stroke()

      if (player.is_alive) {
        ctx.fillStyle = player.color
        ctx.beginPath()
        ctx.arc(player.x, player.y, 6, 0, Math.PI * 2)
        ctx.fill()

        ctx.shadowColor = player.color
        ctx.shadowBlur = 15
        ctx.fill()
        ctx.shadowBlur = 0
      }
    })

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = 'bold 16px Arial'
    gameState.players.forEach((player, index) => {
      ctx.fillStyle = player.color
      ctx.fillText(`${player.name}: ${player.score}`, 10, 30 + index * 25)
    })

  }, [gameState])

  const restartGame = () => {
    sendMessage({ type: 'restart_game' })
  }

  return (
    <div className="host-game-container">
      <div className="game-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="game-canvas"
        />

        {winner && gameState && (
          <div className="winner-overlay">
            <div className="winner-card">
              <h1>🏆 Round Over!</h1>
              <h2>
                {gameState.players.find(p => p.player_id === winner)?.name} wins!
              </h2>
              <div className="scoreboard">
                <h3>Scores</h3>
                {gameState.players
                  .sort((a, b) => b.score - a.score)
                  .map(player => (
                    <div key={player.player_id} className="score-item">
                      <span style={{ color: player.color }}>{player.name}</span>
                      <span>{player.score}</span>
                    </div>
                  ))}
              </div>
              <button
                className="btn btn-primary btn-large"
                onClick={restartGame}
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HostGame
