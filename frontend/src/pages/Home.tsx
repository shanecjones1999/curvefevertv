import React from "react";
import {
    Container,
    Stack,
    Button,
    Typography,
    Paper,
    Box,
} from "@mui/material";

type Props = {
    onCreate: () => void;
    onJoin: () => void;
};

const Home: React.FC<Props> = ({ onCreate, onJoin }) => {
    return (
        <Container maxWidth="sm">
            <Paper elevation={3} sx={{ p: 4, mt: 4, textAlign: "center" }}>
                <Typography variant="h4" gutterBottom>
                    Welcome to CurveFever
                </Typography>
                <Typography variant="body1" gutterBottom>
                    Play locally or connect to friends — quick and easy.
                </Typography>

                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    justifyContent="center"
                    sx={{ mt: 2 }}
                >
                    <Box sx={{ flex: 1 }}>
                        <Button
                            variant="contained"
                            fullWidth
                            color="primary"
                            onClick={onCreate}
                        >
                            Create Game
                        </Button>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Button
                            variant="outlined"
                            fullWidth
                            color="secondary"
                            onClick={onJoin}
                        >
                            Join Game
                        </Button>
                    </Box>
                </Stack>
            </Paper>
        </Container>
    );
};

export default Home;
