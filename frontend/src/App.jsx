import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import HostLobby from './pages/HostLobby'
import HostGame from './pages/HostGame'
import PlayerJoin from './pages/PlayerJoin'
import PlayerLobby from './pages/PlayerLobby'
import PlayerControls from './pages/PlayerControls'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host/lobby" element={<HostLobby />} />
        <Route path="/host/game" element={<HostGame />} />
        <Route path="/player/join" element={<PlayerJoin />} />
        <Route path="/player/lobby" element={<PlayerLobby />} />
        <Route path="/player/controls" element={<PlayerControls />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
