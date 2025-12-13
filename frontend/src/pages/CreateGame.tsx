import React, { useState } from "react";
import { Container, Typography, TextField, Button, Stack } from "@mui/material";

interface Props {
    onCreateGame: (room: string, name: string, isHost: boolean) => void;
    onCancel: () => void;
}

const CreateGame: React.FC<Props> = ({ onCreateGame, onCancel }) => {
    const [playerName, setPlayerName] = useState("");

    const handleCreate = () => {
        if (playerName) {
            const newRoom = Math.random()
                .toString(36)
                .substring(2, 7)
                .toUpperCase();
            onCreateGame(newRoom, playerName, true);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 10, textAlign: "center" }}>
            <Typography variant="h4" gutterBottom>
                Create Game
            </Typography>
            <Stack spacing={2} mt={2}>
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
                        onClick={handleCreate}
                    >
                        Create
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

export default CreateGame;
