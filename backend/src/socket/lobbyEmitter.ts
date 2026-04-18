import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { calculateTargetScore } from "../domain/gameRules";
import { buildTeamLeaderboard } from "../domain/teamMode";
import { getRoom } from "../rooms";
import { TypedServer } from "./events";

export function emitLobbyUpdate(io: TypedServer, roomCode: string) {
    const room = getRoom(roomCode);
    if (!room) return;

    io.to(room.code).emit("lobbyUpdate", {
        players: Array.from(room.players.values()),
        gameMode: room.gameMode,
        targetScore: (() => {
            if (room.gameMode === "classic") {
                return room.targetScore ?? calculateTargetScore(room.players.size);
            }
            if (room.gameMode === "teams") {
                const activeTeamCount = buildTeamLeaderboard(
                    Array.from(room.players.values()),
                ).length;
                return room.targetScore ?? calculateTargetScore(activeTeamCount);
            }
            return undefined;
        })(),
        teamCount: room.teamCount,
        gameConfig: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
        },
    });
}
