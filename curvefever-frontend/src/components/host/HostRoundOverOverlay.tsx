import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { GameMode } from "../../types";
import styles from "../../ui.module.css";
import type { RoundOverLeaderboardEntry, RoundOverPayload } from "./types";

const ROUND_RESTART_DELAY_MS = 5000;
const SCORE_ANIMATION_START_DELAY_MS = 1000;

type Props = {
    gameMode: GameMode;
    roundOverData: RoundOverPayload;
    goalScore?: number | null;
    displayLeaderboard: RoundOverLeaderboardEntry[];
    title?: string;
    winnerStatusLabel?: string;
    showCountdown?: boolean;
    countdownLabel?: string;
    countdownDurationMs?: number;
};

function getInitial(name: string) {
    return name.trim().charAt(0).toUpperCase() || "?";
}

function formatPointsDelta(delta: number, gameMode: GameMode, isWinner: boolean) {
    if (gameMode === "battle-royale") {
        return isWinner ? "WIN" : "OUT";
    }

    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `${delta}`;
    return "0";
}

function getRowClassName(isWinner: boolean) {
    return [
        styles["round-over-row"],
        isWinner ? styles["round-over-row-winner"] : "",
    ]
        .filter(Boolean)
        .join(" ");
}

export default function HostRoundOverOverlay({
    gameMode,
    roundOverData,
    goalScore,
    displayLeaderboard,
    title = "Round results",
    winnerStatusLabel = "Round winner",
    showCountdown = true,
    countdownLabel = "Next round starts in",
    countdownDurationMs = ROUND_RESTART_DELAY_MS,
}: Props) {
    const previousScores = useMemo(
        () =>
            Object.fromEntries(
                displayLeaderboard.map((entry) => [
                    entry.id,
                    roundOverData.scoreBeforeById?.[entry.id] ?? entry.score ?? 0,
                ]),
            ) as Record<string, number>,
        [displayLeaderboard, roundOverData.scoreBeforeById],
    );
    const [hasAnimated, setHasAnimated] = useState(false);
    const [nextRoundCountdown, setNextRoundCountdown] = useState(
        Math.ceil(countdownDurationMs / 1000),
    );

    useEffect(() => {
        let frameId = 0;
        let secondFrameId = 0;

        frameId = window.requestAnimationFrame(() => {
            secondFrameId = window.requestAnimationFrame(() => {
                setHasAnimated(true);
            });
        });

        return () => {
            window.cancelAnimationFrame(frameId);
            window.cancelAnimationFrame(secondFrameId);
        };
    }, []);

    useEffect(() => {
        if (!showCountdown) return;

        const restartAt = Date.now() + countdownDurationMs;
        const intervalId = window.setInterval(() => {
            const remainingMs = restartAt - Date.now();
            setNextRoundCountdown(Math.max(1, Math.ceil(remainingMs / 1000)));
        }, 100);

        return () => window.clearInterval(intervalId);
    }, [countdownDurationMs, showCountdown]);

    const maxScore = Math.max(
        goalScore ?? 0,
        ...displayLeaderboard.map((entry) => entry.score ?? 0),
        1,
    );

    return (
        <section className={styles["round-over-overlay"]} aria-live="polite">
            <div className={styles["round-over-panel"]}>
                <div className={styles["round-over-header"]}>
                    <div className={styles["round-over-heading"]}>
                        <h2 className={styles["round-over-title"]}>
                            {title}
                        </h2>
                    </div>
                </div>

                <div className={styles["round-over-board"]}>
                    <div className={styles["round-over-rows"]} role="list">
                        {displayLeaderboard.map((entry, index) => {
                            const startScore =
                                previousScores[entry.id] ?? entry.score ?? 0;
                            const finalScore = entry.score ?? 0;
                            const scoreDelta = finalScore - startScore;
                            const startFillPercent = Math.max(
                                0,
                                Math.min(100, (startScore / maxScore) * 100),
                            );
                            const finalFillPercent = Math.max(
                                0,
                                Math.min(100, (finalScore / maxScore) * 100),
                            );
                            const baseFillPercent = hasAnimated
                                ? finalFillPercent
                                : startFillPercent;
                            const gainFillPercent = hasAnimated
                                ? Math.max(0, finalFillPercent - startFillPercent)
                                : 0;
                            const isWinner = entry.id === roundOverData.winnerId;
                            const rowStyle = {
                                "--round-over-accent": entry.color ?? "#4d88ff",
                                "--round-over-row-delay": `${index * 70}ms`,
                                "--round-over-score-delay": `${SCORE_ANIMATION_START_DELAY_MS}ms`,
                            } as CSSProperties;

                            return (
                                <div
                                    key={entry.id}
                                    className={getRowClassName(isWinner)}
                                    style={rowStyle}
                                    role="listitem"
                                >
                                    <div
                                        className={styles["round-over-row-track"]}
                                        aria-hidden="true"
                                    />
                                    <div
                                        className={styles["round-over-row-base-fill"]}
                                        style={{ width: `${baseFillPercent}%` }}
                                        aria-hidden="true"
                                    />
                                    <div
                                        className={styles["round-over-row-gain-fill"]}
                                        style={{
                                            left: `${startFillPercent}%`,
                                            width: `${gainFillPercent}%`,
                                        }}
                                        aria-hidden="true"
                                    />
                                    <div
                                        className={styles["round-over-row-grid"]}
                                    >
                                        <span
                                            className={styles["round-over-rank"]}
                                        >
                                            {index + 1}
                                        </span>
                                        <span
                                            className={styles["round-over-badge"]}
                                        >
                                            {getInitial(entry.name)}
                                        </span>
                                        <span
                                            className={
                                                styles["round-over-name-stack"]
                                            }
                                        >
                                            <span
                                                className={
                                                    styles["round-over-name"]
                                                }
                                            >
                                                {entry.name}
                                            </span>
                                            {isWinner && (
                                                <span
                                                    className={
                                                        styles["round-over-status"]
                                                    }
                                                >
                                                    {winnerStatusLabel}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={styles["round-over-points"]}
                                        >
                                            {formatPointsDelta(
                                                scoreDelta,
                                                gameMode,
                                                isWinner,
                                            )}
                                        </span>
                                        <span className={styles["round-over-score"]}>
                                            {finalScore}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {showCountdown && (
                    <div className={styles["round-over-footer"]}>
                        <p className={styles["round-over-next-round"]}>
                            {countdownLabel} {nextRoundCountdown}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
