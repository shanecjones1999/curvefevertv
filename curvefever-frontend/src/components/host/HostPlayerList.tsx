import type { GameMode, Player } from "../../types";
import {
    getTeamColor,
    getTeamLabel,
    getTeamSymbol,
} from "../../utils/teamMode";

type Props = {
    className?: string;
    players: Player[];
    gameMode: GameMode;
    teamCount: number;
    getPlayerRowClassName: (player: Player) => string;
    getPlayerDotColor: (player: Player) => string;
};

export default function HostPlayerList({
    className,
    players,
    gameMode,
    teamCount,
    getPlayerRowClassName,
    getPlayerDotColor,
}: Props) {
    if (gameMode === "teams") {
        const teams = Array.from({ length: teamCount }, (_, index) => {
            const teamId = index + 1;
            return {
                teamId,
                players: players.filter((player) => player.teamId === teamId),
            };
        });

        return (
            <section className={`panel inset-panel ${className ?? ""}`.trim()}>
                <h3 className="section-title">Teams ({teamCount})</h3>
                <div className="team-list">
                    {teams.map((team) => (
                        <section
                            key={team.teamId}
                            className="team-group"
                            aria-label={getTeamLabel(team.teamId)}
                        >
                            <div className="team-group-header">
                                <span
                                    className="team-badge team-badge-colored"
                                    style={{
                                        borderColor: `${getTeamColor(team.teamId)}80`,
                                        backgroundColor: `${getTeamColor(team.teamId)}24`,
                                        color: getTeamColor(team.teamId),
                                    }}
                                >
                                    <span className="team-symbol" aria-hidden="true">
                                        {getTeamSymbol(team.teamId)}
                                    </span>
                                    {getTeamLabel(team.teamId)}
                                </span>
                                <span className="team-group-count">
                                    {team.players.length}{" "}
                                    {team.players.length === 1
                                        ? "player"
                                        : "players"}
                                </span>
                            </div>
                            <ul className="player-list">
                                {team.players.length === 0 ? (
                                    <li className="player-row player-empty">
                                        No players assigned yet
                                    </li>
                                ) : (
                                    team.players.map((player) => (
                                        <li
                                            key={player.id}
                                            className={getPlayerRowClassName(player)}
                                        >
                                            <span className="player-name-with-status">
                                                <span
                                                    className="status-dot-wrap"
                                                    title={
                                                        player.socketId
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
                                                            fill={getPlayerDotColor(player)}
                                                        />
                                                    </svg>
                                                </span>
                                                <span>{player.name}</span>
                                            </span>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </section>
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className={`panel inset-panel ${className ?? ""}`.trim()}>
            <h3 className="section-title">Players ({players.length})</h3>
            <ul className="player-list">
                {players.length === 0 && (
                    <li className="player-row player-empty">
                        Waiting for players to join...
                    </li>
                )}
                {players.map((player) => (
                    <li key={player.id} className={getPlayerRowClassName(player)}>
                        <span className="player-name-with-status">
                            <span
                                className="status-dot-wrap"
                                title={
                                    player.socketId
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
                                        fill={getPlayerDotColor(player)}
                                    />
                                </svg>
                            </span>
                            <span>{player.name}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
