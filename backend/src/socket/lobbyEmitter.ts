import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { calculateTargetScore } from "../domain/gameRules";
import { getRoom } from "../rooms";
import { TypedServer } from "./events";

export function emitLobbyUpdate(io: TypedServer, roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;

    io.to(room.code).emit("lobbyUpdate", {
        players: Array.from(room.players.values()),
        gameMode: room.gameMode,
        targetScore:
            room.gameMode === "classic"
                ? (room.targetScore ?? calculateTargetScore(room.players.size))
                : undefined,
        powerUpsEnabled: room.powerUpsEnabled,
        gameConfig: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
        },
    });
}
