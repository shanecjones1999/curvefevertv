import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './PlayerJoin.css'

function PlayerJoin() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleJoin = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim() || !roomCode.trim()) {
      setError('Please enter both name and room code')
      return
    }

    if (roomCode.length !== 4) {
      setError('Room code must be 4 letters')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/rooms/${roomCode.toUpperCase()}/join?name=${encodeURIComponent(name.trim())}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to join room')
      }

      const data = await response.json()

      localStorage.setItem('player_token', data.token)
      localStorage.setItem('player_id', data.player_id)
      localStorage.setItem('player_name', data.name)
      localStorage.setItem('room_code', data.room_code)

      navigate('/player/lobby')
    } catch (error) {
      setError(error.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="player-join-container">
      <div className="container">
        <div className="card">
          <h1>Join Game</h1>

          <form onSubmit={handleJoin} className="join-form">
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="roomCode">Room Code</label>
              <input
                id="roomCode"
                type="text"
                placeholder="ABCD"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="room-code-input"
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Game'}
            </button>
          </form>

          <button
            className="btn-back"
            onClick={() => navigate('/')}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlayerJoin
