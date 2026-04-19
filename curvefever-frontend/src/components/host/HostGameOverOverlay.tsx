import type { GameMode } from "../../types";
import styles from "../../ui.module.css";
import { cx } from "../../utils/cx";
import type { GameOverLeaderboardEntry, GameOverPayload } from "./types";

type Props = {
    gameMode: GameMode;
    gameOverData: GameOverPayload;
    winnerName: string | undefined;
    displayLeaderboard: GameOverLeaderboardEntry[];
    highestScore: number;
    playersCount: number;
    getBarColorClassName: (color: string | undefined, index: number) => string;
    onPlayAgain: () => void;
    onEndGame: () => void;
};

export default function HostGameOverOverlay({
    gameMode,
    gameOverData,
    winnerName,
    displayLeaderboard,
    highestScore,
    playersCount,
    getBarColorClassName,
    onPlayAgain,
    onEndGame,
}: Props) {
    return (
        <section className={styles["game-over-overlay"]}>
            <div className={styles["game-over-panel"]}>
                <h2 className={styles["game-over-title"]}>
                    {gameMode === "battle-royale"
                        ? "Battle Royale Over"
                        : "Game Over"}
                </h2>
                <p className={styles["game-over-subtitle"]}>
                    {winnerName ? `${winnerName} wins!` : "Final standings"}
                </p>

                <div className={styles["game-over-bars"]} role="list">
                    {displayLeaderboard.map((entry, index) => {
                        return (
                            <div
                                key={entry.id}
                                className={styles["game-over-bar-row"]}
                                role="listitem"
                            >
                                <div className={styles["game-over-bar-meta"]}>
                                    <span className={styles["game-over-rank"]}>
                                        #{index + 1}
                                    </span>
                                    <span className={styles["game-over-name"]}>
                                        {entry.name}
                                    </span>
                                    <span className={styles["game-over-score"]}>
                                        {gameMode === "battle-royale"
                                            ? entry.id === gameOverData.winnerId
                                                ? "Winner"
                                                : "Eliminated"
                                            : `${entry.score} pts`}
                                    </span>
                                </div>
                                {gameMode !== "battle-royale" && (
                                    <div className={styles["game-over-bar-track"]}>
                                        <progress
                                            className={cx(
                                                styles["game-over-progress"],
                                                getBarColorClassName(
                                                    entry.color,
                                                    index,
                                                ),
                                            )}
                                            value={Math.max(0, entry.score)}
                                            max={Math.max(1, highestScore)}
                                            aria-label={`${entry.name} score bar`}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className={styles["game-over-actions"]}>
                    <button
                        className={styles["ui-button"]}
                        onClick={onPlayAgain}
                        disabled={playersCount < 1}
                    >
                        Play Again
                    </button>
                    <button
                        className={cx(
                            styles["ui-button"],
                            styles["ui-button-ghost"],
                        )}
                        onClick={onEndGame}
                    >
                        End Game
                    </button>
                </div>
            </div>
        </section>
    );
}
