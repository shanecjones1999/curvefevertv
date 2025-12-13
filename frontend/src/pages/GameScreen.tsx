import React, { useEffect } from "react";
import { Container, Typography, Button, Stack } from "@mui/material";

interface Props {
    roomCode: string;
    playerName: string;
    isHost: boolean;
    onExit: () => void;
}

const GameScreen: React.FC<Props> = ({
    roomCode,
    playerName,
    isHost,
    onExit,
}) => {
    useEffect(() => {
        console.log(
            `${playerName} joined ${roomCode} as ${isHost ? "Host" : "Player"}`
        );
        // Here you can initialize your WebSocket connection
    }, [roomCode, playerName, isHost]);

    return (
        <Container maxWidth="sm" sx={{ mt: 10, textAlign: "center" }}>
            <Typography variant="h4" gutterBottom>
                Room: {roomCode}
            </Typography>
            <Typography variant="h6" gutterBottom>
                Player: {playerName} ({isHost ? "Host" : "Player"})
            </Typography>
            <Stack direction="row" justifyContent="center">
                <Button variant="contained" color="secondary" onClick={onExit}>
                    Exit Game
                </Button>
            </Stack>
        </Container>
    );
};

export default GameScreen;
