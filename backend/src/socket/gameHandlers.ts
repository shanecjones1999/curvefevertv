import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
    calculateTargetScore,
    normalizeRoomCode,
    sanitizeGameMode,
    sanitizeTeamCount,
} from "../domain/gameRules";
import {
    buildTeamLeaderboard,
    rebalancePlayersForTeamMode,
} from "../domain/teamMode";
import { buildGameState, restartRound, startGameLoop } from "../gameLoop";
import { getRoom } from "../rooms";
import { GameMode, InputPayload } from "../types";
import { TypedServer, TypedSocket } from "./events";
import { emitLobbyUpdate } from "./lobbyEmitter";
import { getPlayerBySocket } from "./sessionRegistry";

export function registerGameHandlers(io: TypedServer, socket: TypedSocket) {
    socket.on("input", (payload: InputPayload) => {
        const player = getPlayerBySocket(socket.id);
        if (!player || !player.alive) return;

        player.turnLeftHeld = Boolean(payload?.turnLeft);
        player.turnRightHeld = Boolean(payload?.turnRight);
    });

    socket.on(
        "setGameMode",
        (
            data: { roomCode: string; gameMode?: GameMode; teamCount?: number },
            cb,
        ) => {
            const roomCode = normalizeRoomCode(data?.roomCode);
            if (!roomCode)
                return cb?.({
                    ok: false,
                    error: "Room code must be 4 letters",
                });
            const room = getRoom(roomCode);
            if (!room) return cb?.({ ok: false, error: "Room not found" });
            if (room.hostSocketId !== socket.id)
                return cb?.({ ok: false, error: "Not host" });
            if (room.state === "playing") {
                return cb?.({
                    ok: false,
                    error: "Cannot change game mode during an active game",
                });
            }

            room.gameMode = sanitizeGameMode(data?.gameMode);
            room.teamCount = sanitizeTeamCount(data?.teamCount ?? room.teamCount);
            if (room.gameMode === "teams") {
                rebalancePlayersForTeamMode(
                    Array.from(room.players.values()),
                    room.teamCount,
                    { preserveExisting: true },
                );
            }
            emitLobbyUpdate(io, room.code);
            cb?.({
                ok: true,
                gameMode: room.gameMode,
                teamCount: room.teamCount,
            });
        },
    );

    socket.on(
        "startGame",
        (
            data: { roomCode: string; gameMode?: GameMode; teamCount?: number },
            cb,
        ) => {
            const roomCode = normalizeRoomCode(data?.roomCode);
            if (!roomCode)
                return cb?.({
                    ok: false,
                    error: "Room code must be 4 letters",
                });
            const room = getRoom(roomCode);
            if (!room) return cb?.({ ok: false, error: "Room not found" });
            if (room.hostSocketId !== socket.id)
                return cb?.({ ok: false, error: "Not host" });

            if (room.players.size < 1)
                return cb?.({ ok: false, error: "Need at least 1 player" });

            const gameMode = sanitizeGameMode(data?.gameMode);
            room.gameMode = gameMode;
            room.teamCount = sanitizeTeamCount(data?.teamCount ?? room.teamCount);

            const players = Array.from(room.players.values());
            if (gameMode === "teams") {
                rebalancePlayersForTeamMode(players, room.teamCount, {
                    preserveExisting: true,
                });
                const activeTeamCount = buildTeamLeaderboard(players).length;
                if (activeTeamCount < 2) {
                    return cb?.({
                        ok: false,
                        error: "Need players on at least 2 teams",
                    });
                }
            }

            const targetScore =
                gameMode === "battle-royale"
                    ? undefined
                    : calculateTargetScore(
                          gameMode === "teams"
                              ? buildTeamLeaderboard(players).length
                              : room.players.size,
                      );
            room.targetScore = targetScore;
            room.battleRoyaleEliminatedPlayerIds = new Set<string>();
            for (const player of players) {
                player.score = 0;
            }
            restartRound(players, {
                battleRoyaleEliminatedPlayerIds:
                    room.battleRoyaleEliminatedPlayerIds,
            });
            room.state = "playing";
            startGameLoop(room.code, io);
            io.to(room.code).emit("startGame", {
                gameMode,
                targetScore,
                teamCount: room.teamCount,
                gameConfig: {
                    width: GAME_WIDTH,
                    height: GAME_HEIGHT,
                },
            });
            const state = buildGameState(room.code);
            if (state) {
                io.to(room.code).emit("gameState", state);
            }
            cb?.({
                ok: true,
                gameMode,
                targetScore,
                teamCount: room.teamCount,
                gameConfig: {
                    width: GAME_WIDTH,
                    height: GAME_HEIGHT,
                },
            });
        },
    );
}
