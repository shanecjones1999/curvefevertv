import type { GameMode } from "../../types";
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
        <section className="game-over-overlay">
            <div className="game-over-panel">
                <h2 className="game-over-title">
                    {gameMode === "battle-royale"
                        ? "Battle Royale Over"
                        : "Game Over"}
                </h2>
                <p className="game-over-subtitle">
                    {winnerName ? `${winnerName} wins!` : "Final standings"}
                </p>

                <div className="game-over-bars" role="list">
                    {displayLeaderboard.map((entry, index) => {
                        return (
                            <div
                                key={entry.id}
                                className="game-over-bar-row"
                                role="listitem"
                            >
                                <div className="game-over-bar-meta">
                                    <span className="game-over-rank">
                                        #{index + 1}
                                    </span>
                                    <span className="game-over-name">
                                        {entry.name}
                                    </span>
                                    <span className="game-over-score">
                                        {gameMode === "battle-royale"
                                            ? entry.id === gameOverData.winnerId
                                                ? "Winner"
                                                : "Eliminated"
                                            : `${entry.score} pts`}
                                    </span>
                                </div>
                                {gameMode !== "battle-royale" && (
                                    <div className="game-over-bar-track">
                                        <progress
                                            className={`game-over-progress ${getBarColorClassName(entry.color, index)}`}
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

                <div className="game-over-actions">
                    <button
                        className="ui-button"
                        onClick={onPlayAgain}
                        disabled={playersCount < 1}
                    >
                        Play Again
                    </button>
                    <button
                        className="ui-button ui-button-ghost"
                        onClick={onEndGame}
                    >
                        End Game
                    </button>
                </div>
            </div>
        </section>
    );
}
