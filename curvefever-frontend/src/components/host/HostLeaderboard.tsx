import type { GameMode, Player } from "../../types";

type Props = {
    leaderboard: Player[];
    gameMode: GameMode;
    getPlayerRowClassName: (player: Player) => string;
    getPlayerDotColor: (player: Player) => string;
};

export default function HostLeaderboard({
    leaderboard,
    gameMode,
    getPlayerRowClassName,
    getPlayerDotColor,
}: Props) {
    return (
        <section className="panel inset-panel leaderboard-panel">
            <h3 className="section-title">Leaderboard</h3>
            <ul className="player-list">
                {leaderboard.map((player) => (
                    <li
                        key={player.id}
                        className={getPlayerRowClassName(player)}
                    >
                        <span className="leaderboard-player-name">
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
                        </span>
                        <span className="leaderboard-player-meta">
                            <span>
                                {gameMode === "battle-royale"
                                    ? player.alive
                                        ? "Alive"
                                        : "Eliminated"
                                    : `${player.score} pts`}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
