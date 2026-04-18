import { useEffect } from "react";
import socket from "../socket";
import { EVENTS } from "../events";
import { HOST_SESSION_KEY } from "../constants/storage";
import type { GameMode, Player } from "../types";
import type { GameConfig, GameOverPayload } from "../components/host/types";

type ReconnectHostResponse = {
    ok: boolean;
    roomCode?: string;
    players?: Player[];
    state?: "lobby" | "playing" | "finished";
    gameMode?: GameMode;
    winnerId?: string | null;
    leaderboard?: GameOverPayload["leaderboard"];
    targetScore?: number;
    gameConfig?: GameConfig;
    error?: string;
};

type UseHostRoomSyncParams = {
    hasRequestedRoomCreation: React.MutableRefObject<boolean>;
    setRoomCode: React.Dispatch<React.SetStateAction<string | null>>;
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
    setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setStartError: React.Dispatch<React.SetStateAction<string | null>>;
    setTargetScore: React.Dispatch<React.SetStateAction<number | null>>;
    setGameMode: React.Dispatch<React.SetStateAction<GameMode>>;
    setGameOverData: React.Dispatch<
        React.SetStateAction<GameOverPayload | null>
    >;
    setGameConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
};

export function useHostRoomSync({
    hasRequestedRoomCreation,
    setRoomCode,
    setPlayers,
    setPlaying,
    setStartError,
    setTargetScore,
    setGameMode,
    setGameOverData,
    setGameConfig,
}: UseHostRoomSyncParams) {
    useEffect(() => {
        const roomCreationRequestRef = hasRequestedRoomCreation;

        const applyGameConfig = (incoming?: GameConfig) => {
            if (!incoming) return;
            if (incoming.width <= 0 || incoming.height <= 0) return;
            setGameConfig({
                width: incoming.width,
                height: incoming.height,
            });
        };

        const applyTargetScore = (incoming?: number) => {
            if (typeof incoming !== "number") return;
            if (!Number.isFinite(incoming) || incoming <= 0) return;
            setTargetScore(Math.floor(incoming));
        };

        const applyGameMode = (incoming?: GameMode) => {
            if (incoming === "battle-royale") {
                setGameMode("battle-royale");
                return;
            }
            if (incoming === "classic") {
                setGameMode("classic");
            }
        };

        const requestCreateRoom = () => {
            socket.emit(
                "createRoom",
                null,
                (res: { roomCode: string; gameConfig?: GameConfig }) => {
                    if (!res?.roomCode) {
                        roomCreationRequestRef.current = false;
                        setStartError("Unable to create room");
                        return;
                    }
                    setRoomCode(res.roomCode);
                    if (res.gameConfig) {
                        setGameConfig(res.gameConfig);
                    }
                    setStartError(null);
                    localStorage.setItem(
                        HOST_SESSION_KEY,
                        JSON.stringify({ roomCode: res.roomCode }),
                    );
                },
            );
        };

        const reconnectFromSession = () => {
            const rawSession = localStorage.getItem(HOST_SESSION_KEY);
            if (!rawSession) {
                if (!roomCreationRequestRef.current) {
                    roomCreationRequestRef.current = true;
                    requestCreateRoom();
                }
                return;
            }
            try {
                const session = JSON.parse(rawSession) as { roomCode?: string };
                if (!session.roomCode) return;
                socket.emit(
                    "reconnectHost",
                    { roomCode: session.roomCode },
                    (res: ReconnectHostResponse) => {
                        if (res?.ok) {
                            setRoomCode(
                                (res.roomCode ?? session.roomCode ?? null) as
                                    | string
                                    | null,
                            );
                            if (Array.isArray(res.players)) {
                                setPlayers(res.players);
                            }
                            applyGameMode(res.gameMode);
                            applyTargetScore(res.targetScore);
                            applyGameConfig(res.gameConfig);
                            if (res.state === "finished") {
                                const fallbackLeaderboard = (res.players ?? [])
                                    .map((player) => ({
                                        id: player.id,
                                        name: player.name,
                                        score: player.score ?? 0,
                                        color: player.color,
                                        alive: player.alive,
                                    }))
                                    .sort(
                                        (firstPlayer, secondPlayer) =>
                                            (res.gameMode === "battle-royale"
                                                ? Number(secondPlayer.alive) -
                                                  Number(firstPlayer.alive)
                                                : secondPlayer.score -
                                                  firstPlayer.score) ||
                                            firstPlayer.name.localeCompare(
                                                secondPlayer.name,
                                            ),
                                    );
                                setGameOverData({
                                    winnerId:
                                        res.winnerId ??
                                        res.leaderboard?.[0]?.id ??
                                        fallbackLeaderboard[0]?.id ??
                                        null,
                                    gameMode: res.gameMode,
                                    targetScore: res.targetScore,
                                    leaderboard:
                                        res.leaderboard ?? fallbackLeaderboard,
                                });
                                setPlaying(true);
                            } else {
                                setGameOverData(null);
                                setPlaying(res.state === "playing");
                            }
                        } else {
                            localStorage.removeItem(HOST_SESSION_KEY);
                            setStartError(
                                res?.error ??
                                    "Unable to reconnect host session",
                            );
                        }
                    },
                );
            } catch {
                localStorage.removeItem(HOST_SESSION_KEY);
            }
        };

        socket.on("roomCreated", (data: { roomCode: string }) => {
            setRoomCode(data.roomCode);
        });

        socket.on("playerJoined", (data: { player: Player }) => {
            setPlayers((players) => [...players, data.player]);
        });

        socket.on(
            "lobbyUpdate",
            (data: {
                players: Player[];
                gameMode?: GameMode;
                targetScore?: number;
                gameConfig?: GameConfig;
            }) => {
                setPlayers(data.players);
                applyGameMode(data.gameMode);
                applyTargetScore(data.targetScore);
                applyGameConfig(data.gameConfig);
            },
        );

        socket.on(
            "startGame",
            (data?: {
                gameMode?: GameMode;
                targetScore?: number;
                gameConfig?: GameConfig;
            }) => {
                applyGameMode(data?.gameMode);
                applyTargetScore(data?.targetScore);
                applyGameConfig(data?.gameConfig);
                setGameOverData(null);
                setPlaying(true);
            },
        );

        socket.on(
            EVENTS.GAME_STATE,
            (state?: {
                players?: Player[];
                gameMode?: GameMode;
                targetScore?: number;
                arena?: GameConfig;
            }) => {
                if (state?.arena) {
                    applyGameConfig(state.arena);
                }
                applyGameMode(state?.gameMode);
                applyTargetScore(state?.targetScore);
                if (state && Array.isArray(state.players)) {
                    setPlayers(state.players);
                }
            },
        );

        socket.on(EVENTS.GAME_OVER, (data?: GameOverPayload) => {
            applyGameMode(data?.gameMode);
            applyTargetScore(data?.targetScore);
            if (data?.leaderboard && Array.isArray(data.leaderboard)) {
                setGameOverData(data);
            }
            setPlaying(true);
        });

        socket.on(EVENTS.ROUND_RESTART, () => {
            // Silently restart, game state updates automatically
        });

        socket.on("connect", reconnectFromSession);
        reconnectFromSession();

        return () => {
            socket.off("roomCreated");
            socket.off("playerJoined");
            socket.off("lobbyUpdate");
            socket.off("startGame");
            socket.off(EVENTS.GAME_STATE);
            socket.off(EVENTS.GAME_OVER);
            socket.off(EVENTS.ROUND_RESTART);
            socket.off("connect", reconnectFromSession);
        };
    }, [
        hasRequestedRoomCreation,
        setRoomCode,
        setPlayers,
        setPlaying,
        setStartError,
        setTargetScore,
        setGameMode,
        setGameOverData,
        setGameConfig,
    ]);
}
