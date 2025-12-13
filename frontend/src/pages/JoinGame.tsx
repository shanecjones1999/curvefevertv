import React, { useState } from "react";
import { Container, Typography, TextField, Button, Stack } from "@mui/material";

interface Props {
    onJoinGame: (room: string, name: string, isHost: boolean) => void;
    onCancel: () => void;
}

const JoinGame: React.FC<Props> = ({ onJoinGame, onCancel }) => {
    const [roomCode, setRoomCode] = useState("");
    const [playerName, setPlayerName] = useState("");

    const handleJoin = () => {
        if (roomCode && playerName) {
            onJoinGame(roomCode, playerName, false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 10, textAlign: "center" }}>
            <Typography variant="h4" gutterBottom>
                Join Game
            </Typography>
            <Stack spacing={2} mt={2}>
                <TextField
                    label="Room Code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    fullWidth
                />
                <TextField
                    label="Your Name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    fullWidth
                />
                <Stack direction="row" spacing={2} justifyContent="center">
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleJoin}
                    >
                        Join
                    </Button>
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                </Stack>
            </Stack>
        </Container>
    );
};

export default JoinGame;
