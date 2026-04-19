import type { GameMode, Player } from "../../types";
import styles from "../../ui.module.css";
import { cx } from "../../utils/cx";
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
            <section className={cx(styles.panel, styles["inset-panel"], className)}>
                <h3 className={styles["section-title"]}>Teams ({teamCount})</h3>
                <div className={styles["team-list"]}>
                    {teams.map((team) => (
                        <section
                            key={team.teamId}
                            className={styles["team-group"]}
                            aria-label={getTeamLabel(team.teamId)}
                        >
                            <div className={styles["team-group-header"]}>
                                <span
                                    className={cx(
                                        styles["team-badge"],
                                        styles["team-badge-colored"],
                                    )}
                                    style={{
                                        borderColor: `${getTeamColor(team.teamId)}80`,
                                        backgroundColor: `${getTeamColor(team.teamId)}24`,
                                        color: getTeamColor(team.teamId),
                                    }}
                                >
                                    <span
                                        className={styles["team-symbol"]}
                                        aria-hidden="true"
                                    >
                                        {getTeamSymbol(team.teamId)}
                                    </span>
                                    {getTeamLabel(team.teamId)}
                                </span>
                                <span className={styles["team-group-count"]}>
                                    {team.players.length}{" "}
                                    {team.players.length === 1
                                        ? "player"
                                        : "players"}
                                </span>
                            </div>
                            <ul className={styles["player-list"]}>
                                {team.players.length === 0 ? (
                                    <li
                                        className={cx(
                                            styles["player-row"],
                                            styles["player-empty"],
                                        )}
                                    >
                                        No players assigned yet
                                    </li>
                                ) : (
                                    team.players.map((player) => (
                                        <li
                                            key={player.id}
                                            className={getPlayerRowClassName(player)}
                                        >
                                            <span
                                                className={
                                                    styles["player-name-with-status"]
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles["status-dot-wrap"]
                                                    }
                                                    title={
                                                        player.socketId
                                                            ? "Connected"
                                                            : "Disconnected"
                                                    }
                                                >
                                                    <svg
                                                        className={styles["status-dot"]}
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
        <section className={cx(styles.panel, styles["inset-panel"], className)}>
            <h3 className={styles["section-title"]}>Players ({players.length})</h3>
            <ul className={styles["player-list"]}>
                {players.length === 0 && (
                    <li
                        className={cx(
                            styles["player-row"],
                            styles["player-empty"],
                        )}
                    >
                        Waiting for players to join...
                    </li>
                )}
                {players.map((player) => (
                    <li key={player.id} className={getPlayerRowClassName(player)}>
                        <span className={styles["player-name-with-status"]}>
                            <span
                                className={styles["status-dot-wrap"]}
                                title={
                                    player.socketId
                                        ? "Connected"
                                        : "Disconnected"
                                }
                            >
                                <svg
                                    className={styles["status-dot"]}
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
