import { useNavigate } from 'react-router-dom'
import './Home.css'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="home-container">
      <div className="container">
        <div className="card home-card">
          <h1>🎮 CurveFever Party</h1>
          <p className="subtitle">Local multiplayer madness!</p>

          <div className="button-group">
            <button
              className="btn btn-primary btn-large"
              onClick={() => navigate('/host/lobby')}
            >
              Create Game (Host)
            </button>

            <button
              className="btn btn-secondary btn-large"
              onClick={() => navigate('/player/join')}
            >
              Join Game (Player)
            </button>
          </div>

          <div className="info-section">
            <h3>How to Play:</h3>
            <ul>
              <li>Host creates a game on TV/desktop</li>
              <li>Players join with their phones</li>
              <li>Control your curve with left/right buttons</li>
              <li>Avoid trails and walls - last one alive wins!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
