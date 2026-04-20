import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { CSSProperties } from "react";
import type { GameMode } from "../../types";
import styles from "../../ui.module.css";
import type { RoundOverLeaderboardEntry, RoundOverPayload } from "./types";

const ROUND_RESTART_DELAY_MS = 5000;
const SCORE_ANIMATION_START_DELAY_MS = 1000;
const SCORE_ANIMATION_DURATION_MS = 3000;
const ROW_REORDER_DURATION_MS = 650;

type Props = {
    gameMode: GameMode;
    roundOverData: RoundOverPayload;
    goalScore?: number | null;
    displayLeaderboard: RoundOverLeaderboardEntry[];
    title?: string;
    winnerStatusLabel?: string;
    showCountdown?: boolean;
    countdownLabel?: string;
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

function compareByScoreThenName(
    left: RoundOverLeaderboardEntry,
    right: RoundOverLeaderboardEntry,
    scoreById: Record<string, number>,
) {
    return (
        (scoreById[right.id] ?? 0) - (scoreById[left.id] ?? 0) ||
        left.name.localeCompare(right.name)
    );
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
    const entriesById = useMemo(
        () =>
            new Map(
                displayLeaderboard.map((entry) => [entry.id, entry] as const),
            ),
        [displayLeaderboard],
    );
    const initialOrderedIds = useMemo(
        () =>
            [...displayLeaderboard]
                .sort((left, right) =>
                    compareByScoreThenName(left, right, previousScores),
                )
                .map((entry) => entry.id),
        [displayLeaderboard, previousScores],
    );
    const finalOrderedIds = useMemo(
        () => displayLeaderboard.map((entry) => entry.id),
        [displayLeaderboard],
    );
    const [hasAnimated, setHasAnimated] = useState(false);
    const [orderedEntryIds, setOrderedEntryIds] =
        useState<string[]>(initialOrderedIds);
    const [nextRoundCountdown, setNextRoundCountdown] = useState(
        Math.ceil(ROUND_RESTART_DELAY_MS / 1000),
    );
    const rowRefs = useRef(new Map<string, HTMLDivElement>());
    const rowPositionsRef = useRef(new Map<string, number>());

    const orderedEntries = useMemo(
        () =>
            orderedEntryIds
                .map((id) => entriesById.get(id))
                .filter((entry): entry is RoundOverLeaderboardEntry =>
                    Boolean(entry),
                ),
        [entriesById, orderedEntryIds],
    );

    useEffect(() => {
        let frameId = 0;
        let secondFrameId = 0;
        let reorderTimeoutId = 0;

        frameId = window.requestAnimationFrame(() => {
            secondFrameId = window.requestAnimationFrame(() => {
                setHasAnimated(true);
            });
        });
        reorderTimeoutId = window.setTimeout(() => {
            setOrderedEntryIds(finalOrderedIds);
        }, SCORE_ANIMATION_START_DELAY_MS + SCORE_ANIMATION_DURATION_MS);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.cancelAnimationFrame(secondFrameId);
            window.clearTimeout(reorderTimeoutId);
        };
    }, [finalOrderedIds]);

    useLayoutEffect(() => {
        const nextPositions = new Map<string, number>();

        for (const entryId of orderedEntryIds) {
            const element = rowRefs.current.get(entryId);
            if (!element) continue;

            const nextTop = element.getBoundingClientRect().top;
            nextPositions.set(entryId, nextTop);

            const previousTop = rowPositionsRef.current.get(entryId);
            if (typeof previousTop !== "number") continue;

            const deltaY = previousTop - nextTop;
            if (Math.abs(deltaY) < 1) continue;

            element.style.transition = "none";
            element.style.transform = `translateY(${deltaY}px)`;
            void element.offsetHeight;
            element.style.transition = `transform ${ROW_REORDER_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
            element.style.transform = "translateY(0)";
        }

        rowPositionsRef.current = nextPositions;
    }, [orderedEntryIds]);

    useEffect(() => {
        if (!showCountdown) return;

        const restartAt = Date.now() + ROUND_RESTART_DELAY_MS;
        const intervalId = window.setInterval(() => {
            const remainingMs = restartAt - Date.now();
            setNextRoundCountdown(Math.max(1, Math.ceil(remainingMs / 1000)));
        }, 100);

        return () => window.clearInterval(intervalId);
    }, [showCountdown]);

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
                        {orderedEntries.map((entry, index) => {
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
                                    ref={(element) => {
                                        if (element) {
                                            rowRefs.current.set(entry.id, element);
                                            return;
                                        }
                                        rowRefs.current.delete(entry.id);
                                    }}
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
