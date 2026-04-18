import type { GameMode, LeaderboardEntry, Player } from "../../types";
import { getTeamLabel, getTeamSymbol } from "../../utils/teamMode";

type Props = {
    leaderboard: LeaderboardEntry[];
    gameMode: GameMode;
    getRowClassName: (entry: LeaderboardEntry) => string;
    getDotColor: (entry: LeaderboardEntry) => string;
    getTeamPlayers: (teamId: number) => Player[];
};

export default function HostLeaderboard({
    leaderboard,
    gameMode,
    getRowClassName,
    getDotColor,
    getTeamPlayers,
}: Props) {
    return (
        <section className="panel inset-panel leaderboard-panel">
            <h3 className="section-title">Leaderboard</h3>
            <ul className="player-list">
                {leaderboard.map((entry) => (
                    <li
                        key={entry.id}
                        className={getRowClassName(entry)}
                    >
                        <span className="leaderboard-player-name">
                            <span className="player-name-with-status">
                                <span
                                    className="status-dot-wrap"
                                    title={
                                        entry.kind === "team"
                                            ? entry.alive
                                                ? "Still alive"
                                                : "Eliminated"
                                            : entry.socketId
                                              ? "Connected"
                                              : "Disconnected"
                                    }
                                >
                                    <svg
                                        className="status-dot"
                                        viewBox="0 0 10 10"
                                        aria-hidden="true"
                                    >
                                        <circle
                                            cx="5"
                                            cy="5"
                                            r="4"
                                            fill={getDotColor(entry)}
                                        />
                                    </svg>
                                </span>
                                <span>
                                    {entry.kind === "team" &&
                                    typeof entry.teamId === "number"
                                        ? `${getTeamSymbol(entry.teamId)} ${getTeamLabel(entry.teamId)}`
                                        : entry.name}
                                </span>
                                {entry.kind === "team" &&
                                    typeof entry.playerCount === "number" && (
                                        <span className="team-badge">
                                            {entry.playerCount}{" "}
                                            {entry.playerCount === 1
                                                ? "player"
                                                : "players"}
                                        </span>
                                    )}
                            </span>
                        </span>
                        <span className="leaderboard-player-meta">
                            <span>
                                {gameMode === "battle-royale"
                                    ? entry.alive
                                        ? "Alive"
                                        : "Eliminated"
                                    : `${entry.score} pts`}
                            </span>
                        </span>
                        {entry.kind === "team" &&
                            typeof entry.teamId === "number" && (
                                <div className="team-member-list">
                                    {getTeamPlayers(entry.teamId).map((player) => (
                                        <span
                                            key={player.id}
                                            className="team-member-chip"
                                        >
                                            <span
                                                className="team-member-chip-dot"
                                                style={{
                                                    backgroundColor:
                                                        getDotColor({
                                                            id: player.id,
                                                            name: player.name,
                                                            score: player.score,
                                                            color: player.color,
                                                            alive: player.alive,
                                                            socketId: player.socketId,
                                                            teamId: player.teamId,
                                                            kind: "player",
                                                        }) ?? "#fff",
                                                }}
                                            />
                                            <span>{player.name}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
