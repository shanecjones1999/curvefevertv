import type { GameMode, Player } from "../../types";
import {
    getTeamColor,
    getTeamLabel,
    getTeamSymbol,
} from "../../utils/teamMode";
import styles from "./HostPlayerList.module.css";

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
    const connectedPlayers = players.filter((player) => Boolean(player.socketId)).length;

    if (gameMode === "teams") {
        const teams = Array.from({ length: teamCount }, (_, index) => {
            const teamId = index + 1;
            return {
                teamId,
                players: players.filter((player) => player.teamId === teamId),
            };
        });

        return (
            <section className={`panel inset-panel ${styles.root} ${className ?? ""}`.trim()}>
                <div className={styles.header}>
                    <div>
                        <p className="eyebrow">Lobby roster</p>
                        <h3 className="section-title">Teams ({teamCount})</h3>
                    </div>
                    <div className={styles.summary}>
                        <span>{players.length} assigned</span>
                        <span>{connectedPlayers} connected</span>
                    </div>
                </div>
                <div className={styles.teamList}>
                    {teams.map((team) => (
                        <section
                            key={team.teamId}
                            className={styles.teamGroup}
                            aria-label={getTeamLabel(team.teamId)}
                        >
                            <div className={styles.teamGroupHeader}>
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
                                <span className={styles.teamGroupCount}>
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
        <section className={`panel inset-panel ${styles.root} ${className ?? ""}`.trim()}>
            <div className={styles.header}>
                <div>
                    <p className="eyebrow">Lobby roster</p>
                    <h3 className="section-title">Players ({players.length})</h3>
                </div>
                <div className={styles.summary}>
                    <span>{connectedPlayers} connected</span>
                    <span>{Math.max(0, players.length - connectedPlayers)} away</span>
                </div>
            </div>
            <ul className="player-list">
                {players.length === 0 && (
                    <li className="player-row player-empty player-empty-card">
                        <div className="player-empty-copy">
                            <strong>No players yet</strong>
                            <p>Share the code or QR to bring controllers in.</p>
                        </div>
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
