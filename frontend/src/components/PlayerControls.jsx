// src/components/PlayerControls.jsx
import React, { useEffect, useState } from "react";
import { Paper, Stack, Button, Typography, List, ListItem } from "@mui/material";

function PlayerControls({ roomCode, playerId }) {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Create WebSocket connection
    const socket = new WebSocket(`ws://localhost:8000/ws/${roomCode}/${playerId}`);

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    socket.onmessage = (event) => {
      console.log("Received:", event.data);
      setMessages((prev) => [...prev, event.data]);
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    setWs(socket);

    // Cleanup on unmount
    return () => socket.close();
  }, [roomCode, playerId]);

  const sendCommand = (direction) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(direction);
    }
  };

  return (
    <Paper sx={{ p: 2 }} elevation={2}>
      <Typography variant="h6" gutterBottom>
        Player Controls
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="contained" color="primary" onClick={() => sendCommand("LEFT")}>
          Turn Left
        </Button>
        <Button variant="contained" color="primary" onClick={() => sendCommand("RIGHT")}>
          Turn Right
        </Button>
      </Stack>

      <Typography variant="subtitle1" gutterBottom>
        Messages from server:
      </Typography>
      <List dense>
        {messages.map((m, i) => (
          <ListItem key={i}>{m}</ListItem>
        ))}
      </List>
    </Paper>
  );
}

export default PlayerControls;
