import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
    calculateTargetScore,
    normalizeRoomCode,
    sanitizeGameMode,
} from "../domain/gameRules";
import { restartRound, startGameLoop } from "../gameLoop";
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
        (data: { roomCode: string; gameMode?: GameMode }, cb) => {
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
            emitLobbyUpdate(io, room.code);
            cb?.({ ok: true, gameMode: room.gameMode });
        },
    );

    socket.on(
        "setPowerUpsEnabled",
        (data: { roomCode: string; powerUpsEnabled?: boolean }, cb) => {
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
                    error: "Cannot change power-up setting during an active game",
                });
            }

            room.powerUpsEnabled = Boolean(data?.powerUpsEnabled);
            emitLobbyUpdate(io, room.code);
            cb?.({ ok: true, powerUpsEnabled: room.powerUpsEnabled });
        },
    );

    socket.on(
        "startGame",
        (
            data: {
                roomCode: string;
                gameMode?: GameMode;
                powerUpsEnabled?: boolean;
            },
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
            room.powerUpsEnabled = Boolean(data?.powerUpsEnabled);

            const targetScore =
                gameMode === "classic"
                    ? calculateTargetScore(room.players.size)
                    : undefined;
            room.targetScore = targetScore;
            room.battleRoyaleEliminatedPlayerIds = new Set<string>();
            const players = Array.from(room.players.values());
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
                powerUpsEnabled: room.powerUpsEnabled,
                gameConfig: {
                    width: GAME_WIDTH,
                    height: GAME_HEIGHT,
                },
            });
            cb?.({
                ok: true,
                gameMode,
                targetScore,
                powerUpsEnabled: room.powerUpsEnabled,
                gameConfig: {
                    width: GAME_WIDTH,
                    height: GAME_HEIGHT,
                },
            });
        },
    );
}
