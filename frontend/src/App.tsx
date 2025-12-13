// src/App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./components/Index";
import GameScreen from "./components/GameScreen";

const App: React.FC = () => (
    <Router>
        <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/game/:gameId" element={<GameScreen />} />
        </Routes>
    </Router>
);

export default App;
