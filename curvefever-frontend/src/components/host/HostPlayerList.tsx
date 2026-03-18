import type { Player } from "../../types";

type Props = {
    players: Player[];
    getPlayerRowClassName: (player: Player) => string;
    getPlayerDotColor: (player: Player) => string;
};

export default function HostPlayerList({
    players,
    getPlayerRowClassName,
    getPlayerDotColor,
}: Props) {
    return (
        <section className="panel inset-panel">
            <h3 className="section-title">Players ({players.length})</h3>
            <ul className="player-list">
                {players.length === 0 && (
                    <li className="player-row player-empty">
                        Waiting for players to join...
                    </li>
                )}
                {players.map((player) => (
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
                ))}
            </ul>
        </section>
    );
}
