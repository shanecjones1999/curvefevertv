import { useEffect, useRef } from "react";
import socket from "../socket";
import { EVENTS } from "../events";
import { HOST_SESSION_KEY } from "../constants/storage";
import type { GameMode, GameState, LeaderboardEntry, Player } from "../types";
import type {
    GameConfig,
    GameOverPayload,
    RoundOverPayload,
} from "../components/host/types";
import { buildTeamLeaderboard } from "../utils/teamMode";

type ReconnectHostResponse = {
    ok: boolean;
    roomCode?: string;
    players?: Player[];
    state?: "lobby" | "playing" | "finished";
    gameMode?: GameMode;
    winnerId?: string | null;
    leaderboard?: GameOverPayload["leaderboard"];
    targetScore?: number;
    teamCount?: number;
    gameConfig?: GameConfig;
    error?: string;
};

type UseHostRoomSyncParams = {
    setRoomCode: React.Dispatch<React.SetStateAction<string | null>>;
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
    setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setStartError: React.Dispatch<React.SetStateAction<string | null>>;
    setTargetScore: React.Dispatch<React.SetStateAction<number | null>>;
    setGameMode: React.Dispatch<React.SetStateAction<GameMode>>;
    setTeamCount: React.Dispatch<React.SetStateAction<number>>;
    setRoundStartRemainingMs: React.Dispatch<React.SetStateAction<number>>;
    setGameOverData: React.Dispatch<
        React.SetStateAction<GameOverPayload | null>
    >;
    setRoundOverData: React.Dispatch<
        React.SetStateAction<RoundOverPayload | null>
    >;
    setGameConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    autoCreateRoom?: boolean;
};

export function useHostRoomSync({
    setRoomCode,
    setPlayers,
    setPlaying,
    setStartError,
    setTargetScore,
    setGameMode,
    setTeamCount,
    setRoundStartRemainingMs,
    setGameOverData,
    setRoundOverData,
    setGameConfig,
    autoCreateRoom = true,
}: UseHostRoomSyncParams) {
    const latestPlayersRef = useRef<Player[]>([]);

    useEffect(() => {
        const clonePlayers = (players: Player[]) =>
            players.map((player) => ({
                ...player,
                trail: player.trail?.map((segment) =>
                    segment.map((point) => ({ ...point })),
                ),
            }));

        const applyPlayers = (players: Player[]) => {
            const nextPlayers = clonePlayers(players);
            latestPlayersRef.current = nextPlayers;
            setPlayers(nextPlayers);
            return nextPlayers;
        };

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
            if (incoming === "teams") {
                setGameMode("teams");
                return;
            }
            if (incoming === "classic") {
                setGameMode("classic");
            }
        };

        const applyTeamCount = (incoming?: number) => {
            if (typeof incoming !== "number") return;
            if (!Number.isInteger(incoming) || incoming < 2 || incoming > 5) {
                return;
            }
            setTeamCount(incoming);
        };

        const buildFallbackLeaderboard = (
            players: Player[],
            gameMode?: GameMode,
        ): LeaderboardEntry[] => {
            if (gameMode === "teams") {
                return buildTeamLeaderboard(players);
            }

            return players
                .map((player) => ({
                    id: player.id,
                    name: player.name,
                    score: player.score ?? 0,
                    color: player.color,
                    alive: player.alive,
                    socketId: player.socketId,
                    teamId: player.teamId,
                    kind: "player" as const,
                }))
                .sort(
                    (firstPlayer, secondPlayer) =>
                        (gameMode === "battle-royale"
                            ? Number(secondPlayer.alive) -
                              Number(firstPlayer.alive)
                            : secondPlayer.score - firstPlayer.score) ||
                        firstPlayer.name.localeCompare(secondPlayer.name),
                );
        };

        const buildScoreMap = (
            players: Player[],
            gameMode?: GameMode,
        ): Record<string, number> => {
            return Object.fromEntries(
                buildFallbackLeaderboard(players, gameMode).map((entry) => [
                    entry.id,
                    entry.score ?? 0,
                ]),
            );
        };

        const reconnectFromSession = () => {
            const rawSession = localStorage.getItem(HOST_SESSION_KEY);
            if (!rawSession) {
                if (!autoCreateRoom) return;
                socket.emit(
                    EVENTS.CREATE_ROOM,
                    null,
                    (res: { roomCode: string; gameConfig?: GameConfig }) => {
                        if (!res?.roomCode) {
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
                return;
            }
            try {
                const session = JSON.parse(rawSession) as { roomCode?: string };
                if (!session.roomCode) {
                    localStorage.removeItem(HOST_SESSION_KEY);
                    setRoomCode(null);
                    return;
                }
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
                                applyPlayers(res.players);
                            }
                            applyGameMode(res.gameMode);
                            applyTargetScore(res.targetScore);
                            applyTeamCount(res.teamCount);
                            applyGameConfig(res.gameConfig);
                            setRoundOverData(null);
                            if (res.state === "finished") {
                                setRoundStartRemainingMs(0);
                                const fallbackLeaderboard =
                                    buildFallbackLeaderboard(
                                        res.players ?? [],
                                        res.gameMode,
                                    );
                                setGameOverData({
                                    winnerId:
                                        res.winnerId ??
                                        res.leaderboard?.[0]?.id ??
                                        fallbackLeaderboard[0]?.id ??
                                        null,
                                    gameMode: res.gameMode,
                                    targetScore: res.targetScore,
                                    teamCount: res.teamCount,
                                    leaderboard:
                                        res.leaderboard ?? fallbackLeaderboard,
                                });
                                setPlaying(true);
                            } else {
                                setGameOverData(null);
                                if (res.state !== "playing") {
                                    setRoundStartRemainingMs(0);
                                }
                                setPlaying(res.state === "playing");
                            }
                        } else {
                            localStorage.removeItem(HOST_SESSION_KEY);
                            setRoomCode(null);
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
            setPlayers((players) => {
                const nextPlayers = clonePlayers([
                    ...players,
                    { ...data.player },
                ]);
                latestPlayersRef.current = nextPlayers;
                return nextPlayers;
            });
        });

        socket.on(
            "lobbyUpdate",
            (data: {
                players: Player[];
                gameMode?: GameMode;
                targetScore?: number;
                teamCount?: number;
                gameConfig?: GameConfig;
            }) => {
                applyPlayers(data.players);
                applyGameMode(data.gameMode);
                applyTargetScore(data.targetScore);
                applyTeamCount(data.teamCount);
                applyGameConfig(data.gameConfig);
                setRoundOverData(null);
                setRoundStartRemainingMs(0);
            },
        );

        socket.on(
            "startGame",
            (data?: {
                gameMode?: GameMode;
                targetScore?: number;
                teamCount?: number;
                gameConfig?: GameConfig;
            }) => {
                applyGameMode(data?.gameMode);
                applyTargetScore(data?.targetScore);
                applyTeamCount(data?.teamCount);
                applyGameConfig(data?.gameConfig);
                setGameOverData(null);
                setRoundOverData(null);
                setPlaying(true);
            },
        );

        socket.on(
            EVENTS.GAME_STATE,
            (state?: GameState) => {
                if (state?.arena) {
                    applyGameConfig(state.arena);
                }
                applyGameMode(state?.gameMode);
                applyTargetScore(state?.targetScore);
                applyTeamCount(state?.teamCount);
                setRoundStartRemainingMs(
                    Math.max(0, state?.roundStartRemainingMs ?? 0),
                );
                if (state && Array.isArray(state.players)) {
                    applyPlayers(state.players);
                }
            },
        );

        socket.on(
            EVENTS.ROUND_OVER,
            (data?: RoundOverPayload) => {
                if (!data) return;
                setRoundStartRemainingMs(0);
                setRoundOverData({
                    ...data,
                    scoreBeforeById:
                        data.scoreBeforeById ??
                        buildScoreMap(latestPlayersRef.current, data.gameMode),
                });
            },
        );

        socket.on(EVENTS.GAME_OVER, (data?: GameOverPayload) => {
            applyGameMode(data?.gameMode);
            applyTargetScore(data?.targetScore);
            applyTeamCount(data?.teamCount);
            setRoundOverData(null);
            if (data?.leaderboard && Array.isArray(data.leaderboard)) {
                setGameOverData(data);
            }
            setRoundStartRemainingMs(0);
            setPlaying(true);
        });

        socket.on(EVENTS.ROUND_RESTART, () => {
            setRoundOverData(null);
        });

        socket.on("connect", reconnectFromSession);
        reconnectFromSession();

        return () => {
            socket.off("roomCreated");
            socket.off("playerJoined");
            socket.off("lobbyUpdate");
            socket.off("startGame");
            socket.off(EVENTS.GAME_STATE);
            socket.off(EVENTS.ROUND_OVER);
            socket.off(EVENTS.GAME_OVER);
            socket.off(EVENTS.ROUND_RESTART);
            socket.off("connect", reconnectFromSession);
        };
    }, [
        setRoomCode,
        setPlayers,
        setPlaying,
        setStartError,
        setTargetScore,
        setGameMode,
        setTeamCount,
        setRoundStartRemainingMs,
        setGameOverData,
        setRoundOverData,
        setGameConfig,
        autoCreateRoom,
    ]);
}
